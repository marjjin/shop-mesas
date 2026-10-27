using Microsoft.EntityFrameworkCore;
using static GestionMesas.Api.CigaretteRules;

namespace GestionMesas.Api;

public sealed class CigaretteService(RestaurantContext db, ICafeteriaService? cafeteria = null) : ICigaretteService
{
    private readonly CigaretteInventory inventory = new(db);
    private readonly CigaretteQueries queries = new(db, cafeteria);

    public Task<CigaretteDashboardResponse> GetDashboardAsync(DateOnly date, CancellationToken cancellationToken) =>
        queries.GetDashboardAsync(date, cancellationToken);

    public Task<IReadOnlyList<CigaretteShiftCloseResponse>> GetClosesAsync(DateOnly from, DateOnly to, CancellationToken cancellationToken) =>
        queries.GetClosesAsync(from, to, cancellationToken);

    public Task<CigaretteProductResponse> CreateProductAsync(CreateCigaretteProductRequest request, CancellationToken cancellationToken) =>
        inventory.CreateProductAsync(request, cancellationToken);

    public Task<CigaretteProductResponse?> UpdateProductAsync(int id, UpdateCigaretteProductRequest request, CancellationToken cancellationToken) =>
        inventory.UpdateProductAsync(id, request, cancellationToken);

    public Task<bool> DeleteProductAsync(int id, CancellationToken cancellationToken) =>
        inventory.DeleteProductAsync(id, cancellationToken);

    public Task<CigarettePurchaseResponse> CreatePurchaseAsync(CreateCigarettePurchaseRequest request, CancellationToken cancellationToken) =>
        inventory.CreatePurchaseAsync(request, cancellationToken);

    public Task<CigarettePurchaseResponse?> UpdatePurchaseAsync(int id, UpdateCigarettePurchaseRequest request, CancellationToken cancellationToken) =>
        inventory.UpdatePurchaseAsync(id, request, cancellationToken);

    public Task<bool> DeletePurchaseAsync(int id, CancellationToken cancellationToken) =>
        inventory.DeletePurchaseAsync(id, cancellationToken);

