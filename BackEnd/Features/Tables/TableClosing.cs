using Microsoft.EntityFrameworkCore;

namespace GestionMesas.Api;

// Una transacción garantiza que no quede una mesa a medio cerrar si algo falla.
// Archives the consumed items and frees a validated, open table atomically.
internal static class TableClosing
{
    public static async Task<CloseTableResponse> CloseAsync(RestaurantContext db, RestaurantTable table)
    {
        await using var transaction = await db.Database.BeginTransactionAsync();
        var closedAt = DateTime.UtcNow;
        var orders = await db.Orders.Where(order => order.TableId == table.Id).OrderBy(order => order.CreatedAt).ToListAsync();
        var productIds = orders.Select(order => order.ProductId).Distinct().ToList();
        var products = await db.Products.Where(product => productIds.Contains(product.Id)).ToDictionaryAsync(product => product.Id);
        // Primero se guarda el encabezado para obtener su Id.
        var history = new ClosedTableHistory { TableName = table.Name, OpenedAt = table.OpenedAt!.Value, ClosedAt = closedAt };
        db.ClosedTableHistories.Add(history);
        await db.SaveChangesAsync();

        // Copia el nombre del producto: el historial debe sobrevivir aunque el artículo se borre después.
        db.ClosedTableHistoryItems.AddRange(orders.Select(order => new ClosedTableHistoryItem
        {
            ClosedTableHistoryId = history.Id,
            ProductName = products.TryGetValue(order.ProductId, out var product) ? product.Name : "Artículo eliminado",
            Quantity = order.Quantity,
            CreatedAt = order.CreatedAt
        }));
        // Libera la mesa y borra sus consumos, ya archivados.
        table.Status = "free";
        table.CustomerName = null;
        table.CoworkingDisabled = false;
        table.OpenedAt = table.LastConsumptionAt = null;
        db.Orders.RemoveRange(orders);
        await db.SaveChangesAsync();
        await transaction.CommitAsync();
        return new CloseTableResponse(table, history.Id, new ClosedTableReceipt(
            history.Id, history.TableName, history.OpenedAt, history.ClosedAt,
            orders.Select(order => new ClosedTableReceiptItem(
                order.Id, products.TryGetValue(order.ProductId, out var product) ? product.Name : "Artículo eliminado",
                order.Quantity, order.CreatedAt))));
    }
}
