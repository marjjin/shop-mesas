using Microsoft.EntityFrameworkCore;
using static GestionMesas.Api.SupplierLedger;

namespace GestionMesas.Api;

public sealed class SupplierService(RestaurantContext db) : ISupplierService
{
    public async Task<IReadOnlyList<SupplierResponse>> GetAllAsync(CancellationToken cancellationToken)
    {
        var suppliers = await db.Suppliers.AsNoTracking().OrderBy(supplier => supplier.Name).ToListAsync(cancellationToken);
        var transactions = await db.SupplierTransactions.AsNoTracking().OrderByDescending(transaction => transaction.CreatedAt).ToListAsync(cancellationToken);
        var closes = await db.CigaretteShiftCloses.AsNoTracking().ToDictionaryAsync(close => close.Id, cancellationToken);
        return suppliers.Select(supplier => ToResponse(supplier, transactions.Where(transaction => transaction.SupplierId == supplier.Id), closes)).ToList();
    }

    public async Task<SupplierResponse> CreateAsync(CreateSupplierRequest request, CancellationToken cancellationToken)
    {
        var name = ValidateName(request.Name);
        var existingSupplier = await db.Suppliers.FirstOrDefaultAsync(supplier => supplier.Name.ToLower() == name.ToLower(), cancellationToken);
        if (existingSupplier?.IsActive is true) throw new SupplierValidationException("Ya existe un proveedor con ese nombre.");
        if (existingSupplier is not null)
        {
            existingSupplier.IsActive = true;
            await db.SaveChangesAsync(cancellationToken);
            var transactions = await db.SupplierTransactions.Where(transaction => transaction.SupplierId == existingSupplier.Id).OrderByDescending(transaction => transaction.CreatedAt).ToListAsync(cancellationToken);
            return ToResponse(existingSupplier, transactions, await db.CigaretteShiftCloses.ToDictionaryAsync(close => close.Id, cancellationToken));
        }

        var supplier = new Supplier { Name = name, CreatedAt = DateTime.UtcNow };
        db.Suppliers.Add(supplier);
        await db.SaveChangesAsync(cancellationToken);
        return ToResponse(supplier, [], new Dictionary<int, CigaretteShiftClose>());
    }

    public async Task<SupplierResponse?> UpdateAsync(int id, UpdateSupplierRequest request, CancellationToken cancellationToken)
    {
        var supplier = await db.Suppliers.FirstOrDefaultAsync(item => item.Id == id && item.IsActive, cancellationToken);
        if (supplier is null) return null;
        var name = ValidateName(request.Name);
        if (await db.Suppliers.AnyAsync(item => item.Id != id && item.Name.ToLower() == name.ToLower(), cancellationToken))
            throw new SupplierValidationException("Ya existe un proveedor con ese nombre.");
        supplier.Name = name;
        supplier.IsSeparateCashBox = request.IsSeparateCashBox;
        await db.SaveChangesAsync(cancellationToken);
        return await ResponseForAsync(supplier, cancellationToken);
    }

    public async Task<bool> DeactivateAsync(int id, CancellationToken cancellationToken)
    {
        var supplier = await db.Suppliers.FirstOrDefaultAsync(item => item.Id == id && item.IsActive, cancellationToken);
        if (supplier is null) return false;
        supplier.IsActive = false;
        await db.SaveChangesAsync(cancellationToken);
        return true;
    }

