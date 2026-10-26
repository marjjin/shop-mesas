namespace GestionMesas.Api;

public class Order
{
    public int Id { get; set; }
    public int TableId { get; set; }
    public int ProductId { get; set; }
    public int Quantity { get; set; } = 1;
    public DateTime CreatedAt { get; set; }
}
