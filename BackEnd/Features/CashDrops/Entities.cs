// Tirada: efectivo retirado físicamente de la caja durante un turno.
namespace GestionMesas.Api;

public class CashDrop
{
    public int Id { get; set; }
    public decimal Amount { get; set; }
    public DateOnly BusinessDate { get; set; }
    public string Shift { get; set; } = "morning";
    public DateTime CreatedAt { get; set; }
    // Null mientras el turno está abierto; lo completa el cierre.
    public int? CigaretteShiftCloseId { get; set; }
}