    public async Task<CigaretteShiftCloseResponse> CloseShiftAsync(CreateCigaretteShiftCloseRequest request, CancellationToken cancellationToken)
    {
        var shift = NormalizeShift(request.Shift);
        if (request.Items.Count == 0) throw new CigaretteValidationException("El cierre debe incluir al menos un cigarrillo.");
        if (request.Items.Select(item => item.CigaretteProductId).Distinct().Count() != request.Items.Count)
            throw new CigaretteValidationException("No se puede repetir un cigarrillo en el cierre.");
        if (await db.CigaretteShiftCloses.AnyAsync(close => close.BusinessDate == request.BusinessDate && close.Shift == shift, cancellationToken))
            throw new CigaretteValidationException("Ese turno ya fue cerrado.");
        var allocations = request.SupplierAllocations ?? [];
        if (allocations.Any(allocation => allocation.CashAmount < 0 || allocation.MercadoPagoAmount < 0))
            throw new CigaretteValidationException("El importe reservado para un proveedor no puede ser negativo.");
        if (request.EndingCashBalance < 0 || request.EndingMercadoPagoBalance < 0 || request.NextShiftChangeCash < 0 || request.ReceivedChangeCash < 0 || request.PosnetTotal < 0)
            throw new CigaretteValidationException("Los importes del arqueo de caja no pueden ser negativos.");
        if (allocations.Select(allocation => allocation.SupplierId).Distinct().Count() != allocations.Count)
            throw new CigaretteValidationException("No se puede repetir un proveedor en el cierre.");

        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        var cashDrops = await db.CashDrops
            .Where(drop => drop.BusinessDate == request.BusinessDate && drop.Shift == shift && drop.CigaretteShiftCloseId == null)
            .ToListAsync(cancellationToken);
        var ids = request.Items.Select(item => item.CigaretteProductId).ToList();
        var products = await db.CigaretteProducts.Where(product => product.IsActive && ids.Contains(product.Id)).ToDictionaryAsync(product => product.Id, cancellationToken);
        if (products.Count != ids.Count) throw new CigaretteNotFoundException("Uno de los cigarrillos del cierre no existe.");
        var purchases = await db.CigarettePurchases.Where(purchase => purchase.BusinessDate == request.BusinessDate && purchase.Shift == shift && ids.Contains(purchase.CigaretteProductId))
            .GroupBy(purchase => purchase.CigaretteProductId).Select(group => new { ProductId = group.Key, Quantity = group.Sum(item => item.Quantity) })
            .ToDictionaryAsync(item => item.ProductId, item => item.Quantity, cancellationToken);
        var supplierIds = allocations.Where(allocation => allocation.Amount > 0).Select(allocation => allocation.SupplierId).ToList();
        var suppliers = await db.Suppliers.Where(supplier => supplier.IsActive && supplierIds.Contains(supplier.Id))
            .ToDictionaryAsync(supplier => supplier.Id, cancellationToken);
        if (suppliers.Count != supplierIds.Count)
            throw new CigaretteNotFoundException("Uno de los proveedores del cierre no existe o está inactivo.");

        // Capture the same pending sales shown by the counter before saving the close.
        var cafeteriaSales = await CafeteriaService.GetPendingSales(db).ToListAsync(cancellationToken);
        var close = new CigaretteShiftClose { BusinessDate = request.BusinessDate, Shift = shift, EndingCashBalance = request.EndingCashBalance, EndingMercadoPagoBalance = request.EndingMercadoPagoBalance, NextShiftChangeCash = request.NextShiftChangeCash, ReceivedChangeCash = request.ReceivedChangeCash, PosnetTotal = request.PosnetTotal, ClosedAt = DateTime.UtcNow };
        foreach (var input in request.Items)
        {
            var product = products[input.CigaretteProductId];
            var purchased = purchases.GetValueOrDefault(product.Id);
            var initial = product.Stock - purchased;
            if (initial < 0) throw new CigaretteValidationException($"El stock inicial calculado de {product.Name} es inválido.");
            if (input.FinalStock < 0 || input.FinalStock > product.Stock)
                throw new CigaretteValidationException($"El stock final de {product.Name} debe estar entre 0 y {product.Stock}.");
            var sold = initial + purchased - input.FinalStock;
            close.Items.Add(new CigaretteShiftCloseItem { CigaretteProductId = product.Id, ProductName = product.Name, UnitPrice = product.Price, InitialStock = initial, PurchasedQuantity = purchased, FinalStock = input.FinalStock, SoldQuantity = sold, SalesAmount = sold * product.Price });
            product.Stock = input.FinalStock;
        }

        foreach (var sale in cafeteriaSales)
        {
            sale.BusinessDate = close.BusinessDate;
            sale.Shift = close.Shift;
        }
        db.CigaretteShiftCloses.Add(close);
        await db.SaveChangesAsync(cancellationToken);
        foreach (var cashDrop in cashDrops)
            cashDrop.CigaretteShiftCloseId = close.Id;
        foreach (var allocation in allocations.Where(allocation => allocation.Amount > 0))
        {
            var supplier = suppliers[allocation.SupplierId];
            SupplierLedger.ApplyReserved(supplier, allocation.CashAmount, allocation.MercadoPagoAmount);
            db.SupplierTransactions.Add(SupplierLedger.Transaction(supplier.Id, "allocation", allocation.Amount, allocation.CashAmount,
                allocation.MercadoPagoAmount, close.ClosedAt, closeId: close.Id, businessDate: request.BusinessDate));
        }
        await db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return await queries.ToResponseAsync(close, cancellationToken);
    }

