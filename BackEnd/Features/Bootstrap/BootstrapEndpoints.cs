using Microsoft.EntityFrameworkCore;

namespace GestionMesas.Api;

public static class BootstrapEndpoints
{
    public static RouteGroupBuilder MapBootstrapEndpoints(this RouteGroupBuilder api)
    {
        api.MapGet("/bootstrap", GetAsync);
        return api;
    }

    private static async Task<IResult> GetAsync(RestaurantContext db) =>
        Results.Ok(new
{
    tables = await db.Tables.ToListAsync(),
    products = await db.Products.ToListAsync(),
    categories = await db.Categories.ToListAsync(),
    orders = await db.Orders.ToListAsync(),
    pendingOrders = await db.PendingOrders.OrderBy(order => order.CreatedAt).ToListAsync(),
    pendingOrderItems = await db.PendingOrderItems.OrderBy(item => item.CreatedAt).ToListAsync()
});
}