    public async Task<SupplierResponse?> UpdateBalancesAsync(int id, UpdateSupplierBalancesRequest request, CancellationToken cancellationToken)
    {
        ValidateSplit(request.ReservedCashBalance, request.ReservedMercadoPagoBalance);
        if (request.CurrentAccountBalance < 0) throw new SupplierValidationException("Los saldos no pueden ser negativos.");
        var supplier = await db.Suppliers.FirstOrDefaultAsync(item => item.Id == id && item.IsActive, cancellationToken);
        if (supplier is null) return null;

        var cashDifference = request.ReservedCashBalance - supplier.ReservedCashBalance;
        var mercadoPagoDifference = request.ReservedMercadoPagoBalance - supplier.ReservedMercadoPagoBalance;
        var accountDifference = request.CurrentAccountBalance - supplier.CurrentAccountBalance;
        var now = DateTime.UtcNow;
        var note = NormalizeNote(request.Note) ?? "Ajuste manual de saldo";
        if (cashDifference != 0 || mercadoPagoDifference != 0)
            db.SupplierTransactions.Add(Transaction(supplier.Id, "reserved_adjustment", cashDifference + mercadoPagoDifference, cashDifference, mercadoPagoDifference, now, note));
        if (accountDifference != 0)
            db.SupplierTransactions.Add(Transaction(supplier.Id, "current_account_adjustment", accountDifference, 0, 0, now, note));

        supplier.ReservedCashBalance = request.ReservedCashBalance;
        supplier.ReservedMercadoPagoBalance = request.ReservedMercadoPagoBalance;
        supplier.ReservedBalance = request.ReservedBalance;
        supplier.CurrentAccountBalance = request.CurrentAccountBalance;
        await db.SaveChangesAsync(cancellationToken);
        return await ResponseForAsync(supplier, cancellationToken);
    }

    public async Task TransferReservedFundsAsync(CreateSupplierReservedFundsTransferRequest request, CancellationToken cancellationToken)
    {
        if (request.SourceSupplierId == request.TargetSupplierId) throw new SupplierValidationException("Elegí proveedores distintos para la transferencia.");
        ValidatePositiveSplit(request.CashAmount, request.MercadoPagoAmount, "El importe de la transferencia debe ser mayor que cero.");
        var supplierIds = new[] { request.SourceSupplierId, request.TargetSupplierId };
        var suppliers = await db.Suppliers.Where(supplier => supplierIds.Contains(supplier.Id)).ToDictionaryAsync(supplier => supplier.Id, cancellationToken);
        if (suppliers.Count != supplierIds.Length || suppliers.Values.Any(supplier => !supplier.IsActive)) throw new KeyNotFoundException();

        var source = suppliers[request.SourceSupplierId];
        var target = suppliers[request.TargetSupplierId];
        EnsureAvailable(source, request.CashAmount, request.MercadoPagoAmount, "La transferencia no puede superar los fondos reservados del proveedor de origen.");
        ApplyReserved(source, -request.CashAmount, -request.MercadoPagoAmount);
        ApplyReserved(target, request.CashAmount, request.MercadoPagoAmount);
        var now = DateTime.UtcNow;
        var note = NormalizeNote(request.Note);
        db.SupplierTransactions.AddRange(
            Transaction(source.Id, "reserved_transfer_out", request.Amount, -request.CashAmount, -request.MercadoPagoAmount, now, NormalizeNote($"Transferencia a {target.Name}{(note is null ? "" : $": {note}")}")),
            Transaction(target.Id, "reserved_transfer_in", request.Amount, request.CashAmount, request.MercadoPagoAmount, now, NormalizeNote($"Transferencia desde {source.Name}{(note is null ? "" : $": {note}")}")));
        await db.SaveChangesAsync(cancellationToken);
    }

    public async Task<SupplierResponse> ExchangeReservedFundsAsync(int id, CreateSupplierReservedFundsExchangeRequest request, CancellationToken cancellationToken)
    {
        if (request.Amount <= 0) throw new SupplierValidationException("El importe a mover debe ser mayor que cero.");
        var paymentMethod = request.FromPaymentMethod.Trim().ToLowerInvariant();
        if (paymentMethod is not ("cash" or "mercado_pago"))
            throw new SupplierValidationException("Elegí el medio de pago de origen.");

        var supplier = await ActiveSupplierAsync(id, cancellationToken);
        var cashAmount = paymentMethod == "cash" ? -request.Amount : request.Amount;
        var mercadoPagoAmount = -cashAmount;
        EnsureAvailable(supplier, Math.Max(0, -cashAmount), Math.Max(0, -mercadoPagoAmount), "El importe no puede superar los fondos disponibles en el medio de origen.");
        ApplyReserved(supplier, cashAmount, mercadoPagoAmount);
        var now = DateTime.UtcNow;
        var direction = paymentMethod == "cash" ? "Efectivo a Mercado Pago" : "Mercado Pago a efectivo";
        db.SupplierTransactions.Add(Transaction(supplier.Id, "reserved_exchange", request.Amount, cashAmount, mercadoPagoAmount, now,
            NormalizeNote($"{direction}{(string.IsNullOrWhiteSpace(request.Note) ? "" : $": {request.Note.Trim()}")}")));
        await db.SaveChangesAsync(cancellationToken);
        return await ResponseForAsync(supplier, cancellationToken);
    }

