using GestionMesas.Api;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace GestionMesas.Api.Tests;

public sealed class PendingOrderWorkflowTests
{
    [Fact]
    public async Task AssignsPendingOrderToFreeTableAndStartsTableTime()
    {
        await using var fixture = await TestFixture.CreateAsync();
        var assignedAt = new DateTime(2026, 9, 20, 18, 30, 0, DateTimeKind.Utc);

        var result = await PendingOrderWorkflow.AssignAsync(
            fixture.Db, fixture.PendingOrderId, fixture.FreeTableId, assignedAt);

        Assert.Equal(PendingOrderAssignmentStatus.Success, result.Status);
        Assert.Equal("occupied", result.Table!.Status);
        Assert.Equal("Martín", result.Table.CustomerName);
        Assert.Equal(assignedAt, result.Table.OpenedAt);
        var order = Assert.Single(await fixture.Db.Orders.ToListAsync());
        Assert.Equal(fixture.FreeTableId, order.TableId);
        Assert.Equal(2, order.Quantity);
        Assert.Equal(assignedAt, order.CreatedAt);
        Assert.False(await fixture.Db.PendingOrders.AnyAsync());
        Assert.False(await fixture.Db.PendingOrderItems.AnyAsync());
    }

    [Fact]
    public async Task KeepsPendingOrderWhenTableIsOccupied()
    {
        await using var fixture = await TestFixture.CreateAsync();

        var result = await PendingOrderWorkflow.AssignAsync(
            fixture.Db, fixture.PendingOrderId, fixture.OccupiedTableId, DateTime.UtcNow);

        Assert.Equal(PendingOrderAssignmentStatus.TableNotAvailable, result.Status);
        Assert.True(await fixture.Db.PendingOrders.AnyAsync(order => order.Id == fixture.PendingOrderId));
        Assert.True(await fixture.Db.PendingOrderItems.AnyAsync(item => item.PendingOrderId == fixture.PendingOrderId));
        Assert.False(await fixture.Db.Orders.AnyAsync());
    }

    [Fact]
    public async Task AssignsPendingOrderWithoutItems()
    {
        await using var fixture = await TestFixture.CreateAsync();
        fixture.Db.PendingOrderItems.RemoveRange(fixture.Db.PendingOrderItems);
        await fixture.Db.SaveChangesAsync();
        var assignedAt = new DateTime(2026, 9, 20, 19, 0, 0, DateTimeKind.Utc);

        var result = await PendingOrderWorkflow.AssignAsync(
            fixture.Db, fixture.PendingOrderId, fixture.FreeTableId, assignedAt);

        Assert.Equal(PendingOrderAssignmentStatus.Success, result.Status);
        Assert.Equal("occupied", result.Table!.Status);
        Assert.Equal("Martín", result.Table.CustomerName);
        Assert.Equal(assignedAt, result.Table.OpenedAt);
        Assert.False(await fixture.Db.Orders.AnyAsync());
        Assert.False(await fixture.Db.PendingOrders.AnyAsync());
    }

    private sealed class TestFixture : IAsyncDisposable
    {
        private readonly SqliteConnection connection;

        private TestFixture(SqliteConnection connection, RestaurantContext db)
        {
            this.connection = connection;
            Db = db;
        }

        public RestaurantContext Db { get; }
        public int PendingOrderId { get; private init; }
        public int FreeTableId { get; private init; }
        public int OccupiedTableId { get; private init; }

        public static async Task<TestFixture> CreateAsync()
        {
            var connection = new SqliteConnection("Data Source=:memory:");
            await connection.OpenAsync();
            var options = new DbContextOptionsBuilder<RestaurantContext>().UseSqlite(connection).Options;
            var db = new RestaurantContext(options);
            await db.Database.EnsureCreatedAsync();

            var category = new Category { Name = "Artículos" };
            db.Categories.Add(category);
            await db.SaveChangesAsync();
            var product = new Product { Name = "Café", CategoryId = category.Id };
            var freeTable = new RestaurantTable { Name = "Mesa libre" };
            var occupiedTable = new RestaurantTable { Name = "Mesa ocupada", Status = "occupied", OpenedAt = DateTime.UtcNow };
            var pendingOrder = new PendingOrder { CustomerName = "Martín", CreatedAt = DateTime.UtcNow };
            db.AddRange(product, freeTable, occupiedTable, pendingOrder);
            await db.SaveChangesAsync();
            db.PendingOrderItems.Add(new PendingOrderItem
            {
                PendingOrderId = pendingOrder.Id,
                ProductId = product.Id,
                Quantity = 2,
                CreatedAt = DateTime.UtcNow
            });
            await db.SaveChangesAsync();

            return new TestFixture(connection, db)
            {
                PendingOrderId = pendingOrder.Id,
                FreeTableId = freeTable.Id,
                OccupiedTableId = occupiedTable.Id
            };
        }

        public async ValueTask DisposeAsync()
        {
            await Db.DisposeAsync();
            await connection.DisposeAsync();
        }
    }
}
