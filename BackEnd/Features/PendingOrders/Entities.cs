namespace GestionMesas.Api;

public class PendingOrder
{
    public int Id { get; set; }
    public string CustomerName { get; set; } = "";
    public DateTime CreatedAt { get; set; }
    public List<PendingOrderItem> Items { get; set; } = [];
}

public class PendingOrderItem
{
    public int Id { get; set; }
    public int PendingOrderId { get; set; }
    public int ProductId { get; set; }
    public int Quantity { get; set; } = 1;
    public DateTime CreatedAt { get; set; }
}
