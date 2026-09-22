using GestionMesas.Api;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace GestionMesas.Api.Tests;

public sealed class CigaretteServiceTests
{
    [Fact]
    public async Task PurchaseIncreasesStockAndCloseCalculatesSales()
    {
        await using var fixture = await TestFixture.CreateAsync();
        var date = new DateOnly(2026, 9, 21);

        var purchase = await fixture.Service.CreatePurchaseAsync(
            new CreateCigarettePurchaseRequest(fixture.ProductId, 5, date, "morning"), default);
        var close = await fixture.Service.CloseShiftAsync(
            new CreateCigaretteShiftCloseRequest(date, "morning", [new CigaretteCloseItemRequest(fixture.ProductId, 8)]), default);

        Assert.Equal(5, purchase.Quantity);
        var item = Assert.Single(close.Items);
        Assert.Equal(10, item.InitialStock);
        Assert.Equal(5, item.PurchasedQuantity);
        Assert.Equal(7, item.SoldQuantity);
        Assert.Equal(24500m, item.SalesAmount);
        Assert.Equal(8, (await fixture.Db.CigaretteProducts.FindAsync(fixture.ProductId))!.Stock);
    }

    [Fact]
    public async Task RejectsSecondCloseForSameDateAndShift()
    {
        await using var fixture = await TestFixture.CreateAsync();
        var request = new CreateCigaretteShiftCloseRequest(
            new DateOnly(2026, 9, 21), "afternoon", [new CigaretteCloseItemRequest(fixture.ProductId, 9)]);
        await fixture.Service.CloseShiftAsync(request, default);

        var exception = await Assert.ThrowsAsync<CigaretteValidationException>(
            () => fixture.Service.CloseShiftAsync(request, default));

        Assert.Contains("ya fue cerrado", exception.Message);
    }

    [Fact]
    public async Task RejectsPurchaseForClosedShift()
    {
        await using var fixture = await TestFixture.CreateAsync();
        var date = new DateOnly(2026, 9, 21);
        await fixture.Service.CloseShiftAsync(
            new CreateCigaretteShiftCloseRequest(date, "morning", [new CigaretteCloseItemRequest(fixture.ProductId, 10)]), default);

        var exception = await Assert.ThrowsAsync<CigaretteValidationException>(() => fixture.Service.CreatePurchaseAsync(
            new CreateCigarettePurchaseRequest(fixture.ProductId, 2, date, "morning"), default));

        Assert.Contains("ya fue cerrado", exception.Message);
    }

    private sealed class TestFixture : IAsyncDisposable
    {
        private readonly SqliteConnection connection;

        private TestFixture(SqliteConnection connection, RestaurantContext db, int productId)
        {
            this.connection = connection;
            Db = db;
            ProductId = productId;
            Service = new CigaretteService(db);
        }

        public RestaurantContext Db { get; }
        public CigaretteService Service { get; }
        public int ProductId { get; }

        public static async Task<TestFixture> CreateAsync()
        {
            var connection = new SqliteConnection("Data Source=:memory:");
            await connection.OpenAsync();
            var options = new DbContextOptionsBuilder<RestaurantContext>().UseSqlite(connection).Options;
            var db = new RestaurantContext(options);
            await db.Database.EnsureCreatedAsync();
            var product = new CigaretteProduct
            {
                Name = "Marlboro Box",
                Price = 3500m,
                Stock = 10,
                CreatedAt = DateTime.UtcNow
            };
            db.CigaretteProducts.Add(product);
            await db.SaveChangesAsync();
            return new TestFixture(connection, db, product.Id);
        }

        public async ValueTask DisposeAsync()
        {
            await Db.DisposeAsync();
            await connection.DisposeAsync();
        }
    }
}
