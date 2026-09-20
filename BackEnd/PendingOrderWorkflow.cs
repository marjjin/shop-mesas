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
        var pendingOrder = await db.PendingOrders.FindAsync([pendingOrderId], cancellationToken);
        if (pendingOrder is null)
            return new(PendingOrderAssignmentStatus.PendingOrderNotFound);

        var table = await db.Tables.FindAsync([tableId], cancellationToken);
        if (table is null || table.Status != "free")
            return new(PendingOrderAssignmentStatus.TableNotAvailable);

        var items = await db.PendingOrderItems
            .Where(item => item.PendingOrderId == pendingOrderId)
            .ToListAsync(cancellationToken);
        if (items.Count == 0)
            return new(PendingOrderAssignmentStatus.EmptyOrder);

        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        table.CustomerName = pendingOrder.CustomerName;
        table.Status = "occupied";
        table.CoworkingDisabled = false;
        table.OpenedAt = table.LastConsumptionAt = assignedAt;
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