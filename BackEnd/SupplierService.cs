using Microsoft.EntityFrameworkCore;

namespace GestionMesas.Api;

public interface ISupplierService
{
    Task<IReadOnlyList<SupplierResponse>> GetAllAsync(CancellationToken cancellationToken);
    Task<SupplierResponse> CreateAsync(CreateSupplierRequest request, CancellationToken cancellationToken);
    Task<SupplierResponse?> UpdateAsync(int id, UpdateSupplierRequest request, CancellationToken cancellationToken);
    Task<bool> DeactivateAsync(int id, CancellationToken cancellationToken);
    Task<SupplierResponse?> UpdateBalancesAsync(int id, UpdateSupplierBalancesRequest request, CancellationToken cancellationToken);
    Task TransferReservedFundsAsync(CreateSupplierReservedFundsTransferRequest request, CancellationToken cancellationToken);
    Task<SupplierResponse> ExchangeReservedFundsAsync(int id, CreateSupplierReservedFundsExchangeRequest request, CancellationToken cancellationToken);
    Task<SupplierResponse> RecordPurchaseAsync(int id, CreateSupplierPurchaseRequest request, CancellationToken cancellationToken);
    Task<SupplierResponse> RecordPaymentAsync(int id, CreateSupplierPaymentRequest request, CancellationToken cancellationToken);
    Task<SupplierResponse?> UpdateTransactionAsync(int supplierId, int transactionId, UpdateSupplierTransactionRequest request, CancellationToken cancellationToken);
    Task<SupplierResponse?> DeleteTransactionAsync(int supplierId, int transactionId, CancellationToken cancellationToken);
}

