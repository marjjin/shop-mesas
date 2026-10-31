// Un proveedor maneja dos saldos distintos:
// - Reservado: dinero del local apartado para ese proveedor, a favor.
// - Cuenta corriente: lo que el local le debe al proveedor.
namespace GestionMesas.Api;

public class Supplier
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    // Siempre igual a efectivo + Mercado Pago.
    public decimal ReservedBalance { get; set; }
    public decimal ReservedCashBalance { get; set; }
    public decimal ReservedMercadoPagoBalance { get; set; }
    public decimal CurrentAccountBalance { get; set; }
    // Caja aparte: su reserva no se descuenta del resultado de Caja en el cierre.
    public bool IsSeparateCashBox { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; }
}

// Movimiento del historial. Amount es el importe; CashAmount y MercadoPagoAmount, el efecto en cada saldo, por eso pueden ser negativos.
public class SupplierTransaction
{
    public int Id { get; set; }
    public int SupplierId { get; set; }
    // Solo tiene valor en las reservas generadas por un cierre.
    public int? CigaretteShiftCloseId { get; set; }
    public string Type { get; set; } = "";
    public decimal Amount { get; set; }
    public decimal CashAmount { get; set; }
    public decimal MercadoPagoAmount { get; set; }
    public DateOnly BusinessDate { get; set; }
    public string? Note { get; set; }
    public DateTime CreatedAt { get; set; }
}
