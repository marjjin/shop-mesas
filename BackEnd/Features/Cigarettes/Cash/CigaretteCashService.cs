using Microsoft.EntityFrameworkCore;

namespace GestionMesas.Api;

public sealed record CigaretteCashAmountsResponse(decimal Sales, decimal Purchases, decimal ReservedCash, decimal ReservedMercadoPago,
    decimal CashPurchases, decimal MercadoPagoPurchases, decimal CashBalance, decimal MercadoPagoBalance, decimal Balance,
    int MissingPurchaseAmounts, int MissingReservations, int ClosedShifts);
public sealed record CigaretteCashShiftResponse(string Shift, CigaretteCashAmountsResponse Amounts);
public sealed record CigaretteCashDayResponse(DateOnly BusinessDate, CigaretteCashAmountsResponse Amounts, IReadOnlyList<CigaretteCashShiftResponse> Shifts);
public sealed record CigaretteCashResponse(CigaretteCashAmountsResponse Totals, CigaretteCashDayResponse SelectedDay,
    IReadOnlyList<CigaretteCashDayResponse> Days, int TotalDays, int Page, int PageSize);

public sealed class CigaretteCashService(RestaurantContext db)
{
    public async Task<CigaretteCashResponse> GetAsync(DateOnly date, int page, int pageSize, CancellationToken cancellationToken)
    {
        if (page is < 1 or > 1000000 || pageSize is < 1 or > 50)
            throw new CigaretteValidationException("La página y el tamaño del historial no son válidos.");
        // Derive from the source records so edits, deletions and moved closes never duplicate funds.
        var closes = await db.CigaretteShiftCloses.AsNoTracking()
            .Select(close => new { close.BusinessDate, close.Shift, close.CigaretteReservedCash, close.CigaretteReservedMercadoPago,
                Sales = close.Items.Sum(item => item.SalesAmount) }).ToListAsync(cancellationToken);
        var purchases = await db.CigarettePurchases.AsNoTracking()
            .GroupBy(purchase => new { purchase.BusinessDate, purchase.Shift })
            .Select(grouped => new { grouped.Key.BusinessDate, grouped.Key.Shift,
                Cash = grouped.Sum(purchase => purchase.PaymentMethod == "cash" ? purchase.TotalCost ?? 0 : 0),
                MercadoPago = grouped.Sum(purchase => purchase.PaymentMethod == "mercadoPago" ? purchase.TotalCost ?? 0 : 0),
                Missing = grouped.Count(purchase => purchase.TotalCost == null) }).ToListAsync(cancellationToken);
        var dates = closes.Select(item => item.BusinessDate).Concat(purchases.Select(item => item.BusinessDate))
            .Distinct().OrderByDescending(value => value).ToList();
        var closesByShift = closes.ToDictionary(item => (item.BusinessDate, item.Shift));
        var purchasesByShift = purchases.ToDictionary(item => (item.BusinessDate, item.Shift));
        CigaretteCashDayResponse Day(DateOnly businessDate)
        {
            var shifts = new[] { "morning", "afternoon" }.Select(shift =>
            {
                var close = closesByShift.GetValueOrDefault((businessDate, shift));
                var bought = purchasesByShift.GetValueOrDefault((businessDate, shift));
                var cash = close?.CigaretteReservedCash ?? 0;
                var mercadoPago = close?.CigaretteReservedMercadoPago ?? 0;
                var cashPurchases = bought?.Cash ?? 0;
                var mercadoPagoPurchases = bought?.MercadoPago ?? 0;
                var missing = close is not null && (close.CigaretteReservedCash == null || close.CigaretteReservedMercadoPago == null) ? 1 : 0;
                return new CigaretteCashShiftResponse(shift, new(close?.Sales ?? 0, cashPurchases + mercadoPagoPurchases, cash, mercadoPago,
                    cashPurchases, mercadoPagoPurchases, cash - cashPurchases, mercadoPago - mercadoPagoPurchases,
                    cash + mercadoPago - cashPurchases - mercadoPagoPurchases, bought?.Missing ?? 0, missing, close is null ? 0 : 1));
            }).ToList();
            return new(businessDate, Sum(shifts.Select(item => item.Amounts)), shifts);
        }
        var days = dates.Select(Day).ToList();
        var lastPage = Math.Max(1, (days.Count + pageSize - 1) / pageSize);
        page = Math.Min(page, lastPage);
        return new(Sum(days.Select(day => day.Amounts)), Day(date), days.Skip((page - 1) * pageSize).Take(pageSize).ToList(), days.Count, page, pageSize);
    }

    private static CigaretteCashAmountsResponse Sum(IEnumerable<CigaretteCashAmountsResponse> values)
    {
        var list = values.ToList();
        return new(list.Sum(x => x.Sales), list.Sum(x => x.Purchases), list.Sum(x => x.ReservedCash), list.Sum(x => x.ReservedMercadoPago),
            list.Sum(x => x.CashPurchases), list.Sum(x => x.MercadoPagoPurchases), list.Sum(x => x.CashBalance), list.Sum(x => x.MercadoPagoBalance),
            list.Sum(x => x.Balance), list.Sum(x => x.MissingPurchaseAmounts), list.Sum(x => x.MissingReservations), list.Sum(x => x.ClosedShifts));
    }
}