    public async Task<SupplierResponse> RecordPurchaseAsync(int id, CreateSupplierPurchaseRequest request, CancellationToken cancellationToken)
    {
        var supplier = await ActiveSupplierAsync(id, cancellationToken);
        if (request.Amount <= 0) throw new SupplierValidationException("El importe de la compra debe ser mayor que cero.");
        var paymentMethod = request.PaymentMethod.Trim().ToLowerInvariant();
        if (paymentMethod is not ("reserved" or "account")) throw new SupplierValidationException("La compra debe usar fondos reservados o quedar en cuenta corriente.");
        if (paymentMethod == "reserved")
        {
            ValidatePositiveSplit(request.CashAmount, request.MercadoPagoAmount, "Elegí efectivo, Mercado Pago o ambos para la compra.");
            if (request.Amount != request.CashAmount + request.MercadoPagoAmount) throw new SupplierValidationException("El desglose de medios de pago debe coincidir con el importe de la compra.");
            EnsureAvailable(supplier, request.CashAmount, request.MercadoPagoAmount, "La compra no puede superar los fondos reservados seleccionados.");
            ApplyReserved(supplier, -request.CashAmount, -request.MercadoPagoAmount);
        }
        else if (request.CashAmount != 0 || request.MercadoPagoAmount != 0)
            throw new SupplierValidationException("Una compra a cuenta corriente no usa fondos reservados.");
        else supplier.CurrentAccountBalance += request.Amount;

        var now = DateTime.UtcNow;
        db.SupplierTransactions.Add(Transaction(supplier.Id, paymentMethod == "reserved" ? "reserved_purchase" : "purchase", request.Amount,
            paymentMethod == "reserved" ? -request.CashAmount : 0, paymentMethod == "reserved" ? -request.MercadoPagoAmount : 0, now, NormalizeNote(request.Note)));
        await db.SaveChangesAsync(cancellationToken);
        return await ResponseForAsync(supplier, cancellationToken);
    }

    public async Task<SupplierResponse> RecordPaymentAsync(int id, CreateSupplierPaymentRequest request, CancellationToken cancellationToken)
    {
        var supplier = await ActiveSupplierAsync(id, cancellationToken);
        ValidatePositiveSplit(request.CashAmount, request.MercadoPagoAmount, "Elegí efectivo, Mercado Pago o ambos para el pago.");
        if (request.Amount > supplier.CurrentAccountBalance) throw new SupplierValidationException("El pago no puede ser mayor al saldo de cuenta corriente.");
        EnsureAvailable(supplier, request.CashAmount, request.MercadoPagoAmount, "El pago no puede ser mayor a los fondos reservados seleccionados.");
        supplier.CurrentAccountBalance -= request.Amount;
        ApplyReserved(supplier, -request.CashAmount, -request.MercadoPagoAmount);
        var now = DateTime.UtcNow;
        db.SupplierTransactions.Add(Transaction(supplier.Id, "payment", request.Amount, -request.CashAmount, -request.MercadoPagoAmount, now, NormalizeNote(request.Note)));
        await db.SaveChangesAsync(cancellationToken);
        return await ResponseForAsync(supplier, cancellationToken);
    }

