namespace GestionMesas.Api;

public class ClosedTableHistory
{
    public int Id { get; set; }
    public string TableName { get; set; } = "";
    public DateTime OpenedAt { get; set; }
    public DateTime ClosedAt { get; set; }
}

public class ClosedTableHistoryItem
{
    public int Id { get; set; }
    public int ClosedTableHistoryId { get; set; }
    public string ProductName { get; set; } = "";
    public int Quantity { get; set; } = 1;
    public DateTime CreatedAt { get; set; }
}
