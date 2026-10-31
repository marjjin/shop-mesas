// Rutas para agregar, reubicar en el tiempo y quitar consumos de una mesa.
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

    // Agrega un consumo. Si la mesa estaba libre, la abre automáticamente.
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
        // Cada consumo reinicia el reloj de sin consumir.
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

    // Permite corregir la hora de un consumo.
    private static async Task<IResult> UpdateAsync(int id, UpdateOrderRequest request, RestaurantContext db)
    {
        var order = await db.Orders.FindAsync(id);
        if (order is null) return Results.NotFound();
        var table = await db.Tables.FindAsync(order.TableId);
        if (table is null || table.Status != "occupied" || table.OpenedAt is null) return Results.BadRequest();

        var isCoworkingCharge = await OrderConsumption.IsCoworkingChargeAsync(db, order.ProductId);
        // Un cargo de coworking no se reubica: su hora la calcula el sistema.
        if (isCoworkingCharge) return Results.Conflict();

        var createdAt = request.CreatedAt.UtcDateTime;
        // La hora debe estar entre la apertura de la mesa y el momento actual.
        if (createdAt < table.OpenedAt.Value || createdAt > DateTime.UtcNow) return Results.BadRequest();

        order.CreatedAt = createdAt;
        var lastOtherConsumptionAt = await OrderConsumption.LatestOtherConsumptionAsync(db, order.TableId, id);
        // LastConsumptionAt debe seguir siendo el consumo más reciente.
        table.LastConsumptionAt = lastOtherConsumptionAt.HasValue && lastOtherConsumptionAt.Value > createdAt
            ? lastOtherConsumptionAt.Value
            : createdAt;
        await db.SaveChangesAsync();
        return Results.Ok(new { order, table });
    }

    // Quita un consumo. Si era un cargo de coworking, pausa los siguientes en esa mesa.
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
            // Sin otros consumos, el reloj vuelve a contar desde la apertura.
            table.LastConsumptionAt = lastRemainingOrderAt ?? table.OpenedAt;
        }

        await db.SaveChangesAsync();
        return Results.NoContent();
    }
}