public sealed class SupplierValidationException(string message) : InvalidOperationException(message);

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

    internal static void ApplyReserved(Supplier supplier, decimal cashDifference, decimal mercadoPagoDifference)
    {
        supplier.ReservedCashBalance += cashDifference;
        supplier.ReservedMercadoPagoBalance += mercadoPagoDifference;
        supplier.ReservedBalance = supplier.ReservedCashBalance + supplier.ReservedMercadoPagoBalance;
    }

    internal static void EnsureAvailable(Supplier supplier, decimal cashAmount, decimal mercadoPagoAmount, string message)
    {
        if (cashAmount > supplier.ReservedCashBalance || mercadoPagoAmount > supplier.ReservedMercadoPagoBalance) throw new SupplierValidationException(message);
    }

    internal static void ValidateSplit(decimal cashAmount, decimal mercadoPagoAmount)
    {
        if (cashAmount < 0 || mercadoPagoAmount < 0) throw new SupplierValidationException("Los importes no pueden ser negativos.");
    }

    internal static void ValidatePositiveSplit(decimal cashAmount, decimal mercadoPagoAmount, string message)
    {
        ValidateSplit(cashAmount, mercadoPagoAmount);
        if (cashAmount + mercadoPagoAmount <= 0) throw new SupplierValidationException(message);
    }

    private static void EnsureEditableTransaction(SupplierTransaction transaction)
    {
        if (transaction.CigaretteShiftCloseId is not null || transaction.Type is "allocation" or "reserved_transfer_in" or "reserved_transfer_out")
            throw new SupplierValidationException("Este movimiento se corrige desde la operación que lo originó.");
        if (transaction.Type is not ("purchase" or "reserved_purchase" or "payment" or "reserved_adjustment" or "current_account_adjustment" or "reserved_exchange"))
            throw new SupplierValidationException("Este tipo de movimiento no se puede editar ni eliminar.");
    }

    private static SupplierTransaction ValidateReplacement(string type, UpdateSupplierTransactionRequest request)
    {
        var note = NormalizeNote(request.Note);
        switch (type)
        {
            case "purchase":
                if (request.Amount <= 0 || request.CashAmount != 0 || request.MercadoPagoAmount != 0)
                    throw new SupplierValidationException("La compra a cuenta debe tener un importe mayor que cero.");
                return Transaction(0, type, request.Amount, 0, 0, DateTime.UtcNow, note);
            case "reserved_purchase":
                ValidatePositiveSplit(request.CashAmount, request.MercadoPagoAmount, "Elegí efectivo, Mercado Pago o ambos para la compra.");
                if (request.Amount != request.CashAmount + request.MercadoPagoAmount)
                    throw new SupplierValidationException("El desglose de medios de pago debe coincidir con el importe de la compra.");
                return Transaction(0, type, request.Amount, -request.CashAmount, -request.MercadoPagoAmount, DateTime.UtcNow, note);
            case "payment":
                ValidatePositiveSplit(request.CashAmount, request.MercadoPagoAmount, "Elegí efectivo, Mercado Pago o ambos para el pago.");
                if (request.Amount != request.CashAmount + request.MercadoPagoAmount)
                    throw new SupplierValidationException("El desglose de medios de pago debe coincidir con el importe del pago.");
                return Transaction(0, type, request.Amount, -request.CashAmount, -request.MercadoPagoAmount, DateTime.UtcNow, note);
            case "reserved_adjustment":
                ValidateSplit(request.CashAmount, request.MercadoPagoAmount);
                if (request.Amount != request.CashAmount + request.MercadoPagoAmount)
                    throw new SupplierValidationException("El importe del ajuste debe coincidir con sus medios de pago.");
                return Transaction(0, type, request.Amount, request.CashAmount, request.MercadoPagoAmount, DateTime.UtcNow, note);
            case "current_account_adjustment":
                if (request.Amount == 0 || request.CashAmount != 0 || request.MercadoPagoAmount != 0)
                    throw new SupplierValidationException("El ajuste de cuenta corriente debe tener un importe distinto de cero.");
                return Transaction(0, type, request.Amount, 0, 0, DateTime.UtcNow, note);
            case "reserved_exchange":
                if (request.Amount <= 0) throw new SupplierValidationException("El importe a mover debe ser mayor que cero.");
                var cashAmount = request.CashAmount < 0 ? -request.Amount : request.CashAmount > 0 ? request.Amount : 0;
                if (cashAmount == 0) throw new SupplierValidationException("No se pudo identificar el medio de pago de origen.");
                return Transaction(0, type, request.Amount, cashAmount, -cashAmount, DateTime.UtcNow, note);
            default:
                throw new SupplierValidationException("Este tipo de movimiento no se puede editar ni eliminar.");
        }
    }

    private static void EnsureCanApply(Supplier supplier, SupplierTransaction transaction)
    {
        if (transaction.Type is "reserved_purchase" or "payment")
        {
            EnsureAvailable(supplier, -transaction.CashAmount, -transaction.MercadoPagoAmount, "El movimiento supera los fondos reservados disponibles.");
            if (transaction.Type == "payment" && transaction.Amount > supplier.CurrentAccountBalance)
                throw new SupplierValidationException("El pago no puede ser mayor al saldo de cuenta corriente.");
        }
        else if (transaction.Type == "reserved_adjustment")
        {
            EnsureAvailable(supplier, Math.Max(0, -transaction.CashAmount), Math.Max(0, -transaction.MercadoPagoAmount), "El ajuste no puede dejar fondos reservados negativos.");
        }
        else if (transaction.Type == "reserved_exchange")
        {
            EnsureAvailable(supplier, Math.Max(0, -transaction.CashAmount), Math.Max(0, -transaction.MercadoPagoAmount), "El movimiento no puede dejar fondos reservados negativos.");
        }
        else if (transaction.Type == "current_account_adjustment" && transaction.Amount < 0 && -transaction.Amount > supplier.CurrentAccountBalance)
            throw new SupplierValidationException("El ajuste no puede dejar la cuenta corriente negativa.");
    }

    private static void EnsureNonNegativeBalances(Supplier supplier)
    {
        if (supplier.ReservedCashBalance < 0 || supplier.ReservedMercadoPagoBalance < 0 || supplier.CurrentAccountBalance < 0)
            throw new SupplierValidationException("La operación dejaría un saldo negativo.");
    }

    private static void ApplyTransactionEffect(Supplier supplier, SupplierTransaction transaction, decimal direction)
    {
        switch (transaction.Type)
        {
            case "reserved_purchase":
                ApplyReserved(supplier, direction * transaction.CashAmount, direction * transaction.MercadoPagoAmount);
                break;
            case "purchase":
                supplier.CurrentAccountBalance += direction * transaction.Amount;
                break;
            case "payment":
                supplier.CurrentAccountBalance -= direction * transaction.Amount;
                ApplyReserved(supplier, direction * transaction.CashAmount, direction * transaction.MercadoPagoAmount);
                break;
            case "reserved_adjustment":
                ApplyReserved(supplier, direction * transaction.CashAmount, direction * transaction.MercadoPagoAmount);
                break;
            case "current_account_adjustment":
                supplier.CurrentAccountBalance += direction * transaction.Amount;
                break;
        }
    }

    private sealed class Balances(decimal reservedCash, decimal reservedMercadoPago, decimal reserved, decimal currentAccount)
    {
        private readonly decimal reservedCash = reservedCash;
        private readonly decimal reservedMercadoPago = reservedMercadoPago;
        private readonly decimal reserved = reserved;
        private readonly decimal currentAccount = currentAccount;
        public static Balances From(Supplier supplier) => new(supplier.ReservedCashBalance, supplier.ReservedMercadoPagoBalance, supplier.ReservedBalance, supplier.CurrentAccountBalance);
        public void Restore(Supplier supplier)
        {
            supplier.ReservedCashBalance = reservedCash;
            supplier.ReservedMercadoPagoBalance = reservedMercadoPago;
            supplier.ReservedBalance = reserved;
            supplier.CurrentAccountBalance = currentAccount;
        }
    }

    internal static SupplierTransaction Transaction(int supplierId, string type, decimal amount, decimal cashAmount, decimal mercadoPagoAmount, DateTime now, string? note = null, int? closeId = null, DateOnly? businessDate = null) =>
        new() { SupplierId = supplierId, CigaretteShiftCloseId = closeId, Type = type, Amount = amount, CashAmount = cashAmount, MercadoPagoAmount = mercadoPagoAmount, BusinessDate = businessDate ?? DateOnly.FromDateTime(now), Note = note, CreatedAt = now };

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

    private static string? NormalizeNote(string? note) => string.IsNullOrWhiteSpace(note) ? null : note.Trim()[..Math.Min(note.Trim().Length, 250)];
}