    public async Task<CigaretteShiftCloseResponse?> UpdateCloseAsync(int id, UpdateCigaretteShiftCloseRequest request, CancellationToken cancellationToken)
    {
        var close = await db.CigaretteShiftCloses.Include(item => item.Items).FirstOrDefaultAsync(item => item.Id == id, cancellationToken);
        if (close is null) return null;
        if (request.Items.Count != close.Items.Count || request.Items.Select(item => item.CigaretteProductId).Distinct().Count() != request.Items.Count)
            throw new CigaretteValidationException("La corrección debe incluir cada cigarrillo del cierre una sola vez.");

        var existingItems = close.Items.ToDictionary(item => item.CigaretteProductId);
        if (request.Items.Any(item => !existingItems.ContainsKey(item.CigaretteProductId)))
            throw new CigaretteValidationException("La corrección contiene un cigarrillo que no pertenece al cierre.");

        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        if (request.CafeteriaSaleCount is < 0)
            throw new CigaretteValidationException("La cantidad de ventas de cafetería no puede ser negativa.");
        var targetBusinessDate = request.BusinessDate ?? close.BusinessDate;
        var targetShift = request.Shift is null ? close.Shift : NormalizeShift(request.Shift);
        if (targetBusinessDate != close.BusinessDate || targetShift != close.Shift)
            await MoveCloseSlotAsync(close, targetBusinessDate, targetShift, cancellationToken);
        var productIds = close.Items.Select(item => item.CigaretteProductId).ToList();
        var products = await db.CigaretteProducts.Where(item => productIds.Contains(item.Id)).ToDictionaryAsync(item => item.Id, cancellationToken);
        if (products.Count != productIds.Count) throw new CigaretteNotFoundException("Uno de los cigarrillos del cierre no existe.");

        foreach (var input in request.Items)
        {
            var item = existingItems[input.CigaretteProductId];
            var maximumFinalStock = item.InitialStock + item.PurchasedQuantity;
            if (input.FinalStock < 0 || input.FinalStock > maximumFinalStock)
                throw new CigaretteValidationException($"El stock final de {item.ProductName} debe estar entre 0 y {maximumFinalStock}.");

            var product = products[item.CigaretteProductId];
            var correctedCurrentStock = product.Stock + input.FinalStock - item.FinalStock;
            if (correctedCurrentStock < 0)
                throw new CigaretteValidationException($"La corrección de {item.ProductName} dejaría el stock actual negativo.");

            item.FinalStock = input.FinalStock;
            item.SoldQuantity = maximumFinalStock - input.FinalStock;
            item.SalesAmount = item.SoldQuantity * item.UnitPrice;
            product.Stock = correctedCurrentStock;
        }

        if (request.SupplierAllocations is not null)
            await UpdateSupplierAllocationsAsync(close, request.SupplierAllocations, cancellationToken);
        if (request.EndingCashBalance is < 0 || request.EndingMercadoPagoBalance is < 0 || request.NextShiftChangeCash is < 0 || request.ReceivedChangeCash is < 0 || request.PosnetTotal is < 0)
            throw new CigaretteValidationException("Los importes del arqueo de caja no pueden ser negativos.");
        if (request.EndingCashBalance.HasValue) close.EndingCashBalance = request.EndingCashBalance.Value;
        if (request.EndingMercadoPagoBalance.HasValue) close.EndingMercadoPagoBalance = request.EndingMercadoPagoBalance.Value;
        if (request.NextShiftChangeCash.HasValue) close.NextShiftChangeCash = request.NextShiftChangeCash.Value;
        if (request.ReceivedChangeCash.HasValue) close.ReceivedChangeCash = request.ReceivedChangeCash.Value;
        if (request.PosnetTotal.HasValue) close.PosnetTotal = request.PosnetTotal.Value;
        if (request.CafeteriaSaleCount.HasValue)
            await SetCafeteriaSaleCountAsync(close, request.CafeteriaSaleCount.Value, cancellationToken);

        await db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return await queries.ToResponseAsync(close, cancellationToken);
    }

