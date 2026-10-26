namespace GestionMesas.Api;

internal static class SupplierLedger
{
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

    internal static void EnsureEditableTransaction(SupplierTransaction transaction)
    {
        if (transaction.CigaretteShiftCloseId is not null || transaction.Type is "allocation" or "reserved_transfer_in" or "reserved_transfer_out")
            throw new SupplierValidationException("Este movimiento se corrige desde la operación que lo originó.");
        if (transaction.Type is not ("purchase" or "reserved_purchase" or "payment" or "reserved_adjustment" or "current_account_adjustment" or "reserved_exchange"))
            throw new SupplierValidationException("Este tipo de movimiento no se puede editar ni eliminar.");
    }

    internal static SupplierTransaction ValidateReplacement(string type, UpdateSupplierTransactionRequest request)
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

    internal static void EnsureCanApply(Supplier supplier, SupplierTransaction transaction)
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

    internal static void EnsureNonNegativeBalances(Supplier supplier)
    {
        if (supplier.ReservedCashBalance < 0 || supplier.ReservedMercadoPagoBalance < 0 || supplier.CurrentAccountBalance < 0)
            throw new SupplierValidationException("La operación dejaría un saldo negativo.");
    }

    internal static void ApplyTransactionEffect(Supplier supplier, SupplierTransaction transaction, decimal direction)
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

    internal sealed class Balances(decimal reservedCash, decimal reservedMercadoPago, decimal reserved, decimal currentAccount)
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

    internal static string? NormalizeNote(string? note) => string.IsNullOrWhiteSpace(note) ? null : note.Trim()[..Math.Min(note.Trim().Length, 250)];
}
