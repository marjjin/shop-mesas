using Microsoft.EntityFrameworkCore;

namespace GestionMesas.Api;

public static class OrdersEndpoints
{
    public static RouteGroupBuilder MapOrdersEndpoints(this RouteGroupBuilder api)
    {
        api.MapPost("/orders", CreateAsync);
        api.MapPatch("/orders/{id:int}", UpdateAsync);
        api.MapDelete("/orders/{id:int}", DeleteAsync);
        return api;
    }

    private static async Task<IResult> CreateAsync(OrderRequest request, RestaurantContext db)
    {
        var table = await db.Tables.FindAsync(request.TableId);
        if (table is null || !await db.Products.AnyAsync(product => product.Id == request.ProductId)) return Results.BadRequest();
        var now = DateTime.UtcNow;
        if (table.Status != "occupied") {
            table.Status = "occupied";
            table.CoworkingDisabled = false;
            table.OpenedAt = now;
        }
        table.LastConsumptionAt = now;
        var order = new Order {
            TableId = request.TableId, ProductId = request.ProductId, Quantity = Math.Max(1, request.Quantity), CreatedAt = now
        };
        db.Orders.Add(order);
        await db.SaveChangesAsync();
        return Results.Created($"/api/orders/{order.Id}", new {
            order, table
        });
    }

    private static async Task<IResult> UpdateAsync(int id, UpdateOrderRequest request, RestaurantContext db)
    {
        var order = await db.Orders.FindAsync(id);
        if (order is null) return Results.NotFound();
        var table = await db.Tables.FindAsync(order.TableId);
        if (table is null || table.Status != "occupied" || table.OpenedAt is null) return Results.BadRequest();

        var isCoworkingCharge = await OrderConsumption.IsCoworkingChargeAsync(db, order.ProductId);
        if (isCoworkingCharge) return Results.Conflict();

        var createdAt = request.CreatedAt.UtcDateTime;
        if (createdAt < table.OpenedAt.Value || createdAt > DateTime.UtcNow) return Results.BadRequest();

        order.CreatedAt = createdAt;
        var lastOtherConsumptionAt = await OrderConsumption.LatestOtherConsumptionAsync(db, order.TableId, id);
        table.LastConsumptionAt = lastOtherConsumptionAt.HasValue && lastOtherConsumptionAt.Value > createdAt
            ? lastOtherConsumptionAt.Value
            : createdAt;
        await db.SaveChangesAsync();
        return Results.Ok(new { order, table });
    }

    private static async Task<IResult> DeleteAsync(int id, RestaurantContext db)
    {
        var order = await db.Orders.FindAsync(id);
        if (order is null) return Results.NotFound();
        var isCoworkingCharge = await OrderConsumption.IsCoworkingChargeAsync(db, order.ProductId);

        var table = await db.Tables.FindAsync(order.TableId);
        db.Orders.Remove(order);
        if (table is not null)
        {
            if (isCoworkingCharge) table.CoworkingDisabled = true;
            var lastRemainingOrderAt = await OrderConsumption.LatestOtherConsumptionAsync(db, order.TableId, id);
            table.LastConsumptionAt = lastRemainingOrderAt ?? table.OpenedAt;
        }

        await db.SaveChangesAsync();
        return Results.NoContent();
    }
}
