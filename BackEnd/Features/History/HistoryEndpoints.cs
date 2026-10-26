using Microsoft.EntityFrameworkCore;

namespace GestionMesas.Api;

public static class HistoryEndpoints
{
    public static RouteGroupBuilder MapHistoryEndpoints(this RouteGroupBuilder api)
    {
        api.MapGet("/history", GetAsync);
        return api;
    }

    private static async Task<IResult> GetAsync(RestaurantContext db)
    {
        var histories = await db.ClosedTableHistories.OrderByDescending(item => item.ClosedAt).ToListAsync();
        var historyIds = histories.Select(item => item.Id).ToList();
        var items = await db.ClosedTableHistoryItems.Where(item => historyIds.Contains(item.ClosedTableHistoryId)).OrderBy(item => item.CreatedAt).ToListAsync();
        return Results.Ok(histories.Select(history => new
        {
            history.Id,
            history.TableName,
            history.OpenedAt,
            history.ClosedAt,
            items = items.Where(item => item.ClosedTableHistoryId == history.Id).Select(item => new { item.Id, item.ProductName, item.Quantity, item.CreatedAt })
        }));
    }
}
