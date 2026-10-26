namespace GestionMesas.Api;

public class RestaurantTable
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string? CustomerName { get; set; }
    public int Seats { get; set; } = 4;
    public int X { get; set; } = 60;
    public int Y { get; set; } = 60;
    public int Width { get; set; } = 138;
    public int Height { get; set; } = 96;
    public string Status { get; set; } = "free";
    public DateTime? OpenedAt { get; set; }
    public DateTime? LastConsumptionAt { get; set; }
    public bool CoworkingDisabled { get; set; }
}
