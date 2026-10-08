using GestionMesas.Api;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace GestionMesas.Api.Tests;

public sealed class CafeteriaServiceTests
{
    [Fact]
    public async Task RegisterSaleAddsEveryActiveProductAndPreservesTheSoldPrice()
    {
        await using var fixture = await TestFixture.CreateAsync();
        var date = new DateOnly(2026, 10, 7);
        var cafe = await fixture.Service.CreateProductAsync(new CreateCafeteriaProductRequest("Café", 2500m), default);
        var medialuna = await fixture.Service.CreateProductAsync(new CreateCafeteriaProductRequest("Medialuna", 500m), default);

        var sale = await fixture.Service.RegisterSaleAsync(date, default);
        await fixture.Service.UpdateProductAsync(cafe.Id, new UpdateCafeteriaProductRequest("Café", 3000m), default);
        var summary = await fixture.Service.GetSummaryAsync(date, null, null, default);

        Assert.Equal(1, sale.Summary.SaleCount);
        Assert.Equal(3000m, sale.Summary.TotalSales);
        Assert.Equal(2, sale.Summary.Items.Sum(item => item.Quantity));
        Assert.Equal(3000m, summary.TotalSales);
        Assert.Contains(summary.Items, item => item.ProductName == "Café" && item.UnitPrice == 2500m && item.Quantity == 1);
        Assert.Contains(summary.Items, item => item.ProductName == "Medialuna" && item.UnitPrice == 500m && item.Quantity == 1);
        Assert.Equal(2, (await fixture.Db.CafeteriaSaleItems.CountAsync()));
        Assert.NotEqual(0, medialuna.Id);
    }

    [Fact]
    public async Task DashboardStartsFromTheLatestShiftClose()
    {
        await using var fixture = await TestFixture.CreateAsync();
        var date = new DateOnly(2026, 10, 7);
        var product = await fixture.Service.CreateProductAsync(new CreateCafeteriaProductRequest("Café", 2500m), default);
        var morningSale = new CafeteriaSale { CreatedAt = date.ToDateTime(new TimeOnly(9, 0), DateTimeKind.Utc) };
        morningSale.Items.Add(new CafeteriaSaleItem { CafeteriaProductId = product.Id, ProductName = product.Name, UnitPrice = product.Price });
        fixture.Db.CafeteriaSales.Add(morningSale);
        fixture.Db.CigaretteShiftCloses.Add(new CigaretteShiftClose { BusinessDate = date, Shift = "morning", ClosedAt = date.ToDateTime(new TimeOnly(12, 0), DateTimeKind.Utc) });
        var afternoonSale = new CafeteriaSale { CreatedAt = date.ToDateTime(new TimeOnly(14, 0), DateTimeKind.Utc) };
        afternoonSale.Items.Add(new CafeteriaSaleItem { CafeteriaProductId = product.Id, ProductName = product.Name, UnitPrice = product.Price });
        fixture.Db.CafeteriaSales.Add(afternoonSale);
        await fixture.Db.SaveChangesAsync();

        var dashboard = await fixture.Service.GetDashboardAsync(date, default);

        Assert.Equal(1, dashboard.Summary.SaleCount);
        Assert.Equal(2500m, dashboard.Summary.TotalSales);
        Assert.Equal(1, Assert.Single(dashboard.Summary.Items).Quantity);
    }

    private sealed class TestFixture : IAsyncDisposable
    {
        private readonly SqliteConnection connection;

        private TestFixture(SqliteConnection connection, RestaurantContext db)
        {
            this.connection = connection;
            Db = db;
            Service = new CafeteriaService(db);
        }

        public RestaurantContext Db { get; }
        public CafeteriaService Service { get; }

        public static async Task<TestFixture> CreateAsync()
        {
            var connection = new SqliteConnection("Data Source=:memory:");
            await connection.OpenAsync();
            var options = new DbContextOptionsBuilder<RestaurantContext>().UseSqlite(connection).Options;
            var db = new RestaurantContext(options);
            await db.Database.EnsureCreatedAsync();
            return new TestFixture(connection, db);
        }

        public async ValueTask DisposeAsync()
        {
            await Db.DisposeAsync();
            await connection.DisposeAsync();
        }
    }
}
