using Microsoft.EntityFrameworkCore;

namespace GestionMesas.Api;

public static class TablesEndpoints
{
    public static RouteGroupBuilder MapTablesEndpoints(this RouteGroupBuilder api)
    {
        api.MapPost("/tables", CreateAsync);
        api.MapDelete("/tables/{id:int}", DeleteAsync);
        api.MapPatch("/tables/{id:int}", UpdateAsync);
        api.MapPost("/tables/{id:int}/open", OpenAsync);
        api.MapPost("/tables/{id:int}/close", CloseAsync);
        return api;
    }

    private static async Task<IResult> CreateAsync(TableRequest request, RestaurantContext db)
    {
        var table = new RestaurantTable {
            Name = string.IsNullOrWhiteSpace(request.Name) ? $"Mesa {await db.Tables.CountAsync() + 1}" : request.Name, Seats = request.Seats.GetValueOrDefault(4)
        };
        db.Tables.Add(table);
        await db.SaveChangesAsync();
        return Results.Created($"/api/tables/{table.Id}", table);
    }

    private static async Task<IResult> DeleteAsync(int id, RestaurantContext db, CancellationToken cancellationToken)
    {
        var table = await db.Tables.FindAsync([id], cancellationToken);
        if (table is null) return Results.NotFound();

        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        var orders = await db.Orders.Where(order => order.TableId == id).ToListAsync(cancellationToken);
        db.Orders.RemoveRange(orders);
        db.Tables.Remove(table);
        await db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return Results.NoContent();
    }

    private static async Task<IResult> UpdateAsync(int id, TablePatch patch, RestaurantContext db)
    {
        var table = await db.Tables.FindAsync(id);
        if (table is null) return Results.NotFound();

        if (patch.OpenedAt.HasValue)
        {
            if (table.Status != "occupied") return Results.BadRequest();
            var openedAt = patch.OpenedAt.Value.UtcDateTime;
            var firstOrderAt = await db.Orders.Where(order => order.TableId == id)
                .Select(order => (DateTime?)order.CreatedAt).MinAsync();
            if (openedAt > DateTime.UtcNow || firstOrderAt.HasValue && openedAt > firstOrderAt.Value)
                return Results.BadRequest();

            table.OpenedAt = openedAt;
            if (!firstOrderAt.HasValue) table.LastConsumptionAt = openedAt;
        }

        table.Name = patch.Name ?? table.Name;
        table.Seats = patch.Seats ?? table.Seats;
        table.X = patch.X ?? table.X;
        table.Y = patch.Y ?? table.Y;
        table.Width = patch.Width ?? table.Width;
        table.Height = patch.Height ?? table.Height;
        await db.SaveChangesAsync();
        return Results.Ok(table);
    }

    private static async Task<IResult> OpenAsync(int id, OpenTableRequest request, RestaurantContext db)
    {
        var customerName = request.CustomerName.Trim();
        if (string.IsNullOrWhiteSpace(customerName) || customerName.Length > 80) return Results.BadRequest();
        var table = await db.Tables.FindAsync(id);
        if (table is null) return Results.NotFound();
        table.CustomerName = customerName;
        table.Status = "occupied";
        table.CoworkingDisabled = false;
        table.OpenedAt = table.LastConsumptionAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return Results.Ok(table);
    }

    private static async Task<IResult> CloseAsync(int id, RestaurantContext db)
    {
        var table = await db.Tables.FindAsync(id);
        if (table is null) return Results.NotFound();
        if (table.Status != "occupied" || table.OpenedAt is null) return Results.BadRequest();

        return Results.Ok(await TableClosing.CloseAsync(db, table));
    }
}
