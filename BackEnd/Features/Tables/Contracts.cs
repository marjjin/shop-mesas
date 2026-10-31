// Formas del JSON que entra y sale en las rutas de mesas.
namespace GestionMesas.Api;

public record TableRequest(string? Name, int? Seats);

// Todo es opcional: los campos que llegan null no se modifican.
public record TablePatch(string? Name, int? Seats, int? X, int? Y, int? Width, int? Height, DateTimeOffset? OpenedAt);

public record OpenTableRequest(string CustomerName);

public sealed record CloseTableResponse(RestaurantTable Table, int HistoryId, ClosedTableReceipt History);
public sealed record ClosedTableReceipt(int Id, string TableName, DateTime OpenedAt, DateTime ClosedAt, IEnumerable<ClosedTableReceiptItem> Items);
public sealed record ClosedTableReceiptItem(int Id, string ProductName, int Quantity, DateTime CreatedAt);
