using Microsoft.EntityFrameworkCore;

namespace GestionMesas.Api;

public static class PendingOrdersEndpoints
{
    public static RouteGroupBuilder MapPendingOrdersEndpoints(this RouteGroupBuilder api)
    {
        api.MapPost("/pending-orders", CreateAsync);
        api.MapDelete("/pending-orders/{id:int}", DeleteAsync);
        api.MapPost("/pending-orders/{id:int}/items", AddItemAsync);
        api.MapDelete("/pending-order-items/{id:int}", DeleteItemAsync);
        api.MapPost("/pending-orders/{id:int}/assign", AssignAsync);
        return api;
    }

    private static async Task<IResult> CreateAsync(CreatePendingOrderRequest request, RestaurantContext db)
    {
        var customerName = request.CustomerName.Trim();
        if (string.IsNullOrWhiteSpace(customerName) || customerName.Length > 80) return Results.BadRequest();
        var pendingOrder = new PendingOrder { CustomerName = customerName, CreatedAt = DateTime.UtcNow };
        db.PendingOrders.Add(pendingOrder);
        await db.SaveChangesAsync();
        return Results.Created($"/api/pending-orders/{pendingOrder.Id}", pendingOrder);
    }

    private static async Task<IResult> DeleteAsync(int id, RestaurantContext db)
    {
        var pendingOrder = await db.PendingOrders.FindAsync(id);
        if (pendingOrder is null) return Results.NotFound();
        db.PendingOrders.Remove(pendingOrder);
        await db.SaveChangesAsync();
        return Results.NoContent();
    }

    private static async Task<IResult> AddItemAsync(int id, AddPendingOrderItemRequest request, RestaurantContext db)
    {
        if (!await db.PendingOrders.AnyAsync(order => order.Id == id)) return Results.NotFound();
        var product = await db.Products.FindAsync(request.ProductId);
        if (product is null || product.Name is CoworkingBilling.HalfHourProductName or CoworkingBilling.HourProductName)
            return Results.BadRequest();

        var item = await db.PendingOrderItems.FirstOrDefaultAsync(existing => existing.PendingOrderId == id && existing.ProductId == request.ProductId);
        if (item is null)
        {
            item = new PendingOrderItem { PendingOrderId = id, ProductId = request.ProductId, Quantity = Math.Max(1, request.Quantity), CreatedAt = DateTime.UtcNow };
            db.PendingOrderItems.Add(item);
        }
        else
            item.Quantity += Math.Max(1, request.Quantity);

        await db.SaveChangesAsync();
        return Results.Ok(item);
    }

    private static async Task<IResult> DeleteItemAsync(int id, RestaurantContext db)
    {
        var item = await db.PendingOrderItems.FindAsync(id);
        if (item is null) return Results.NotFound();
        db.PendingOrderItems.Remove(item);
        await db.SaveChangesAsync();
        return Results.NoContent();
    }

    private static async Task<IResult> AssignAsync(int id, AssignPendingOrderRequest request, RestaurantContext db, CancellationToken cancellationToken)
    {
        var assignment = await PendingOrderWorkflow.AssignAsync(db, id, request.TableId, DateTime.UtcNow, cancellationToken);
        return assignment.Status switch
        {
            PendingOrderAssignmentStatus.Success => Results.Ok(new { table = assignment.Table }),
            PendingOrderAssignmentStatus.PendingOrderNotFound => Results.NotFound(),
            PendingOrderAssignmentStatus.TableNotAvailable => Results.Conflict(),
            _ => Results.BadRequest()
        };
    }
}
