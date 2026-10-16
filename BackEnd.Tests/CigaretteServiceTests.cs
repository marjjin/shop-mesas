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
            [new CigaretteCloseItemRequest(fixture.ProductId, 10)], [new SupplierAllocationRequest(supplier.Id, 1000m, 500m)]), default);
        var secondProduct = await fixture.Service.CreateProductAsync(new CreateCigaretteProductRequest("Camel", 3000m, 5), default);
        await fixture.Service.CloseShiftAsync(new CreateCigaretteShiftCloseRequest(date, "afternoon",
            [new CigaretteCloseItemRequest(fixture.ProductId, 10), new CigaretteCloseItemRequest(secondProduct.Id, 5)],
            [new SupplierAllocationRequest(supplier.Id, 1500m, 1000m)]), default);

        var saved = Assert.Single(await suppliers.GetAllAsync(default));
        Assert.Equal(4000m, saved.ReservedBalance);
        Assert.Equal(2500m, saved.ReservedCashBalance);
        Assert.Equal(1500m, saved.ReservedMercadoPagoBalance);
        Assert.Equal(0m, saved.CurrentAccountBalance);
        Assert.Equal(2, saved.Transactions.Count(transaction => transaction.Type == "allocation"));
    }

    [Fact]
    public async Task CloseStoresEndingCashAndMercadoPagoBalances()
    {
        await using var fixture = await TestFixture.CreateAsync();
        var date = new DateOnly(2026, 9, 21);

        var close = await fixture.Service.CloseShiftAsync(
            new CreateCigaretteShiftCloseRequest(date, "morning", [new CigaretteCloseItemRequest(fixture.ProductId, 8)],
                EndingCashBalance: 14500m, EndingMercadoPagoBalance: 6200m, NextShiftChangeCash: 3000m, ReceivedChangeCash: 2500m, PosnetTotal: 4800m), default);

        Assert.Equal(14500m, close.EndingCashBalance);
        Assert.Equal(6200m, close.EndingMercadoPagoBalance);
        Assert.Equal(3000m, close.NextShiftChangeCash);
        Assert.Equal(2500m, close.ReceivedChangeCash);
        Assert.Equal(4800m, close.PosnetTotal);
        var saved = await fixture.Db.CigaretteShiftCloses.SingleAsync();
        Assert.Equal(14500m, saved.EndingCashBalance);
        Assert.Equal(6200m, saved.EndingMercadoPagoBalance);
        Assert.Equal(3000m, saved.NextShiftChangeCash);
        Assert.Equal(2500m, saved.ReceivedChangeCash);
        Assert.Equal(4800m, saved.PosnetTotal);
    }

    [Fact]
    public async Task CashDropsAreAssignedToTheCloseAndIncludedInTheArqueo()
    {
        await using var fixture = await TestFixture.CreateAsync();
        var date = new DateOnly(2026, 9, 21);
        var cashDrops = new CashDropService(fixture.Db);

        await cashDrops.CreateAsync(new CreateCashDropRequest(3500m, date, "morning"), default);
        var close = await fixture.Service.CloseShiftAsync(
            new CreateCigaretteShiftCloseRequest(date, "morning", [new CigaretteCloseItemRequest(fixture.ProductId, 8)], EndingCashBalance: 12000m), default);

        Assert.Equal(3500m, close.CashDropsTotal);
        Assert.Equal(3500m, Assert.Single(close.CashDrops).Amount);
        Assert.Equal(close.Id, (await fixture.Db.CashDrops.SingleAsync()).CigaretteShiftCloseId);
    }

    [Fact]
    public async Task CashDropsCanBeUpdatedAndDeletedAfterTheClose()
    {
        await using var fixture = await TestFixture.CreateAsync();
        var date = new DateOnly(2026, 9, 21);
        var cashDrops = new CashDropService(fixture.Db);
        var created = await cashDrops.CreateAsync(new CreateCashDropRequest(3500m, date, "morning"), default);

        var updated = await cashDrops.UpdateAsync(created.Id, new UpdateCashDropRequest(4000m), default);
        Assert.Equal(4000m, updated!.Amount);

        await fixture.Service.CloseShiftAsync(
            new CreateCigaretteShiftCloseRequest(date, "morning", [new CigaretteCloseItemRequest(fixture.ProductId, 8)]), default);
        var afterClose = await cashDrops.UpdateAsync(created.Id, new UpdateCashDropRequest(4500m), default);
        Assert.Equal(4500m, afterClose!.Amount);
        Assert.True(await cashDrops.DeleteAsync(created.Id, default));
        Assert.Empty(await fixture.Db.CashDrops.ToListAsync());
    }

    [Fact]
    public async Task PaymentDecrementsSupplierBalanceAndRejectsExcess()
    {
        await using var fixture = await TestFixture.CreateAsync();
        var service = new SupplierService(fixture.Db);
        var supplier = await service.CreateAsync(new CreateSupplierRequest("Proveedor Pago"), default);
        var savedSupplier = fixture.Db.Suppliers.Single(item => item.Id == supplier.Id);
        savedSupplier.CurrentAccountBalance = 3000m;
        savedSupplier.ReservedBalance = 3000m;
        savedSupplier.ReservedCashBalance = 1000m;
        savedSupplier.ReservedMercadoPagoBalance = 2000m;
        await fixture.Db.SaveChangesAsync();

        var paid = await service.RecordPaymentAsync(supplier.Id, new CreateSupplierPaymentRequest(700m, 500m, "Transferencia"), default);
        var exception = await Assert.ThrowsAsync<SupplierValidationException>(() =>
            service.RecordPaymentAsync(supplier.Id, new CreateSupplierPaymentRequest(2000m, 0m, null), default));

        Assert.Equal(1800m, paid.CurrentAccountBalance);
        Assert.Equal(1800m, paid.ReservedBalance);
        Assert.Equal(300m, paid.ReservedCashBalance);
        Assert.Equal(1500m, paid.ReservedMercadoPagoBalance);
        Assert.Contains("no puede ser mayor", exception.Message);
        Assert.Equal(1, await fixture.Db.SupplierTransactions.CountAsync(transaction => transaction.Type == "payment"));
    }

    [Fact]
    public async Task PurchaseOnAccountIncreasesSupplierBalanceWithoutChangingStock()
    {
        await using var fixture = await TestFixture.CreateAsync();
        var service = new SupplierService(fixture.Db);
        var supplier = await service.CreateAsync(new CreateSupplierRequest("Proveedor Cuenta Corriente"), default);

        var updated = await service.RecordPurchaseAsync(
            supplier.Id, new CreateSupplierPurchaseRequest(2400m, "Compra semanal", "account"), default);

        Assert.Equal(2400m, updated.CurrentAccountBalance);
        Assert.Equal(0m, updated.ReservedBalance);
        var transaction = Assert.Single(updated.Transactions);
        Assert.Equal("purchase", transaction.Type);
        Assert.Equal("Compra semanal", transaction.Note);
        Assert.Equal(10, (await fixture.Db.CigaretteProducts.FindAsync(fixture.ProductId))!.Stock);
    }

    [Fact]
    public async Task CashPurchaseUsesReservedFundsWithoutIncreasingCurrentAccount()
    {
        await using var fixture = await TestFixture.CreateAsync();
        var service = new SupplierService(fixture.Db);
        var supplier = await service.CreateAsync(new CreateSupplierRequest("Proveedor Contado"), default);
        var savedSupplier = fixture.Db.Suppliers.Single(item => item.Id == supplier.Id);
        savedSupplier.ReservedBalance = 3000m;
        savedSupplier.ReservedCashBalance = 3000m;
        await fixture.Db.SaveChangesAsync();

        var updated = await service.RecordPurchaseAsync(
            supplier.Id, new CreateSupplierPurchaseRequest(1200m, "Compra al contado", "reserved", 1200m, 0m), default);

        Assert.Equal(1800m, updated.ReservedBalance);
        Assert.Equal(0m, updated.CurrentAccountBalance);
        Assert.Equal("reserved_purchase", Assert.Single(updated.Transactions).Type);
    }

    [Fact]
    public async Task ReservedFundsTransferMovesBalanceAndRecordsBothMovements()
    {
        await using var fixture = await TestFixture.CreateAsync();
        var service = new SupplierService(fixture.Db);
        var source = await service.CreateAsync(new CreateSupplierRequest("Proveedor Origen"), default);
        var target = await service.CreateAsync(new CreateSupplierRequest("Proveedor Destino"), default);
        var sourceBalances = fixture.Db.Suppliers.Single(supplier => supplier.Id == source.Id);
        sourceBalances.ReservedBalance = 5000m;
        sourceBalances.ReservedCashBalance = 5000m;
        await fixture.Db.SaveChangesAsync();

        await service.TransferReservedFundsAsync(
            new CreateSupplierReservedFundsTransferRequest(source.Id, target.Id, 1750m, 0m, "Compra compartida"), default);

        var suppliers = await service.GetAllAsync(default);
        Assert.Equal(3250m, suppliers.Single(supplier => supplier.Id == source.Id).ReservedBalance);
        Assert.Equal(1750m, suppliers.Single(supplier => supplier.Id == target.Id).ReservedBalance);
        Assert.Equal("reserved_transfer_out", Assert.Single(suppliers.Single(supplier => supplier.Id == source.Id).Transactions).Type);
        Assert.Equal("reserved_transfer_in", Assert.Single(suppliers.Single(supplier => supplier.Id == target.Id).Transactions).Type);
    }

    [Fact]
    public async Task MercadoPagoPurchaseAndTransferKeepTheirReservedSplit()
    {
        await using var fixture = await TestFixture.CreateAsync();
        var service = new SupplierService(fixture.Db);
        var source = await service.CreateAsync(new CreateSupplierRequest("Proveedor MP"), default);
        var target = await service.CreateAsync(new CreateSupplierRequest("Proveedor destino MP"), default);
        var saved = fixture.Db.Suppliers.Single(supplier => supplier.Id == source.Id);
        saved.ReservedCashBalance = 1000m;
        saved.ReservedMercadoPagoBalance = 3000m;
        saved.ReservedBalance = 4000m;
        await fixture.Db.SaveChangesAsync();

        var afterPurchase = await service.RecordPurchaseAsync(source.Id,
            new CreateSupplierPurchaseRequest(1200m, null, "reserved", 200m, 1000m), default);
        await service.TransferReservedFundsAsync(
            new CreateSupplierReservedFundsTransferRequest(source.Id, target.Id, 300m, 500m, null), default);

        Assert.Equal(800m, afterPurchase.ReservedCashBalance);
        Assert.Equal(2000m, afterPurchase.ReservedMercadoPagoBalance);
        var suppliers = await service.GetAllAsync(default);
        Assert.Equal(500m, suppliers.Single(supplier => supplier.Id == source.Id).ReservedCashBalance);
        Assert.Equal(1500m, suppliers.Single(supplier => supplier.Id == source.Id).ReservedMercadoPagoBalance);
        Assert.Equal(300m, suppliers.Single(supplier => supplier.Id == target.Id).ReservedCashBalance);
        Assert.Equal(500m, suppliers.Single(supplier => supplier.Id == target.Id).ReservedMercadoPagoBalance);
    }

    [Fact]
    public async Task UpdatingSupplierBalancesRecordsAdjustments()
    {
        await using var fixture = await TestFixture.CreateAsync();
        var service = new SupplierService(fixture.Db);
        var supplier = await service.CreateAsync(new CreateSupplierRequest("Proveedor Ajustes"), default);

        var updated = await service.UpdateBalancesAsync(
            supplier.Id, new UpdateSupplierBalancesRequest(3000m, 0m, 1200m, "Saldos iniciales"), default);

        Assert.NotNull(updated);
        Assert.Equal(3000m, updated.ReservedBalance);
        Assert.Equal(1200m, updated.CurrentAccountBalance);
        Assert.Contains(updated.Transactions, transaction => transaction.Type == "reserved_adjustment" && transaction.Amount == 3000m);
        Assert.Contains(updated.Transactions, transaction => transaction.Type == "current_account_adjustment" && transaction.Amount == 1200m);
    }

    [Fact]
    public async Task RecreatesDeactivatedSupplierWithSameName()
    {
        await using var fixture = await TestFixture.CreateAsync();
        var service = new SupplierService(fixture.Db);
        var original = await service.CreateAsync(new CreateSupplierRequest("Distribuidora Centro"), default);

        Assert.True(await service.DeactivateAsync(original.Id, default));
        var reactivated = await service.CreateAsync(new CreateSupplierRequest("distribuidora centro"), default);

        Assert.Equal(original.Id, reactivated.Id);
        Assert.True(reactivated.IsActive);
        Assert.Equal(1, await fixture.Db.Suppliers.CountAsync());
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
        public Task<IReadOnlyList<CafeteriaShiftSalesHistoryResponse>> GetShiftHistoryAsync(DateOnly date, CancellationToken cancellationToken) => throw new NotSupportedException();
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
