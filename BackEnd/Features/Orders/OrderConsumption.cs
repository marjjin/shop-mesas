using Microsoft.EntityFrameworkCore;

namespace GestionMesas.Api;

internal static class OrderConsumption
{
    public static Task<bool> IsCoworkingChargeAsync(RestaurantContext db, int productId) =>
        db.Products.AnyAsync(product => product.Id == productId
            && (product.Name == CoworkingBilling.HalfHourProductName || product.Name == CoworkingBilling.HourProductName));

    public static async Task<DateTime?> LatestOtherConsumptionAsync(RestaurantContext db, int tableId, int excludedOrderId)
    {
        var serviceProductIds = await db.Products
            .Where(product => product.Name == CoworkingBilling.HalfHourProductName || product.Name == CoworkingBilling.HourProductName)
            .Select(product => product.Id)
            .ToListAsync();
        return await db.Orders
            .Where(item => item.TableId == tableId && item.Id != excludedOrderId && !serviceProductIds.Contains(item.ProductId))
            .Select(item => (DateTime?)item.CreatedAt)
            .MaxAsync();
    }
}
