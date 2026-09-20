using GestionMesas.Api;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace GestionMesas.Api.Tests;

public sealed class CoworkingBillingTests
{
    [Fact]
    public async Task AddsServiceEveryThirtyMinutesWhenThereIsNoConsumption()
    {
        var now = new DateTime(2026, 9, 17, 20, 0, 0, DateTimeKind.Utc);
        await using var fixture = await TestFixture.CreateAsync(now.AddMinutes(-95));

        await CoworkingBilling.ProcessAsync(fixture.Db, now);

        var services = await fixture.ServiceOrdersAsync(CoworkingBilling.HalfHourProductName);
        Assert.Equal(3, services.Count);
        Assert.Equal(
            [now.AddMinutes(-65), now.AddMinutes(-35), now.AddMinutes(-5)],
            services.Select(order => order.CreatedAt));
    }

    [Fact]
    public async Task FirstConsumptionDelaysServiceForOneHour()
    {
        var now = new DateTime(2026, 9, 17, 20, 0, 0, DateTimeKind.Utc);
        var openedAt = now.AddMinutes(-100);
        await using var fixture = await TestFixture.CreateAsync(openedAt);
        await fixture.AddRealConsumptionAsync(openedAt.AddMinutes(20));

        await CoworkingBilling.ProcessAsync(fixture.Db, now);

        var service = Assert.Single(await fixture.ServiceOrdersAsync(CoworkingBilling.HourProductName));
        Assert.Equal(openedAt.AddMinutes(80), service.CreatedAt);
        Assert.Empty(await fixture.ServiceOrdersAsync(CoworkingBilling.HalfHourProductName));
    }

    [Fact]
    public async Task NewConsumptionRestartsOneHourDelayAfterPreviousServices()
    {
        var now = new DateTime(2026, 9, 17, 20, 0, 0, DateTimeKind.Utc);
        var openedAt = now.AddMinutes(-200);
        await using var fixture = await TestFixture.CreateAsync(openedAt);
        await fixture.AddRealConsumptionAsync(openedAt.AddMinutes(20));
        await fixture.AddServiceAsync(CoworkingBilling.HourProductName, openedAt.AddMinutes(80));
        await fixture.AddServiceAsync(CoworkingBilling.HalfHourProductName, openedAt.AddMinutes(110));
        await fixture.AddRealConsumptionAsync(openedAt.AddMinutes(120));

        await CoworkingBilling.ProcessAsync(fixture.Db, now);

        var hourServices = await fixture.ServiceOrdersAsync(CoworkingBilling.HourProductName);
        Assert.Equal(2, hourServices.Count);
        Assert.Equal(openedAt.AddMinutes(180), hourServices[^1].CreatedAt);
        Assert.Single(await fixture.ServiceOrdersAsync(CoworkingBilling.HalfHourProductName));
    }

    [Fact]
    public async Task MigratesOldHalfHourLabelWhenChargeWasGeneratedAfterOneHour()
    {
        var now = new DateTime(2026, 9, 17, 20, 0, 0, DateTimeKind.Utc);
        var openedAt = now.AddMinutes(-61);
        await using var fixture = await TestFixture.CreateAsync(openedAt);
        await fixture.AddRealConsumptionAsync(openedAt);
        await fixture.AddServiceAsync(CoworkingBilling.HalfHourProductName, openedAt.AddHours(1));

        await CoworkingBilling.ProcessAsync(fixture.Db, now);

        Assert.Single(await fixture.ServiceOrdersAsync(CoworkingBilling.HourProductName));
        Assert.Empty(await fixture.ServiceOrdersAsync(CoworkingBilling.HalfHourProductName));
    }

    private sealed class TestFixture : IAsyncDisposable
    {
        private readonly SqliteConnection connection;
        private readonly int realProductId;

        private TestFixture(SqliteConnection connection, RestaurantContext db, int realProductId)
        {
            this.connection = connection;
            Db = db;
            this.realProductId = realProductId;
        }

        public RestaurantContext Db { get; }
        public int TableId { get; private init; }

        public static async Task<TestFixture> CreateAsync(DateTime openedAt)
        {
            var connection = new SqliteConnection("Data Source=:memory:");
            await connection.OpenAsync();
            var options = new DbContextOptionsBuilder<RestaurantContext>().UseSqlite(connection).Options;
            var db = new RestaurantContext(options);
            await db.Database.EnsureCreatedAsync();
            var category = new Category { Name = "Bebidas" };
            db.Categories.Add(category);
            await db.SaveChangesAsync();
            var product = new Product { Name = "Café", CategoryId = category.Id };
            db.Products.Add(product);
            var table = new RestaurantTable
            {
                Name = "Mesa de prueba",
                Status = "occupied",
                OpenedAt = openedAt,
                LastConsumptionAt = openedAt
            };
            db.Tables.Add(table);
            await db.SaveChangesAsync();
            return new TestFixture(connection, db, product.Id) { TableId = table.Id };
        }

        public async Task AddRealConsumptionAsync(DateTime createdAt)
        {
            Db.Orders.Add(new Order { TableId = TableId, ProductId = realProductId, CreatedAt = createdAt });
            await Db.SaveChangesAsync();
        }

        public async Task AddServiceAsync(string productName, DateTime createdAt)
        {
            var id = await GetServiceProductIdAsync(productName);
            Db.Orders.Add(new Order { TableId = TableId, ProductId = id, CreatedAt = createdAt });
            await Db.SaveChangesAsync();
        }

        public async Task<List<Order>> ServiceOrdersAsync(string productName)
        {
            var id = await GetServiceProductIdAsync(productName);
            return await Db.Orders.Where(order => order.TableId == TableId && order.ProductId == id)
                .OrderBy(order => order.CreatedAt).ToListAsync();
        }

        private async Task<int> GetServiceProductIdAsync(string productName)
        {
            await CoworkingBilling.ProcessAsync(Db, Db.Tables.Find(TableId)!.OpenedAt!.Value);
            return await Db.Products.Where(product => product.Name == productName)
                .Select(product => product.Id).SingleAsync();
        }

        public async ValueTask DisposeAsync()
        {
            await Db.DisposeAsync();
            await connection.DisposeAsync();
        }
    }
}
