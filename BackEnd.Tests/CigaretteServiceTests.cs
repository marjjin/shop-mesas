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

    [Fact]
    public async Task RecreatesDeletedProductWithSameName()
    {
        await using var fixture = await TestFixture.CreateAsync();

        await fixture.Service.DeleteProductAsync(fixture.ProductId, default);
        var recreated = await fixture.Service.CreateProductAsync(
            new CreateCigaretteProductRequest("Marlboro Box", 4200m, 15), default);

        Assert.Equal(fixture.ProductId, recreated.Id);
        Assert.Equal(4200m, recreated.Price);
        Assert.Equal(15, recreated.Stock);
        Assert.True((await fixture.Db.CigaretteProducts.FindAsync(fixture.ProductId))!.IsActive);
    }

    [Fact]
    public async Task UpdatesProductStock()
    {
        await using var fixture = await TestFixture.CreateAsync();

        var updated = await fixture.Service.UpdateProductAsync(
            fixture.ProductId, new UpdateCigaretteProductRequest("Marlboro Box", 3500m, 24), default);

        Assert.NotNull(updated);
        Assert.Equal(24, updated.Stock);
        Assert.Equal(24, (await fixture.Db.CigaretteProducts.FindAsync(fixture.ProductId))!.Stock);
    }

    [Fact]
    public async Task UpdatesPurchaseAndAdjustsStockByDifference()
    {
        await using var fixture = await TestFixture.CreateAsync();
        var purchase = await fixture.Service.CreatePurchaseAsync(
            new CreateCigarettePurchaseRequest(fixture.ProductId, 5, new DateOnly(2026, 9, 21), "morning"), default);

        var updated = await fixture.Service.UpdatePurchaseAsync(purchase.Id, new UpdateCigarettePurchaseRequest(2), default);

        Assert.Equal(2, updated!.Quantity);
        Assert.Equal(12, (await fixture.Db.CigaretteProducts.FindAsync(fixture.ProductId))!.Stock);
    }

    [Fact]
    public async Task DeletesPurchaseAndRestoresStock()
    {
        await using var fixture = await TestFixture.CreateAsync();
        var purchase = await fixture.Service.CreatePurchaseAsync(
            new CreateCigarettePurchaseRequest(fixture.ProductId, 5, new DateOnly(2026, 9, 21), "morning"), default);

        var deleted = await fixture.Service.DeletePurchaseAsync(purchase.Id, default);

        Assert.True(deleted);
        Assert.Equal(10, (await fixture.Db.CigaretteProducts.FindAsync(fixture.ProductId))!.Stock);
        Assert.Null(await fixture.Db.CigarettePurchases.FindAsync(purchase.Id));
    }

    [Fact]
    public async Task RejectsPurchaseChangesForClosedShift()
    {
        await using var fixture = await TestFixture.CreateAsync();
        var date = new DateOnly(2026, 9, 21);
        var purchase = await fixture.Service.CreatePurchaseAsync(
            new CreateCigarettePurchaseRequest(fixture.ProductId, 5, date, "morning"), default);
        await fixture.Service.CloseShiftAsync(
            new CreateCigaretteShiftCloseRequest(date, "morning", [new CigaretteCloseItemRequest(fixture.ProductId, 15)]), default);

        var updateException = await Assert.ThrowsAsync<CigaretteValidationException>(
            () => fixture.Service.UpdatePurchaseAsync(purchase.Id, new UpdateCigarettePurchaseRequest(3), default));
        var deleteException = await Assert.ThrowsAsync<CigaretteValidationException>(
            () => fixture.Service.DeletePurchaseAsync(purchase.Id, default));

        Assert.Contains("ya fue cerrado", updateException.Message);
        Assert.Contains("ya fue cerrado", deleteException.Message);
    }

    [Fact]
    public async Task CorrectsCloseAndAdjustsStockAndSales()
    {
        await using var fixture = await TestFixture.CreateAsync();
        var close = await fixture.Service.CloseShiftAsync(
            new CreateCigaretteShiftCloseRequest(new DateOnly(2026, 9, 21), "morning", [new CigaretteCloseItemRequest(fixture.ProductId, 8)]), default);

        var corrected = await fixture.Service.UpdateCloseAsync(
            close.Id, new UpdateCigaretteShiftCloseRequest([new CigaretteCloseItemRequest(fixture.ProductId, 6)]), default);

        var item = Assert.Single(corrected!.Items);
        Assert.Equal(6, item.FinalStock);
        Assert.Equal(4, item.SoldQuantity);
        Assert.Equal(14000m, item.SalesAmount);
        Assert.Equal(4, corrected.TotalSold);
        Assert.Equal(14000m, corrected.TotalSales);
        Assert.Equal(6, (await fixture.Db.CigaretteProducts.FindAsync(fixture.ProductId))!.Stock);
    }

    [Fact]
    public async Task RejectsCloseCorrectionWithDifferentProducts()
    {
        await using var fixture = await TestFixture.CreateAsync();
        var close = await fixture.Service.CloseShiftAsync(
            new CreateCigaretteShiftCloseRequest(new DateOnly(2026, 9, 21), "morning", [new CigaretteCloseItemRequest(fixture.ProductId, 8)]), default);

        var exception = await Assert.ThrowsAsync<CigaretteValidationException>(() => fixture.Service.UpdateCloseAsync(
            close.Id, new UpdateCigaretteShiftCloseRequest([]), default));

        Assert.Contains("cada cigarrillo", exception.Message);
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
