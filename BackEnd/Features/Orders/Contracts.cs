namespace GestionMesas.Api;

public record OrderRequest(int TableId, int ProductId, int Quantity);

/// <summary>Datos permitidos para modificar un consumo.</summary>
public sealed record UpdateOrderRequest(DateTimeOffset CreatedAt);
