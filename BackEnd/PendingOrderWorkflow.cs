using Microsoft.EntityFrameworkCore;

namespace GestionMesas.Api;

public enum PendingOrderAssignmentStatus
{
    Success,
    PendingOrderNotFound,
    TableNotAvailable,
    EmptyOrder
}

public sealed record PendingOrderAssignmentResult(PendingOrderAssignmentStatus Status, RestaurantTable? Table = null);

public static class PendingOrderWorkflow
{
    public static async Task<PendingOrderAssignmentResult> AssignAsync(
        RestaurantContext db,
        int pendingOrderId,
        int tableId,
        DateTime assignedAt,
        CancellationToken cancellationToken = default)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        var pendingOrder = await db.PendingOrders.FindAsync([pendingOrderId], cancellationToken);
        if (pendingOrder is null)
            return new(PendingOrderAssignmentStatus.PendingOrderNotFound);

        var items = await db.PendingOrderItems
            .Where(item => item.PendingOrderId == pendingOrderId)
            .ToListAsync(cancellationToken);
        if (items.Count == 0)
            return new(PendingOrderAssignmentStatus.EmptyOrder);

        var updatedTables = await db.Tables
            .Where(table => table.Id == tableId && table.Status == "free")
            .ExecuteUpdateAsync(setters => setters
                .SetProperty(table => table.CustomerName, pendingOrder.CustomerName)
                .SetProperty(table => table.Status, "occupied")
                .SetProperty(table => table.CoworkingDisabled, false)
                .SetProperty(table => table.OpenedAt, assignedAt)
                .SetProperty(table => table.LastConsumptionAt, assignedAt), cancellationToken);
        if (updatedTables == 0)
            return new(PendingOrderAssignmentStatus.TableNotAvailable);

        var table = await db.Tables.FindAsync([tableId], cancellationToken)
            ?? throw new InvalidOperationException("La mesa reservada dejó de existir.");
        await db.Entry(table).ReloadAsync(cancellationToken);
        db.Orders.AddRange(items.Select(item => new Order
        {
            TableId = table.Id,
            ProductId = item.ProductId,
            Quantity = item.Quantity,
            CreatedAt = assignedAt
        }));
        db.PendingOrders.Remove(pendingOrder);
        await db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return new(PendingOrderAssignmentStatus.Success, table);
    }
}