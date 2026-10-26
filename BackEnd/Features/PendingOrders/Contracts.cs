namespace GestionMesas.Api;

public sealed record CreatePendingOrderRequest(string CustomerName);

public sealed record AddPendingOrderItemRequest(int ProductId, int Quantity);

public sealed record AssignPendingOrderRequest(int TableId);