    private async Task SetCafeteriaSaleCountAsync(CigaretteShiftClose close, int desiredCount, CancellationToken cancellationToken)
    {
        var sales = await db.CafeteriaSales.Include(sale => sale.Items)
            .Where(sale => sale.BusinessDate == close.BusinessDate && sale.Shift == close.Shift)
            .OrderBy(sale => sale.CreatedAt).ThenBy(sale => sale.Id).ToListAsync(cancellationToken);
        if (desiredCount == sales.Count) return;
        if (desiredCount < sales.Count)
        {
            db.CafeteriaSales.RemoveRange(sales.Skip(desiredCount));
            return;
        }
        var template = sales.LastOrDefault();
        if (template is null)
            throw new CigaretteValidationException("No hay una venta de cafetería para copiar. Registrá una venta desde Caja Cafetería primero.");
        for (var index = sales.Count; index < desiredCount; index++)
        {
            var sale = new CafeteriaSale { BusinessDate = close.BusinessDate, Shift = close.Shift, CreatedAt = DateTime.UtcNow };
            sale.Items.AddRange(template.Items.Select(item => new CafeteriaSaleItem
            {
                CafeteriaProductId = item.CafeteriaProductId,
                ProductName = item.ProductName,
                UnitPrice = item.UnitPrice
            }));
            db.CafeteriaSales.Add(sale);
        }
    }

