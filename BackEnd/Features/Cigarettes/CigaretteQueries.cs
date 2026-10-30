using Microsoft.EntityFrameworkCore;
using static GestionMesas.Api.CigaretteMapping;

namespace GestionMesas.Api;

internal sealed class CigaretteQueries(RestaurantContext db, ICafeteriaService? cafeteria = null)
{
    private static readonly IReadOnlyDictionary<string, int> SpreadsheetOrder = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase)
    {
        ["PHILIP BOX 20"] = 0, ["PHILIP KS 20"] = 1, ["PHILIP RED 20 KS"] = 2, ["PHILIP BLUE 20 KS"] = 3, ["PHILIP CAP 20"] = 4, ["PHILIP 12"] = 5, ["PHILIP CAP 12"] = 6,
        ["RED POINT KS 20"] = 7, ["RED POINT MENT 20"] = 8, ["RED POINT SIX 20"] = 9,
        ["MARLBORO BOX 20"] = 10, ["MARLBORO KS 20"] = 11, ["MARLBORO 12"] = 12, ["MARLBORO MENT XL 20"] = 13, ["MARLBORO CORAL XL 20"] = 14, ["MARLBORO UVA XL 20"] = 15, ["MARLBORO UVA 12"] = 16, ["MARLBORO BLUE TITANIUM"] = 17, ["MARLBORO GOLD TITANIUM"] = 18,
        ["MARLBORO CRAFTER KS 20"] = 19, ["MARLBORO CRAFTER BOX 20"] = 20, ["MARLBORO CRAFTER CORAL 20"] = 21, ["MARLBORO CRAFTER UVA 20"] = 22, ["MARLBORO CRAFTER MENT KS 20"] = 23, ["MARLBORO CRAFTER MENT BOX 20"] = 24, ["MARLBORO CRAFTER SUAVE 20"] = 25,
        ["HARMONY 20"] = 26, ["CHESTER KS 20"] = 27, ["CHESTER 12"] = 28, ["CHESTER MENT KS 20"] = 29, ["CHESTER MENT BOX 20"] = 30, ["CHESTER UVA BOX 20"] = 31, ["CHESTER MENT 12"] = 32, ["CAMEL BOX 20"] = 33,
        ["LUCKIES KS 20"] = 34, ["LUCKY KS 20"] = 35, ["LUCKY MENT KS 20"] = 36, ["LUCKY ORIGEN KS 20"] = 37, ["LUCKY ORIGEN MENT KS 20"] = 38, ["LUCKY DOBLE PLUS XL 20"] = 39, ["LUCKY MENT XL 20"] = 40, ["LUCKY MENT 12"] = 41
    };

    public async Task<CigaretteDashboardResponse> GetDashboardAsync(DateOnly date, CancellationToken cancellationToken)
    {
        var products = await db.CigaretteProducts.AsNoTracking().Where(product => product.IsActive)
            .ToListAsync(cancellationToken);
        var orderedProducts = products.OrderBy(product => GetSpreadsheetOrder(product.Name)).ThenBy(product => product.CreatedAt).ThenBy(product => product.Id)
            .Select(ToResponse).ToList();
        var purchases = await LoadPurchasesAsync(date, cancellationToken);
        var closes = await LoadClosesAsync(close => close.BusinessDate == date, cancellationToken);
        var cashDrops = await db.CashDrops.AsNoTracking()
            .Where(drop => drop.BusinessDate == date)
            .OrderByDescending(drop => drop.CreatedAt)
            .Select(drop => CashDropService.ToResponse(drop))
            .ToListAsync(cancellationToken);
        return new CigaretteDashboardResponse(date, orderedProducts, purchases, closes, cashDrops);
    }

    public Task<IReadOnlyList<CigaretteShiftCloseResponse>> GetClosesAsync(DateOnly from, DateOnly to, CancellationToken cancellationToken)
    {
        if (from > to) throw new CigaretteValidationException("La fecha desde no puede ser posterior a la fecha hasta.");
        return LoadClosesAsync(close => close.BusinessDate >= from && close.BusinessDate <= to, cancellationToken);
    }

    private async Task<IReadOnlyList<CigarettePurchaseResponse>> LoadPurchasesAsync(DateOnly date, CancellationToken cancellationToken)
    {
        var query = from purchase in db.CigarettePurchases.AsNoTracking()
                    join product in db.CigaretteProducts.AsNoTracking() on purchase.CigaretteProductId equals product.Id
                    where purchase.BusinessDate == date
                    orderby purchase.CreatedAt descending
                    select new CigarettePurchaseResponse(purchase.Id, purchase.CigaretteProductId, product.Name, purchase.Quantity, purchase.BusinessDate, purchase.Shift, new DateTimeOffset(purchase.CreatedAt, TimeSpan.Zero), purchase.TotalCost, purchase.PaymentMethod);
        return await query.ToListAsync(cancellationToken);
    }

    private async Task<IReadOnlyList<CigaretteShiftCloseResponse>> LoadClosesAsync(System.Linq.Expressions.Expression<Func<CigaretteShiftClose, bool>> predicate, CancellationToken cancellationToken)
    {
        var closes = await db.CigaretteShiftCloses.AsNoTracking().Where(predicate).Include(close => close.Items)
            .OrderByDescending(close => close.BusinessDate).ThenByDescending(close => close.Shift).ToListAsync(cancellationToken);
        var responses = new List<CigaretteShiftCloseResponse>(closes.Count);
        foreach (var close in closes)
            responses.Add(await ToResponseAsync(close, cancellationToken));
        return responses;
    }

    private static int GetSpreadsheetOrder(string name) => SpreadsheetOrder.GetValueOrDefault(string.Join(' ', name.Trim().Split(' ', StringSplitOptions.RemoveEmptyEntries)), int.MaxValue);

    public async Task<CigaretteShiftCloseResponse> ToResponseAsync(CigaretteShiftClose close, CancellationToken cancellationToken)
    {
        var items = close.Items.OrderBy(item => GetSpreadsheetOrder(item.ProductName)).ThenBy(item => item.Id).Select(item => new CigaretteShiftCloseItemResponse(item.CigaretteProductId, item.ProductName, item.UnitPrice, item.InitialStock, item.PurchasedQuantity, item.FinalStock, item.SoldQuantity, item.SalesAmount)).ToList();
        var closedAt = AsUtc(close.ClosedAt);
        var summary = new CafeteriaSalesSummaryResponse(0, 0, []);
        try
        {
            summary = await (cafeteria ?? new CafeteriaService(db)).GetSummaryAsync(close.BusinessDate, close.Shift, cancellationToken);
        }
        catch (Exception)
        {
            // El resumen es adicional: los cierres anteriores a Caja Cafetería deben seguir siendo consultables.
        }

        var allocations = await (from transaction in db.SupplierTransactions.AsNoTracking()
                                 join supplier in db.Suppliers.AsNoTracking() on transaction.SupplierId equals supplier.Id
                                 where transaction.CigaretteShiftCloseId == close.Id && transaction.Type == "allocation"
                                 orderby supplier.Name
                                 select new SupplierAllocationResponse(supplier.Id, supplier.Name, transaction.Amount, transaction.CashAmount, transaction.MercadoPagoAmount, supplier.ReservedBalance))
            .ToListAsync(cancellationToken);
        var cashDrops = await db.CashDrops.AsNoTracking()
            .Where(drop => drop.CigaretteShiftCloseId == close.Id)
            .OrderBy(drop => drop.CreatedAt)
            .Select(drop => CashDropService.ToResponse(drop))
            .ToListAsync(cancellationToken);
        return new CigaretteShiftCloseResponse(close.Id, close.BusinessDate, close.Shift, new DateTimeOffset(closedAt), items.Sum(item => item.SoldQuantity), items.Sum(item => item.SalesAmount), items, summary, allocations, close.EndingCashBalance, close.EndingMercadoPagoBalance, close.NextShiftChangeCash, close.ReceivedChangeCash, close.PosnetTotal, cashDrops, cashDrops.Sum(drop => drop.Amount), close.CigaretteReservedCash, close.CigaretteReservedMercadoPago);
    }

    private static DateTime AsUtc(DateTime value) => value.Kind == DateTimeKind.Utc
        ? value
        : DateTime.SpecifyKind(value, DateTimeKind.Utc);
}
