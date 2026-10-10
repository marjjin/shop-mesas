using GestionMesas.Api;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace GestionMesas.Api.Tests;

public sealed class CigaretteServiceTests
{
    [Fact]
    public async Task CloseAccumulatesSupplierAllocations()
    {
        await using var fixture = await TestFixture.CreateAsync();
        var suppliers = new SupplierService(fixture.Db);
        var supplier = await suppliers.CreateAsync(new CreateSupplierRequest("Distribuidora Norte"), default);
        var date = new DateOnly(2026, 9, 21);

        await fixture.Service.CloseShiftAsync(new CreateCigaretteShiftCloseRequest(date, "morning",
            [new CigaretteCloseItemRequest(fixture.ProductId, 10)], [new SupplierAllocationRequest(supplier.Id, 1500m)]), default);
        var secondProduct = await fixture.Service.CreateProductAsync(new CreateCigaretteProductRequest("Camel", 3000m, 5), default);
        await fixture.Service.CloseShiftAsync(new CreateCigaretteShiftCloseRequest(date, "afternoon",
            [new CigaretteCloseItemRequest(fixture.ProductId, 10), new CigaretteCloseItemRequest(secondProduct.Id, 5)],
            [new SupplierAllocationRequest(supplier.Id, 2500m)]), default);

        var saved = Assert.Single(await suppliers.GetAllAsync(default));
        Assert.Equal(4000m, saved.Balance);
        Assert.Equal(2, saved.Transactions.Count(transaction => transaction.Type == "allocation"));
    }

    [Fact]
    public async Task PaymentDecrementsSupplierBalanceAndRejectsExcess()
    {
        await using var fixture = await TestFixture.CreateAsync();
        var service = new SupplierService(fixture.Db);
        var supplier = await service.CreateAsync(new CreateSupplierRequest("Proveedor Pago"), default);
        fixture.Db.Suppliers.Single(item => item.Id == supplier.Id).Balance = 3000m;
        await fixture.Db.SaveChangesAsync();

        var paid = await service.RecordPaymentAsync(supplier.Id, new CreateSupplierPaymentRequest(1200m, "Transferencia"), default);
        var exception = await Assert.ThrowsAsync<SupplierValidationException>(() =>
            service.RecordPaymentAsync(supplier.Id, new CreateSupplierPaymentRequest(2000m, null), default));

        Assert.Equal(1800m, paid.Balance);
        Assert.Contains("no puede ser mayor", exception.Message);
        Assert.Equal(1, await fixture.Db.SupplierTransactions.CountAsync(transaction => transaction.Type == "payment"));
    }

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
    public async Task RejectsProductStockBelowPurchasesFromOpenShifts()
    {
        await using var fixture = await TestFixture.CreateAsync();
        await fixture.Service.CreatePurchaseAsync(
            new CreateCigarettePurchaseRequest(fixture.ProductId, 5, new DateOnly(2026, 9, 21), "morning"), default);

        var exception = await Assert.ThrowsAsync<CigaretteValidationException>(() => fixture.Service.UpdateProductAsync(
            fixture.ProductId, new UpdateCigaretteProductRequest("Marlboro Box", 3500m, 4), default));

        Assert.Contains("compras en turnos aún abiertos", exception.Message);
    }

    [Fact]
    public async Task KeepsProductOrderWhenAProductIsRenamed()
    {
        await using var fixture = await TestFixture.CreateAsync();
        var secondProduct = new CigaretteProduct
        {
            Name = "Camel Box",
            Price = 3000m,
            Stock = 8,
            CreatedAt = DateTime.UtcNow.AddMinutes(1)
        };
        fixture.Db.CigaretteProducts.Add(secondProduct);
        await fixture.Db.SaveChangesAsync();

        await fixture.Service.UpdateProductAsync(
            secondProduct.Id, new UpdateCigaretteProductRequest("A Camel Box", 3000m, 8), default);

        var products = (await fixture.Service.GetDashboardAsync(new DateOnly(2026, 9, 21), default)).Products;
        Assert.Equal([fixture.ProductId, secondProduct.Id], products.Select(product => product.Id));
    }