    public async Task<bool> DeleteCloseAsync(int id, CancellationToken cancellationToken)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        var close = await db.CigaretteShiftCloses.Include(item => item.Items).SingleOrDefaultAsync(item => item.Id == id, cancellationToken);
        if (close is null) return false;
        if (await db.CigaretteShiftCloses.AnyAsync(item => item.ClosedAt > close.ClosedAt, cancellationToken))
            throw new CigaretteValidationException("No se puede borrar este cierre porque hay turnos cerrados después. Corregí primero la secuencia desde el cierre más reciente.");
        var productIds = close.Items.Select(item => item.CigaretteProductId).ToList();
        var products = await db.CigaretteProducts.Where(item => productIds.Contains(item.Id)).ToDictionaryAsync(item => item.Id, cancellationToken);
        foreach (var item in close.Items)
        {
            if (!products.TryGetValue(item.CigaretteProductId, out var product)) continue;
            product.Stock += item.InitialStock + item.PurchasedQuantity - item.FinalStock;
        }
        var allocations = await db.SupplierTransactions.Where(item => item.CigaretteShiftCloseId == id && item.Type == "allocation").ToListAsync(cancellationToken);
        var supplierIds = allocations.Select(item => item.SupplierId).Distinct().ToList();
        var suppliers = await db.Suppliers.Where(item => supplierIds.Contains(item.Id)).ToDictionaryAsync(item => item.Id, cancellationToken);
        foreach (var allocation in allocations)
            if (suppliers.TryGetValue(allocation.SupplierId, out var supplier))
                SupplierLedger.ApplyReserved(supplier, -allocation.CashAmount, -allocation.MercadoPagoAmount);
        db.SupplierTransactions.RemoveRange(allocations);
        var drops = await db.CashDrops.Where(item => item.CigaretteShiftCloseId == id).ToListAsync(cancellationToken);
        foreach (var drop in drops) drop.CigaretteShiftCloseId = null;
        db.CigaretteShiftCloses.Remove(close);
        await db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return true;
    }

    public async Task<CigaretteShiftCloseResponse?> ConsolidateCloseAsync(int id, int? targetId, CancellationToken cancellationToken, DateOnly? targetDate = null, string? targetShift = null)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        var source = await db.CigaretteShiftCloses.Include(close => close.Items).SingleOrDefaultAsync(close => close.Id == id, cancellationToken);
        if (source is null) return null;
        if (targetId is null)
        {
            var destinationDate = targetDate ?? source.BusinessDate.AddDays(-1);
            var destinationShift = NormalizeShift(targetShift ?? "afternoon");
            if (destinationDate == source.BusinessDate && destinationShift == source.Shift)
                throw new CigaretteValidationException("Elegí un destino distinto del turno de origen.");
            if (await db.CigaretteShiftCloses.AnyAsync(close => close.BusinessDate == destinationDate && close.Shift == destinationShift, cancellationToken))
                throw new CigaretteValidationException("El destino ahora tiene un cierre. Recargá la pantalla antes de reparar.");
            var sourcePurchases = await db.CigarettePurchases.Where(p => p.BusinessDate == source.BusinessDate && p.Shift == source.Shift).ToListAsync(cancellationToken);
            var sourceDrops = await db.CashDrops.Where(d => d.CigaretteShiftCloseId == id).ToListAsync(cancellationToken);
            var sourceReservations = await db.SupplierTransactions.Where(t => t.CigaretteShiftCloseId == id).ToListAsync(cancellationToken);
            var purchases = await db.CigarettePurchases.Where(p => p.BusinessDate == destinationDate && p.Shift == destinationShift).ToListAsync(cancellationToken);
            var items = source.Items.ToDictionary(item => item.CigaretteProductId);
            if (purchases.Any(p => p.CreatedAt > source.ClosedAt || !items.ContainsKey(p.CigaretteProductId)))
                throw new CigaretteValidationException("Hay compras posteriores al cierre o productos fuera de su inventario. Revisá esas compras antes de reparar.");
            var quantities = purchases.GroupBy(p => p.CigaretteProductId).ToDictionary(g => g.Key, g => g.Sum(p => p.Quantity));
            var sourceQuantities = sourcePurchases.GroupBy(p => p.CigaretteProductId).ToDictionary(g => g.Key, g => g.Sum(p => p.Quantity));
            if (sourcePurchases.Any(p => !items.ContainsKey(p.CigaretteProductId))
                || source.Items.Any(item => item.PurchasedQuantity != sourceQuantities.GetValueOrDefault(item.CigaretteProductId)
                    || item.InitialStock < quantities.GetValueOrDefault(item.CigaretteProductId)))
                throw new CigaretteValidationException("Las compras no permiten reconstruir el stock inicial de forma segura.");
            var drops = await db.CashDrops.Where(d => d.BusinessDate == destinationDate && d.Shift == destinationShift).ToListAsync(cancellationToken);
            if (drops.Any(d => d.CigaretteShiftCloseId.HasValue))
                throw new CigaretteValidationException("Una tirada del destino está vinculada a otro cierre.");
            foreach (var item in source.Items)
            {
                // These purchases already contributed to stock before the original close.
                var destinationPurchased = quantities.GetValueOrDefault(item.CigaretteProductId);
                item.PurchasedQuantity += destinationPurchased;
                item.InitialStock -= destinationPurchased;
            }
            foreach (var drop in drops) drop.CigaretteShiftCloseId = source.Id;
            foreach (var purchase in sourcePurchases)
            {
                purchase.BusinessDate = destinationDate;
                purchase.Shift = destinationShift;
            }
            foreach (var drop in sourceDrops)
            {
                drop.BusinessDate = destinationDate;
                drop.Shift = destinationShift;
            }
            foreach (var reservation in sourceReservations) reservation.BusinessDate = destinationDate;
            source.BusinessDate = destinationDate;
            source.Shift = destinationShift;
            await db.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
            return await queries.ToResponseAsync(source, cancellationToken);
        }
        var target = await db.CigaretteShiftCloses.Include(close => close.Items).SingleOrDefaultAsync(close => close.Id == targetId, cancellationToken)
            ?? throw new CigaretteValidationException("El cierre destino no existe.");
        if (source.Id == target.Id || (targetDate.HasValue && target.BusinessDate != targetDate.Value)
            || (targetShift is not null && target.Shift != NormalizeShift(targetShift)))
            throw new CigaretteValidationException("El cierre destino no coincide con el turno elegido o es el mismo cierre.");
        if (source.EndingCashBalance != 0 || source.EndingMercadoPagoBalance != 0 || source.PosnetTotal != 0 || source.NextShiftChangeCash != 0 || source.ReceivedChangeCash != 0
            || await db.CashDrops.AnyAsync(drop => drop.CigaretteShiftCloseId == id || (drop.BusinessDate == source.BusinessDate && drop.Shift == source.Shift), cancellationToken)
            || await db.SupplierTransactions.AnyAsync(item => item.CigaretteShiftCloseId == id, cancellationToken)
            || await db.CigarettePurchases.AnyAsync(item => item.BusinessDate == source.BusinessDate && item.Shift == source.Shift, cancellationToken))
            throw new CigaretteValidationException("El cierre de origen tiene caja, tiradas, reservas o compras. Requiere una revisión manual para conservar esos movimientos.");
        var originalItems = source.Items.ToDictionary(item => item.CigaretteProductId);
        if (target.Items.Count == 0 || target.Items.Count != originalItems.Count || target.Items.Any(item =>
            !originalItems.TryGetValue(item.CigaretteProductId, out var original)
            || item.SoldQuantity != 0 || item.SalesAmount != 0
            || item.InitialStock != original.FinalStock
            || item.FinalStock != item.InitialStock + item.PurchasedQuantity
            || original.PurchasedQuantity != 0
            || original.SoldQuantity != original.InitialStock - original.FinalStock
            || original.SoldQuantity < 0))
            throw new CigaretteValidationException("Los inventarios no coinciden con un cierre duplicado sin ventas. No se modificó ningún cierre.");

        foreach (var item in target.Items)
        {
            var original = originalItems[item.CigaretteProductId];
            item.InitialStock = original.InitialStock;
            item.UnitPrice = original.UnitPrice;
            item.SoldQuantity = original.SoldQuantity;
            item.SalesAmount = original.SalesAmount;
        }
        // Keep destination purchases, cash, allocations and both dates' cafeteria sales.
        // Inventory sales were already deducted by the original close.
        db.CigaretteShiftCloses.Remove(source);
        await db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return await queries.ToResponseAsync(target, cancellationToken);
    }

    private async Task MoveCloseSlotAsync(CigaretteShiftClose close, DateOnly targetBusinessDate, string targetShift, CancellationToken cancellationToken)
    {
        if (await db.CigaretteShiftCloses.AnyAsync(item => item.Id != close.Id && item.BusinessDate == targetBusinessDate && item.Shift == targetShift, cancellationToken))
            throw new CigaretteValidationException("Ya existe un cierre para ese día y turno.");

        if (await db.CigarettePurchases.AnyAsync(item => item.BusinessDate == targetBusinessDate && item.Shift == targetShift, cancellationToken))
            throw new CigaretteValidationException("La fecha destino ya tiene compras cargadas para ese turno.");

        if (await db.CashDrops.AnyAsync(item => item.BusinessDate == targetBusinessDate && item.Shift == targetShift, cancellationToken))
            throw new CigaretteValidationException("La fecha destino ya tiene tiradas de efectivo para ese turno.");

        if (await db.CafeteriaSales.AnyAsync(item => item.BusinessDate == targetBusinessDate && item.Shift == targetShift, cancellationToken))
            throw new CigaretteValidationException("La fecha destino ya tiene ventas de cafetería para ese turno.");

        var purchases = await db.CigarettePurchases
            .Where(item => item.BusinessDate == close.BusinessDate && item.Shift == close.Shift)
            .ToListAsync(cancellationToken);
        foreach (var purchase in purchases)
        {
            purchase.BusinessDate = targetBusinessDate;
            purchase.Shift = targetShift;
        }

        var cashDrops = await db.CashDrops
            .Where(item => item.CigaretteShiftCloseId == close.Id)
            .ToListAsync(cancellationToken);
        foreach (var cashDrop in cashDrops)
        {
            cashDrop.BusinessDate = targetBusinessDate;
            cashDrop.Shift = targetShift;
        }

        var supplierTransactions = await db.SupplierTransactions
            .Where(item => item.CigaretteShiftCloseId == close.Id)
            .ToListAsync(cancellationToken);
        foreach (var supplierTransaction in supplierTransactions)
            supplierTransaction.BusinessDate = targetBusinessDate;

        var cafeteriaSales = await db.CafeteriaSales
            .Where(item => item.BusinessDate == close.BusinessDate && item.Shift == close.Shift)
            .ToListAsync(cancellationToken);
        foreach (var sale in cafeteriaSales)
        {
            sale.BusinessDate = targetBusinessDate;
            sale.Shift = targetShift;
        }

        close.BusinessDate = targetBusinessDate;
        close.Shift = targetShift;
    }

    private async Task UpdateSupplierAllocationsAsync(CigaretteShiftClose close, IReadOnlyList<SupplierAllocationRequest> requestedAllocations, CancellationToken cancellationToken)
    {
        if (requestedAllocations.Any(allocation => allocation.CashAmount < 0 || allocation.MercadoPagoAmount < 0))
            throw new CigaretteValidationException("El importe reservado para un proveedor no puede ser negativo.");
        if (requestedAllocations.Select(allocation => allocation.SupplierId).Distinct().Count() != requestedAllocations.Count)
            throw new CigaretteValidationException("No se puede repetir un proveedor en el cierre.");

        var requested = requestedAllocations.Where(allocation => allocation.Amount > 0)
            .ToDictionary(allocation => allocation.SupplierId);
        var existing = await db.SupplierTransactions
            .Where(transaction => transaction.CigaretteShiftCloseId == close.Id && transaction.Type == "allocation")
            .ToDictionaryAsync(transaction => transaction.SupplierId, cancellationToken);
        var supplierIds = requested.Keys.Union(existing.Keys).ToList();
        var suppliers = await db.Suppliers.Where(supplier => supplierIds.Contains(supplier.Id))
            .ToDictionaryAsync(supplier => supplier.Id, cancellationToken);
        if (suppliers.Count != supplierIds.Count)
            throw new CigaretteNotFoundException("Uno de los proveedores del cierre no existe.");

        foreach (var supplierId in supplierIds)
        {
            var current = existing.GetValueOrDefault(supplierId);
            var currentCash = current?.CashAmount ?? 0;
            var currentMercadoPago = current?.MercadoPagoAmount ?? 0;
            var requestedAllocation = requested.GetValueOrDefault(supplierId);
            var requestedCash = requestedAllocation?.CashAmount ?? 0;
            var requestedMercadoPago = requestedAllocation?.MercadoPagoAmount ?? 0;
            var supplier = suppliers[supplierId];
            var cashDifference = requestedCash - currentCash;
            var mercadoPagoDifference = requestedMercadoPago - currentMercadoPago;
            if (cashDifference == 0 && mercadoPagoDifference == 0) continue;
            if (!existing.ContainsKey(supplierId) && !supplier.IsActive)
                throw new CigaretteValidationException($"El proveedor {supplier.Name} está inactivo.");
            if (supplier.ReservedCashBalance + cashDifference < 0 || supplier.ReservedMercadoPagoBalance + mercadoPagoDifference < 0)
                throw new CigaretteValidationException($"No se puede reducir la reserva de {supplier.Name}, porque ya se pagó parte de ese saldo.");

            SupplierLedger.ApplyReserved(supplier, cashDifference, mercadoPagoDifference);
            if (requestedAllocation is null)
                db.SupplierTransactions.Remove(existing[supplierId]);
            else if (existing.TryGetValue(supplierId, out var allocation))
            {
                allocation.Amount = requestedAllocation.Amount;
                allocation.CashAmount = requestedCash;
                allocation.MercadoPagoAmount = requestedMercadoPago;
            }
            else
                db.SupplierTransactions.Add(SupplierLedger.Transaction(supplier.Id, "allocation", requestedAllocation.Amount, requestedCash,
                    requestedMercadoPago, close.ClosedAt, closeId: close.Id, businessDate: close.BusinessDate));
        }
    }
}
