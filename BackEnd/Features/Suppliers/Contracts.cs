namespace GestionMesas.Api;

/// <summary>Datos para crear un proveedor.</summary>
public sealed record CreateSupplierRequest(string Name);

/// <summary>Datos para actualizar un proveedor.</summary>
public sealed record UpdateSupplierRequest(string Name, bool IsSeparateCashBox = false);

/// <summary>Importe reservado para un proveedor al cerrar un turno.</summary>
public sealed record SupplierAllocationRequest(int SupplierId, decimal CashAmount, decimal MercadoPagoAmount)
{
    public decimal Amount => CashAmount + MercadoPagoAmount;
}

/// <summary>Pago registrado para descontar el saldo de un proveedor.</summary>
public sealed record CreateSupplierPaymentRequest(decimal CashAmount, decimal MercadoPagoAmount, string? Note)
{
    public decimal Amount => CashAmount + MercadoPagoAmount;
}

/// <summary>Datos editables de un movimiento manual de proveedor.</summary>
public sealed record UpdateSupplierTransactionRequest(decimal Amount, decimal CashAmount = 0, decimal MercadoPagoAmount = 0, string? Note = null);

/// <summary>Compra a cuenta que incrementa el saldo pendiente de un proveedor.</summary>
public sealed record CreateSupplierPurchaseRequest(decimal Amount, string? Note, string PaymentMethod, decimal CashAmount = 0, decimal MercadoPagoAmount = 0);

/// <summary>Transferencia de fondos reservados entre proveedores.</summary>
public sealed record CreateSupplierReservedFundsTransferRequest(int SourceSupplierId, int TargetSupplierId, decimal CashAmount, decimal MercadoPagoAmount, string? Note)
{
    public decimal Amount => CashAmount + MercadoPagoAmount;
}

public sealed record CreateSupplierReservedFundsExchangeRequest(decimal Amount, string FromPaymentMethod, string? Note);

/// <summary>Saldos iniciales o corregidos de un proveedor.</summary>
public sealed record UpdateSupplierBalancesRequest(decimal ReservedCashBalance, decimal ReservedMercadoPagoBalance, decimal CurrentAccountBalance, string? Note)
{
    public decimal ReservedBalance => ReservedCashBalance + ReservedMercadoPagoBalance;
}

/// <summary>Movimiento de saldo de un proveedor.</summary>
public sealed record SupplierTransactionResponse(int Id, string Type, decimal Amount, decimal CashAmount, decimal MercadoPagoAmount, decimal BalanceAfter, DateOnly BusinessDate, string? Shift, string? Note, DateTimeOffset CreatedAt);

/// <summary>Proveedor y sus movimientos de saldo.</summary>
public sealed record SupplierResponse(int Id, string Name, decimal ReservedBalance, decimal ReservedCashBalance, decimal ReservedMercadoPagoBalance, decimal CurrentAccountBalance, bool IsSeparateCashBox, bool IsActive, IReadOnlyList<SupplierTransactionResponse> Transactions);

/// <summary>Asignación reservada para un proveedor en un cierre.</summary>
public sealed record SupplierAllocationResponse(int SupplierId, string SupplierName, decimal Amount, decimal CashAmount, decimal MercadoPagoAmount, decimal Balance);