    public async Task<SupplierResponse?> UpdateTransactionAsync(int supplierId, int transactionId, UpdateSupplierTransactionRequest request, CancellationToken cancellationToken)
    {
        var supplier = await db.Suppliers.FirstOrDefaultAsync(item => item.Id == supplierId && item.IsActive, cancellationToken);
        if (supplier is null) return null;
        var transaction = await db.SupplierTransactions.FirstOrDefaultAsync(item => item.Id == transactionId && item.SupplierId == supplierId, cancellationToken);
        if (transaction is null) return null;
        EnsureEditableTransaction(transaction);

        var oldBalances = Balances.From(supplier);
        ApplyTransactionEffect(supplier, transaction, -1);
        try
        {
            EnsureNonNegativeBalances(supplier);
            var replacement = ValidateReplacement(transaction.Type, request);
            EnsureCanApply(supplier, replacement);
            transaction.Amount = replacement.Amount;
            transaction.CashAmount = replacement.CashAmount;
            transaction.MercadoPagoAmount = replacement.MercadoPagoAmount;
            transaction.Note = NormalizeNote(request.Note);
            ApplyTransactionEffect(supplier, transaction, 1);
            await db.SaveChangesAsync(cancellationToken);
            return await ResponseForAsync(supplier, cancellationToken);
        }
        catch
        {
            oldBalances.Restore(supplier);
            throw;
        }
    }

    public async Task<SupplierResponse?> DeleteTransactionAsync(int supplierId, int transactionId, CancellationToken cancellationToken)
    {
        var supplier = await db.Suppliers.FirstOrDefaultAsync(item => item.Id == supplierId && item.IsActive, cancellationToken);
        if (supplier is null) return null;
        var transaction = await db.SupplierTransactions.FirstOrDefaultAsync(item => item.Id == transactionId && item.SupplierId == supplierId, cancellationToken);
        if (transaction is null) return null;
        EnsureEditableTransaction(transaction);

        var oldBalances = Balances.From(supplier);
        ApplyTransactionEffect(supplier, transaction, -1);
        try
        {
            EnsureNonNegativeBalances(supplier);
            db.SupplierTransactions.Remove(transaction);
            await db.SaveChangesAsync(cancellationToken);
            return await ResponseForAsync(supplier, cancellationToken);
        }
        catch
        {
            oldBalances.Restore(supplier);
            throw;
        }
    }

    private async Task<Supplier> ActiveSupplierAsync(int id, CancellationToken cancellationToken) =>
        await db.Suppliers.FirstOrDefaultAsync(item => item.Id == id && item.IsActive, cancellationToken) ?? throw new KeyNotFoundException();

    private async Task<SupplierResponse> ResponseForAsync(Supplier supplier, CancellationToken cancellationToken)
    {
        var transactions = await db.SupplierTransactions.Where(item => item.SupplierId == supplier.Id).OrderByDescending(item => item.CreatedAt).ToListAsync(cancellationToken);
        return ToResponse(supplier, transactions, await db.CigaretteShiftCloses.ToDictionaryAsync(close => close.Id, cancellationToken));
    }

    private static SupplierResponse ToResponse(Supplier supplier, IEnumerable<SupplierTransaction> transactions, IReadOnlyDictionary<int, CigaretteShiftClose> closes)
    {
        var ordered = transactions.OrderByDescending(transaction => transaction.CreatedAt).ToList();
        var runningBalance = supplier.CurrentAccountBalance;
        var result = ordered.Select(transaction =>
        {
            var balanceAfter = runningBalance;
            if (transaction.Type == "payment") runningBalance += transaction.Amount;
            else if (transaction.Type is "purchase" or "current_account_adjustment") runningBalance -= transaction.Amount;
            return new SupplierTransactionResponse(transaction.Id, transaction.Type, transaction.Amount, transaction.CashAmount, transaction.MercadoPagoAmount, balanceAfter, transaction.BusinessDate,
                transaction.CigaretteShiftCloseId is int closeId && closes.TryGetValue(closeId, out var close) ? close.Shift : null, transaction.Note,
                new DateTimeOffset(DateTime.SpecifyKind(transaction.CreatedAt, DateTimeKind.Utc)));
        }).ToList();
        return new SupplierResponse(supplier.Id, supplier.Name, supplier.ReservedBalance, supplier.ReservedCashBalance, supplier.ReservedMercadoPagoBalance, supplier.CurrentAccountBalance, supplier.IsSeparateCashBox, supplier.IsActive, result);
    }

    private static string ValidateName(string name)
    {
        name = name.Trim();
        if (string.IsNullOrWhiteSpace(name) || name.Length > 100) throw new SupplierValidationException("El nombre es obligatorio y admite hasta 100 caracteres.");
        return name;
    }
}
