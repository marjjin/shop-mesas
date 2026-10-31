// Una mesa del salón. Status vale free u occupied.
namespace GestionMesas.Api;

public class RestaurantTable
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string? CustomerName { get; set; }
    public int Seats { get; set; } = 4;
    // Posición y tamaño en el plano, en píxeles.
    public int X { get; set; } = 60;
    public int Y { get; set; } = 60;
    public int Width { get; set; } = 138;
    public int Height { get; set; } = 96;
    public string Status { get; set; } = "free";
    // Hora de apertura: reloj de tiempo en mesa.
    public DateTime? OpenedAt { get; set; }
    // Último consumo real: reloj de sin consumir y referencia para el coworking.
    public DateTime? LastConsumptionAt { get; set; }
    // True cuando alguien quitó un cargo de coworking: pausa los cargos hasta reabrir la mesa.
    public bool CoworkingDisabled { get; set; }
}
