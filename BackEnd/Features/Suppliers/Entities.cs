namespace GestionMesas.Api;

public class Supplier
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public decimal ReservedBalance { get; set; }
    public decimal ReservedCashBalance { get; set; }
    public decimal ReservedMercadoPagoBalance { get; set; }
    public decimal CurrentAccountBalance { get; set; }
    public bool IsSeparateCashBox { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; }
}

public class SupplierTransaction
{
    public int Id { get; set; }
    public int SupplierId { get; set; }
    public int? CigaretteShiftCloseId { get; set; }
    public string Type { get; set; } = "";
    public decimal Amount { get; set; }
    public decimal CashAmount { get; set; }
    public decimal MercadoPagoAmount { get; set; }
    public DateOnly BusinessDate { get; set; }
    public string? Note { get; set; }
    public DateTime CreatedAt { get; set; }
}
