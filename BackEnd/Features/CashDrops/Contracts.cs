namespace GestionMesas.Api;

/// <summary>Retiro físico de efectivo registrado durante un turno abierto.</summary>
public sealed record CreateCashDropRequest(decimal Amount, DateOnly BusinessDate, string Shift);

public sealed record UpdateCashDropRequest(decimal Amount);

/// <summary>Cierre completo de un turno.</summary>
public sealed record CashDropResponse(int Id, decimal Amount, DateOnly BusinessDate, string Shift, DateTimeOffset CreatedAt, bool IsClosed);

public sealed record OpenCashDropsResponse(DateOnly BusinessDate, string? Shift, IReadOnlyList<CashDropResponse> CashDrops);
