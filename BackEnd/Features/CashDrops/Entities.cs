namespace GestionMesas.Api;

public class CashDrop
{
    public int Id { get; set; }
    public decimal Amount { get; set; }
    public DateOnly BusinessDate { get; set; }
    public string Shift { get; set; } = "morning";
    public DateTime CreatedAt { get; set; }
    public int? CigaretteShiftCloseId { get; set; }
}
