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
    public async Task ManualSupplierTransactionCanBeUpdatedAndDeleted()
    {
        await using var fixture = await TestFixture.CreateAsync();
        var service = new SupplierService(fixture.Db);
        var supplier = await service.CreateAsync(new CreateSupplierRequest("Proveedor Movimiento"), default);
        var savedSupplier = fixture.Db.Suppliers.Single(item => item.Id == supplier.Id);
        savedSupplier.ReservedBalance = 4000m;
        savedSupplier.ReservedCashBalance = 3000m;
        savedSupplier.ReservedMercadoPagoBalance = 1000m;
        await fixture.Db.SaveChangesAsync();

        var created = await service.RecordPurchaseAsync(
            supplier.Id, new CreateSupplierPurchaseRequest(1000m, "Compra original", "reserved", 1000m, 0m), default);
        var transaction = Assert.Single(created.Transactions);

        var updated = await service.UpdateTransactionAsync(
            supplier.Id, transaction.Id, new UpdateSupplierTransactionRequest(1500m, 500m, 1000m, "Compra corregida"), default);

        Assert.NotNull(updated);
        Assert.Equal(2500m, updated!.ReservedBalance);
        Assert.Equal(2500m, updated.ReservedCashBalance);
        Assert.Equal(0m, updated.ReservedMercadoPagoBalance);
        Assert.Equal("Compra corregida", Assert.Single(updated.Transactions).Note);

        var deleted = await service.DeleteTransactionAsync(supplier.Id, transaction.Id, default);

        Assert.NotNull(deleted);
        Assert.Equal(4000m, deleted!.ReservedBalance);
        Assert.Empty(deleted.Transactions);
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
    public async Task MovesCloseAndRelatedRecordsToAnotherBusinessDate()
    {
        await using var fixture = await TestFixture.CreateAsync();
        var sourceDate = new DateOnly(2026, 9, 21);
        var targetDate = new DateOnly(2026, 9, 22);
        var supplierService = new SupplierService(fixture.Db);
        var cashDropService = new CashDropService(fixture.Db);
        var supplier = await supplierService.CreateAsync(new CreateSupplierRequest("Proveedor Fecha"), default);
        await cashDropService.CreateAsync(new CreateCashDropRequest(3500m, sourceDate, "morning"), default);
        await fixture.Service.CreatePurchaseAsync(new CreateCigarettePurchaseRequest(fixture.ProductId, 2, sourceDate, "morning"), default);
        var cafeteriaSale = new CafeteriaSale { BusinessDate = sourceDate, Shift = "morning", CreatedAt = DateTime.UtcNow };
        cafeteriaSale.Items.Add(new CafeteriaSaleItem { ProductName = "Café", UnitPrice = 3000m });
        fixture.Db.CafeteriaSales.Add(cafeteriaSale);
        await fixture.Db.SaveChangesAsync();

        var close = await fixture.Service.CloseShiftAsync(
            new CreateCigaretteShiftCloseRequest(sourceDate, "morning", [new CigaretteCloseItemRequest(fixture.ProductId, 8)],
                [new SupplierAllocationRequest(supplier.Id, 1000m, 0m)]), default);

        var moved = await fixture.Service.UpdateCloseAsync(
            close.Id, new UpdateCigaretteShiftCloseRequest([new CigaretteCloseItemRequest(fixture.ProductId, 8)], BusinessDate: targetDate, Shift: "afternoon"), default);

        Assert.Equal(targetDate, moved!.BusinessDate);
        Assert.Equal("afternoon", moved.Shift);
        Assert.Equal(1, moved.Cafeteria.SaleCount);
        Assert.Equal(3000m, moved.Cafeteria.TotalSales);
        Assert.Equal(targetDate, (await fixture.Db.CigarettePurchases.SingleAsync()).BusinessDate);
        Assert.Equal("afternoon", (await fixture.Db.CigarettePurchases.SingleAsync()).Shift);
        Assert.Equal(targetDate, (await fixture.Db.CashDrops.SingleAsync()).BusinessDate);
        Assert.Equal("afternoon", (await fixture.Db.CashDrops.SingleAsync()).Shift);
        Assert.Equal(targetDate, (await fixture.Db.SupplierTransactions.SingleAsync()).BusinessDate);
        Assert.Equal(targetDate, (await fixture.Db.CafeteriaSales.SingleAsync()).BusinessDate);
        Assert.Equal("afternoon", (await fixture.Db.CafeteriaSales.SingleAsync()).Shift);
        var sourceDashboard = await fixture.Service.GetDashboardAsync(sourceDate, default);
        Assert.Empty(sourceDashboard.Closes);
        Assert.Empty(sourceDashboard.Purchases);
        Assert.Empty(sourceDashboard.CashDrops);
        Assert.Empty(await fixture.Db.CafeteriaSales.Where(sale => sale.BusinessDate == sourceDate && sale.Shift == "morning").ToListAsync());
        Assert.Equal(close.Id, Assert.Single((await fixture.Service.GetDashboardAsync(targetDate, default)).Closes).Id);
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

    [Fact]
    public async Task MovingAfterMidnightClosePreservesInventoryAndReopensOriginalMorning()
    {
        await using var fixture = await TestFixture.CreateAsync();
        var sourceDate = new DateOnly(2026, 10, 17);
        var targetDate = sourceDate.AddDays(-1);
        var product = await fixture.Db.CigaretteProducts.FindAsync(fixture.ProductId);
        product!.Stock = 29;
        var sale = new CafeteriaSale { BusinessDate = sourceDate, Shift = "morning", CreatedAt = DateTime.UtcNow };
        sale.Items.Add(new CafeteriaSaleItem { ProductName = "Café", UnitPrice = 3000m });
        fixture.Db.CafeteriaSales.Add(sale);
        await fixture.Db.SaveChangesAsync();
        var drops = new CashDropService(fixture.Db);
        await drops.CreateAsync(new CreateCashDropRequest(1000m, sourceDate, "morning"), default);
        var original = await fixture.Service.CloseShiftAsync(
            new CreateCigaretteShiftCloseRequest(sourceDate, "morning", [new CigaretteCloseItemRequest(fixture.ProductId, 27)]), default);

        await fixture.Service.UpdateCloseAsync(original.Id,
            new UpdateCigaretteShiftCloseRequest([new CigaretteCloseItemRequest(fixture.ProductId, 27)], BusinessDate: targetDate, Shift: "afternoon"), default);
        fixture.Db.ChangeTracker.Clear();

        var moved = Assert.Single((await fixture.Service.GetDashboardAsync(targetDate, default)).Closes);
        Assert.Equal(original.Id, moved.Id);
        var item = Assert.Single(moved.Items);
        Assert.Equal(29, item.InitialStock);
        Assert.Equal(27, item.FinalStock);
        Assert.Equal(2, item.SoldQuantity);
        Assert.Equal(27, (await fixture.Db.CigaretteProducts.FindAsync(fixture.ProductId))!.Stock);
        Assert.Equal(3000m, moved.Cafeteria.TotalSales);
        Assert.Single(moved.CashDrops);
        Assert.Empty((await fixture.Service.GetDashboardAsync(sourceDate, default)).Closes);
        Assert.Equal(0, (await new CafeteriaService(fixture.Db).GetSummaryAsync(sourceDate, "morning", default)).SaleCount);
        Assert.Equal("morning", (await drops.GetOpenAsync(sourceDate, default)).Shift);
        var newDrop = await drops.CreateAsync(new CreateCashDropRequest(500m, sourceDate, "morning"), default);
        Assert.False(newDrop.IsClosed);
    }

    [Fact]
    public async Task ConsolidationPreservesBothCafeteriaDatesPurchasesCashAndCurrentStock()
    {
        await using var fixture = await TestFixture.CreateAsync();
        var morning = new DateOnly(2026, 10, 17);
        var afternoon = morning.AddDays(-1);
        var product = await fixture.Db.CigaretteProducts.FindAsync(fixture.ProductId);
        product!.Stock = 29;
        await fixture.Db.SaveChangesAsync();
        var original = await fixture.Service.CloseShiftAsync(new CreateCigaretteShiftCloseRequest(morning, "morning", [new CigaretteCloseItemRequest(product.Id, 27)]), default);
        await fixture.Service.CreatePurchaseAsync(new CreateCigarettePurchaseRequest(product.Id, 2, afternoon, "afternoon"), default);
        var drops = new CashDropService(fixture.Db);
        await drops.CreateAsync(new CreateCashDropRequest(210000m, afternoon, "afternoon"), default);
        var supplier = await new SupplierService(fixture.Db).CreateAsync(new CreateSupplierRequest("Proveedor"), default);
        var duplicate = await fixture.Service.CloseShiftAsync(new CreateCigaretteShiftCloseRequest(afternoon, "afternoon", [new CigaretteCloseItemRequest(product.Id, 29)], [new SupplierAllocationRequest(supplier.Id, 1000m, 0m)]), default);
        foreach (var (date, shift, count) in new[] { (afternoon, "afternoon", 13), (morning, "morning", 16) })
            for (var i = 0; i < count; i++)
            {
                var sale = new CafeteriaSale { BusinessDate = date, Shift = shift, CreatedAt = DateTime.UtcNow.AddDays(-1) };
                sale.Items.Add(new CafeteriaSaleItem { ProductName = "Café", UnitPrice = 2000m });
                fixture.Db.CafeteriaSales.Add(sale);
            }
        await fixture.Db.SaveChangesAsync();

        var repaired = await fixture.Service.ConsolidateCloseAsync(original.Id, duplicate.Id, default);
        fixture.Db.ChangeTracker.Clear();

        Assert.Equal(duplicate.Id, repaired!.Id);
        var item = Assert.Single(repaired.Items);
        Assert.Equal(29, item.InitialStock);
        Assert.Equal(2, item.PurchasedQuantity);
        Assert.Equal(29, item.FinalStock);
        Assert.Equal(2, item.SoldQuantity);
        Assert.Equal(original.TotalSales, repaired.TotalSales);
        Assert.Equal(29, (await fixture.Db.CigaretteProducts.FindAsync(product.Id))!.Stock);
        Assert.Equal(210000m, repaired.CashDropsTotal);
        Assert.Equal(1000m, Assert.Single(repaired.SupplierAllocations).Amount);
        Assert.Equal(1000m, (await fixture.Db.Suppliers.FindAsync(supplier.Id))!.ReservedBalance);
        Assert.Equal(26000m, repaired.Cafeteria.TotalSales);
        Assert.Single(await fixture.Db.CigarettePurchases.ToListAsync());
        Assert.Empty((await fixture.Service.GetDashboardAsync(morning, default)).Closes);
        var cafeteria = await new CafeteriaService(fixture.Db).GetDashboardAsync(morning, default);
        Assert.Equal("morning", cafeteria.ActiveShift);
        Assert.Equal(16, cafeteria.Summary.SaleCount);
        Assert.Equal(32000m, cafeteria.Summary.TotalSales);
        Assert.False((await drops.CreateAsync(new CreateCashDropRequest(500m, morning, "morning"), default)).IsClosed);
        Assert.Null(await fixture.Service.ConsolidateCloseAsync(original.Id, duplicate.Id, default));
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task ConsolidationRejectsDestinationSalesOrSourceCashWithoutChangingRecords(bool destinationHasSales)
    {
        await using var fixture = await TestFixture.CreateAsync();
        var date = new DateOnly(2026, 10, 17);
        var original = await fixture.Service.CloseShiftAsync(new CreateCigaretteShiftCloseRequest(date, "morning", [new CigaretteCloseItemRequest(fixture.ProductId, 8)], EndingCashBalance: destinationHasSales ? 0 : 100), default);
        var duplicate = await fixture.Service.CloseShiftAsync(new CreateCigaretteShiftCloseRequest(date.AddDays(-1), "afternoon", [new CigaretteCloseItemRequest(fixture.ProductId, destinationHasSales ? 7 : 8)]), default);

        await Assert.ThrowsAsync<CigaretteValidationException>(() => fixture.Service.ConsolidateCloseAsync(original.Id, duplicate.Id, default));
        fixture.Db.ChangeTracker.Clear();
        Assert.Equal(2, await fixture.Db.CigaretteShiftCloses.CountAsync());
        Assert.Equal(destinationHasSales ? 7 : 8, (await fixture.Db.CigaretteProducts.FindAsync(fixture.ProductId))!.Stock);
        Assert.Equal(8, (await fixture.Db.CigaretteShiftCloseItems.SingleAsync(item => item.CigaretteShiftCloseId == duplicate.Id)).InitialStock);
    }

    [Fact]
    public async Task RepairIntoOpenAfternoonKeepsCafeteriaAndAttachesExistingDropsWithoutDeductingStockAgain()
    {
        await using var fixture = await TestFixture.CreateAsync();
        var date = new DateOnly(2026, 10, 17);
        var product = await fixture.Db.CigaretteProducts.FindAsync(fixture.ProductId);
        product!.Stock = 27;
        await fixture.Db.SaveChangesAsync();
        await fixture.Service.CreatePurchaseAsync(new CreateCigarettePurchaseRequest(product.Id, 2, date.AddDays(-1), "afternoon"), default);
        var drops = new CashDropService(fixture.Db);
        await drops.CreateAsync(new CreateCashDropRequest(210000m, date.AddDays(-1), "afternoon"), default);
        var original = await fixture.Service.CloseShiftAsync(new CreateCigaretteShiftCloseRequest(date, "morning", [new CigaretteCloseItemRequest(product.Id, 27)], EndingCashBalance: 12312m), default);
        foreach (var (day, shift, amount) in new[] { (date.AddDays(-1), "afternoon", 26000m), (date, "morning", 32000m) })
        {
            var sale = new CafeteriaSale { BusinessDate = day, Shift = shift, CreatedAt = DateTime.UtcNow };
            sale.Items.Add(new CafeteriaSaleItem { ProductName = "Café", UnitPrice = amount });
            fixture.Db.CafeteriaSales.Add(sale);
        }
        await fixture.Db.SaveChangesAsync();

        var repaired = await fixture.Service.ConsolidateCloseAsync(original.Id, null, default);
        fixture.Db.ChangeTracker.Clear();
        Assert.Equal(original.Id, repaired!.Id);
        Assert.Equal(date.AddDays(-1), repaired.BusinessDate);
        Assert.Equal("afternoon", repaired.Shift);
        var item = Assert.Single(repaired.Items);
        Assert.Equal(27, item.InitialStock);
        Assert.Equal(2, item.PurchasedQuantity);
        Assert.Equal(27, item.FinalStock);
        Assert.Equal(2, item.SoldQuantity);
        Assert.Equal(original.TotalSales, repaired.TotalSales);
        Assert.Equal(27, (await fixture.Db.CigaretteProducts.FindAsync(product.Id))!.Stock);
        Assert.Equal(210000m, repaired.CashDropsTotal);
        Assert.Equal(12312m, repaired.EndingCashBalance);
        Assert.Equal(26000m, repaired.Cafeteria.TotalSales);
        Assert.Equal(32000m, (await new CafeteriaService(fixture.Db).GetSummaryAsync(date, "morning", default)).TotalSales);
        Assert.Empty((await fixture.Service.GetDashboardAsync(date, default)).Closes);
        Assert.False((await drops.CreateAsync(new CreateCashDropRequest(100m, date, "morning"), default)).IsClosed);
        await Assert.ThrowsAsync<CigaretteValidationException>(() => fixture.Service.ConsolidateCloseAsync(original.Id, null, default, repaired.BusinessDate, repaired.Shift));
    }

    [Theory]
    [InlineData("afternoon", "morning", -3, false)]
    [InlineData("morning", "afternoon", -5, true)]
    [InlineData("afternoon", "morning", 0, true)]
    public async Task RepairAcceptsChosenDatesAndShifts(string sourceShift, string targetShift, int days, bool closedDestination)
    {
        await using var fixture = await TestFixture.CreateAsync();
        var date = new DateOnly(2027, 2, 10);
        var destination = date.AddDays(days);
        var original = await fixture.Service.CloseShiftAsync(new CreateCigaretteShiftCloseRequest(date, sourceShift, [new CigaretteCloseItemRequest(fixture.ProductId, 8)]), default);
        var target = closedDestination
            ? await fixture.Service.CloseShiftAsync(new CreateCigaretteShiftCloseRequest(destination, targetShift, [new CigaretteCloseItemRequest(fixture.ProductId, 8)]), default)
            : null;

        var repaired = await fixture.Service.ConsolidateCloseAsync(original.Id, target?.Id, default, destination, targetShift);
        fixture.Db.ChangeTracker.Clear();
        Assert.Equal(destination, repaired!.BusinessDate);
        Assert.Equal(targetShift, repaired.Shift);
        Assert.Equal(2, repaired.TotalSold);
        Assert.Equal(10, Assert.Single(repaired.Items).InitialStock);
        Assert.Equal(8, (await fixture.Db.CigaretteProducts.FindAsync(fixture.ProductId))!.Stock);
        Assert.False(await fixture.Db.CigaretteShiftCloses.AnyAsync(c => c.BusinessDate == date && c.Shift == sourceShift));
    }

    [Fact]
    public async Task RepairMovesOriginalPurchasesDropsAndReservationsWithoutApplyingBalancesAgain()
    {
        await using var fixture = await TestFixture.CreateAsync();
        var date = new DateOnly(2026, 10, 17);
        var supplier = await new SupplierService(fixture.Db).CreateAsync(new CreateSupplierRequest("Proveedor"), default);
        await fixture.Service.CreatePurchaseAsync(new CreateCigarettePurchaseRequest(fixture.ProductId, 2, date, "morning"), default);
        await fixture.Service.CreatePurchaseAsync(new CreateCigarettePurchaseRequest(fixture.ProductId, 3, date, "afternoon"), default);
        var drops = new CashDropService(fixture.Db);
        await drops.CreateAsync(new CreateCashDropRequest(1000m, date, "morning"), default);
        await drops.CreateAsync(new CreateCashDropRequest(2000m, date, "afternoon"), default);
        var original = await fixture.Service.CloseShiftAsync(new CreateCigaretteShiftCloseRequest(date, "morning", [new CigaretteCloseItemRequest(fixture.ProductId, 11)], [new SupplierAllocationRequest(supplier.Id, 500m, 100m)], EndingCashBalance: 300m), default);

        var moved = await fixture.Service.ConsolidateCloseAsync(original.Id, null, default, date, "afternoon");
        fixture.Db.ChangeTracker.Clear();
        Assert.Equal(4, moved!.TotalSold);
        var item = Assert.Single(moved.Items);
        Assert.Equal(10, item.InitialStock);
        Assert.Equal(5, item.PurchasedQuantity);
        Assert.Equal(11, item.FinalStock);
        Assert.Equal(3000m, moved.CashDropsTotal);
        Assert.Equal(300m, moved.EndingCashBalance);
        Assert.All(await fixture.Db.CigarettePurchases.ToListAsync(), p => Assert.Equal("afternoon", p.Shift));
        Assert.All(await fixture.Db.CashDrops.ToListAsync(), d => { Assert.Equal("afternoon", d.Shift); Assert.Equal(original.Id, d.CigaretteShiftCloseId); });
        Assert.Equal(600m, (await fixture.Db.Suppliers.FindAsync(supplier.Id))!.ReservedBalance);
        Assert.Equal(11, (await fixture.Db.CigaretteProducts.FindAsync(fixture.ProductId))!.Stock);

        var movedAgain = await fixture.Service.ConsolidateCloseAsync(original.Id, null, default, date.AddDays(1), "morning");
        fixture.Db.ChangeTracker.Clear();
        Assert.Equal(4, movedAgain!.TotalSold);
        Assert.Equal(5, Assert.Single(movedAgain.Items).PurchasedQuantity);
        Assert.Equal(date.AddDays(1), (await fixture.Db.SupplierTransactions.SingleAsync()).BusinessDate);
        Assert.Equal(600m, (await fixture.Db.Suppliers.FindAsync(supplier.Id))!.ReservedBalance);
        Assert.Equal(11, (await fixture.Db.CigaretteProducts.FindAsync(fixture.ProductId))!.Stock);
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