    [Fact]
    public async Task OrdersProductsUsingTheSpreadsheetSequence()
    {
        await using var fixture = await TestFixture.CreateAsync();
        var chester = new CigaretteProduct { Name = "CHESTER 12", Price = 3000m, Stock = 8, CreatedAt = DateTime.UtcNow };
        var philip = new CigaretteProduct { Name = "PHILIP BOX 20", Price = 3000m, Stock = 8, CreatedAt = DateTime.UtcNow.AddMinutes(1) };
        fixture.Db.CigaretteProducts.AddRange(chester, philip);
        await fixture.Db.SaveChangesAsync();

        var products = (await fixture.Service.GetDashboardAsync(new DateOnly(2026, 9, 21), default)).Products;

        Assert.Equal([philip.Id, chester.Id, fixture.ProductId], products.Select(product => product.Id));
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
    public async Task ChangesPurchaseForClosedShiftAndRecalculatesClose()
    {
        await using var fixture = await TestFixture.CreateAsync();
        var date = new DateOnly(2026, 9, 21);
        var purchase = await fixture.Service.CreatePurchaseAsync(
            new CreateCigarettePurchaseRequest(fixture.ProductId, 5, date, "morning"), default);
        await fixture.Service.CloseShiftAsync(
            new CreateCigaretteShiftCloseRequest(date, "morning", [new CigaretteCloseItemRequest(fixture.ProductId, 12)]), default);

        await fixture.Service.UpdatePurchaseAsync(purchase.Id, new UpdateCigarettePurchaseRequest(3), default);

        var close = Assert.Single((await fixture.Service.GetDashboardAsync(date, default)).Closes);
        var item = Assert.Single(close.Items);
        Assert.Equal(3, item.PurchasedQuantity);
        Assert.Equal(1, item.SoldQuantity);
        Assert.Equal(3500m, item.SalesAmount);
        Assert.Equal(12, (await fixture.Db.CigaretteProducts.FindAsync(fixture.ProductId))!.Stock);
    }

    [Fact]
    public async Task DeletesPurchaseForClosedShiftAndRecalculatesClose()
    {
        await using var fixture = await TestFixture.CreateAsync();
        var date = new DateOnly(2026, 9, 21);
        var purchase = await fixture.Service.CreatePurchaseAsync(
            new CreateCigarettePurchaseRequest(fixture.ProductId, 5, date, "morning"), default);
        await fixture.Service.CloseShiftAsync(
            new CreateCigaretteShiftCloseRequest(date, "morning", [new CigaretteCloseItemRequest(fixture.ProductId, 10)]), default);

        await fixture.Service.DeletePurchaseAsync(purchase.Id, default);

        var close = Assert.Single((await fixture.Service.GetDashboardAsync(date, default)).Closes);
        var item = Assert.Single(close.Items);
        Assert.Equal(0, item.PurchasedQuantity);
        Assert.Equal(0, item.SoldQuantity);
        Assert.Equal(0m, item.SalesAmount);
        Assert.Equal(10, (await fixture.Db.CigaretteProducts.FindAsync(fixture.ProductId))!.Stock);
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

    [Fact]
    public async Task KeepsHistoricalClosesVisibleWhenTheirCafeteriaSummaryCannotBeLoaded()
    {
        await using var fixture = await TestFixture.CreateAsync();
        var service = new CigaretteService(fixture.Db, new FailingCafeteriaService());
        var date = new DateOnly(2026, 9, 21);

        var created = await service.CloseShiftAsync(
            new CreateCigaretteShiftCloseRequest(date, "morning", [new CigaretteCloseItemRequest(fixture.ProductId, 8)]), default);
        var closes = await service.GetClosesAsync(date, date, default);

        var close = Assert.Single(closes);
        Assert.Equal(created.Id, close.Id);
        Assert.Equal(0, close.Cafeteria.SaleCount);
        Assert.Equal(0m, close.Cafeteria.TotalSales);
    }

    [Fact]
    public async Task LoadsBothShiftClosesForTheSameDate()
    {
        await using var fixture = await TestFixture.CreateAsync();
        var date = new DateOnly(2026, 9, 21);

        await fixture.Service.CloseShiftAsync(
            new CreateCigaretteShiftCloseRequest(date, "morning", [new CigaretteCloseItemRequest(fixture.ProductId, 9)]), default);
        await fixture.Service.CloseShiftAsync(
            new CreateCigaretteShiftCloseRequest(date, "afternoon", [new CigaretteCloseItemRequest(fixture.ProductId, 8)]), default);

        var closes = await fixture.Service.GetClosesAsync(date, date, default);

        Assert.Equal(["morning", "afternoon"], closes.Select(close => close.Shift));
    }

    private sealed class FailingCafeteriaService : ICafeteriaService
    {
        public Task<CafeteriaDashboardResponse> GetDashboardAsync(DateOnly date, CancellationToken cancellationToken) => throw new NotSupportedException();
        public Task<CafeteriaDashboardResponse> RegisterSaleAsync(DateOnly date, CancellationToken cancellationToken) => throw new NotSupportedException();
        public Task<CafeteriaProductResponse> CreateProductAsync(CreateCafeteriaProductRequest request, CancellationToken cancellationToken) => throw new NotSupportedException();
        public Task<CafeteriaProductResponse?> UpdateProductAsync(int id, UpdateCafeteriaProductRequest request, CancellationToken cancellationToken) => throw new NotSupportedException();
        public Task<bool> DeleteProductAsync(int id, CancellationToken cancellationToken) => throw new NotSupportedException();
        public Task<CafeteriaSalesSummaryResponse> GetSummaryAsync(DateOnly businessDate, string shift, CancellationToken cancellationToken) => throw new InvalidOperationException("Resumen no disponible.");
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
