using Microsoft.EntityFrameworkCore;

namespace GestionMesas.Api;

public interface ICafeteriaService
{
    Task<CafeteriaDashboardResponse> GetDashboardAsync(DateOnly date, CancellationToken cancellationToken);
    Task<CafeteriaDashboardResponse> RegisterSaleAsync(DateOnly date, CancellationToken cancellationToken);
    Task<CafeteriaProductResponse> CreateProductAsync(CreateCafeteriaProductRequest request, CancellationToken cancellationToken);
    Task<CafeteriaProductResponse?> UpdateProductAsync(int id, UpdateCafeteriaProductRequest request, CancellationToken cancellationToken);
    Task<bool> DeleteProductAsync(int id, CancellationToken cancellationToken);
    Task<CafeteriaSalesSummaryResponse> GetSummaryAsync(DateOnly businessDate, string shift, CancellationToken cancellationToken);
    Task<IReadOnlyList<CafeteriaShiftSalesHistoryResponse>> GetShiftHistoryAsync(DateOnly date, CancellationToken cancellationToken);
}

public sealed class CafeteriaService(RestaurantContext db) : ICafeteriaService
{
    public async Task<CafeteriaDashboardResponse> GetDashboardAsync(DateOnly date, CancellationToken cancellationToken)
    {
        var products = await GetProductsAsync(cancellationToken);
        var lastClose = await GetLastCloseAsync(cancellationToken);
        var activeShift = lastClose?.Shift == "morning" ? "afternoon" : "morning";
        var summary = await GetSummaryAfterAsync(lastClose?.ClosedAt, cancellationToken);
        var daySummary = await GetPeriodSummaryAsync(date, date.AddDays(1), cancellationToken);
        var monthStart = new DateOnly(date.Year, date.Month, 1);
        var monthSummary = await GetPeriodSummaryAsync(monthStart, monthStart.AddMonths(1), cancellationToken);
        var recentShiftHistory = await GetRecentShiftHistoryAsync(date, cancellationToken);
        return new CafeteriaDashboardResponse(date, activeShift, products, summary, daySummary, monthSummary, recentShiftHistory);
    }

    public async Task<CafeteriaDashboardResponse> RegisterSaleAsync(DateOnly date, CancellationToken cancellationToken)
    {
        var products = await db.CafeteriaProducts.Where(product => product.IsActive).OrderBy(product => product.CreatedAt).ToListAsync(cancellationToken);
        if (products.Count == 0) throw new CafeteriaValidationException("Primero cargá al menos un artículo en Caja Cafetería.");

        var now = DateTime.UtcNow;
        var sale = new CafeteriaSale
        {
            BusinessDate = date,
            Shift = (await GetLastCloseAsync(cancellationToken))?.Shift == "morning" ? "afternoon" : "morning",
            CreatedAt = now
        };
        sale.Items.AddRange(products.Select(product => new CafeteriaSaleItem { CafeteriaProductId = product.Id, ProductName = product.Name, UnitPrice = product.Price }));
        db.CafeteriaSales.Add(sale);
        await db.SaveChangesAsync(cancellationToken);
        return await GetDashboardAsync(date, cancellationToken);
    }

    public async Task<CafeteriaProductResponse> CreateProductAsync(CreateCafeteriaProductRequest request, CancellationToken cancellationToken)
    {
        var (name, price) = ValidateProduct(request.Name, request.Price);
        var existing = await db.CafeteriaProducts.FirstOrDefaultAsync(product => product.Name.ToLower() == name.ToLower(), cancellationToken);
        if (existing is not null)
        {
            if (existing.IsActive) throw new CafeteriaValidationException("Ya existe un artículo de cafetería con ese nombre.");
            existing.Name = name;
            existing.Price = price;
            existing.IsActive = true;
            await db.SaveChangesAsync(cancellationToken);
            return ToResponse(existing);
        }

        var product = new CafeteriaProduct { Name = name, Price = price, CreatedAt = DateTime.UtcNow };
        db.CafeteriaProducts.Add(product);
        await db.SaveChangesAsync(cancellationToken);
        return ToResponse(product);
    }

    public async Task<CafeteriaProductResponse?> UpdateProductAsync(int id, UpdateCafeteriaProductRequest request, CancellationToken cancellationToken)
    {
        var product = await db.CafeteriaProducts.FirstOrDefaultAsync(item => item.Id == id && item.IsActive, cancellationToken);
        if (product is null) return null;
        var (name, price) = ValidateProduct(request.Name, request.Price);
        if (await db.CafeteriaProducts.AnyAsync(item => item.Id != id && item.Name.ToLower() == name.ToLower(), cancellationToken))
            throw new CafeteriaValidationException("Ya existe un artículo de cafetería con ese nombre.");
        product.Name = name;
        product.Price = price;
        await db.SaveChangesAsync(cancellationToken);
        return ToResponse(product);
    }

    public async Task<bool> DeleteProductAsync(int id, CancellationToken cancellationToken)
    {
        var product = await db.CafeteriaProducts.FirstOrDefaultAsync(item => item.Id == id && item.IsActive, cancellationToken);
        if (product is null) return false;
        product.IsActive = false;
        await db.SaveChangesAsync(cancellationToken);
        return true;
    }

    public async Task<CafeteriaSalesSummaryResponse> GetSummaryAsync(DateOnly businessDate, string shift, CancellationToken cancellationToken)
    {
        var close = await db.CigaretteShiftCloses.AsNoTracking()
            .SingleOrDefaultAsync(item => item.BusinessDate == businessDate && item.Shift == shift, cancellationToken);
        if (close is null)
            return await GetSummaryAsync(sale => sale.BusinessDate == businessDate && sale.Shift == shift, cancellationToken);

        var previousCloseAt = await db.CigaretteShiftCloses.AsNoTracking()
            .Where(item => item.ClosedAt < close.ClosedAt)
            .OrderByDescending(item => item.ClosedAt)
            .Select(item => (DateTime?)item.ClosedAt)
            .FirstOrDefaultAsync(cancellationToken);
        return await GetSummaryAsync(sale =>
            (!previousCloseAt.HasValue || sale.CreatedAt > previousCloseAt.Value) &&
            sale.CreatedAt <= close.ClosedAt, cancellationToken);
    }

    public Task<IReadOnlyList<CafeteriaShiftSalesHistoryResponse>> GetShiftHistoryAsync(DateOnly date, CancellationToken cancellationToken) =>
        GetShiftHistoryForPeriodAsync(date, date.AddDays(1), cancellationToken);

    private async Task<CafeteriaSalesSummaryResponse> GetSummaryAfterAsync(DateTime? closedAt, CancellationToken cancellationToken) =>
        await GetSummaryAsync(sale => !closedAt.HasValue || sale.CreatedAt > closedAt.Value, cancellationToken);

    private async Task<CafeteriaSalesSummaryResponse> GetSummaryAsync(
        System.Linq.Expressions.Expression<Func<CafeteriaSale, bool>> predicate,
        CancellationToken cancellationToken)
    {
        var sales = await db.CafeteriaSales.AsNoTracking()
            .Where(predicate)
            .Include(sale => sale.Items).ToListAsync(cancellationToken);
        var items = sales.SelectMany(sale => sale.Items).GroupBy(item => new { item.ProductName, item.UnitPrice })
            .OrderBy(group => group.Key.ProductName).Select(group => new CafeteriaSalesSummaryItemResponse(group.Key.ProductName, group.Count(), group.Key.UnitPrice, group.Sum(item => item.UnitPrice))).ToList();
        return new CafeteriaSalesSummaryResponse(sales.Count, items.Sum(item => item.TotalSales), items);
    }

    private async Task<CafeteriaPeriodSummaryResponse> GetPeriodSummaryAsync(DateOnly from, DateOnly until, CancellationToken cancellationToken)
    {
        var sales = db.CafeteriaSales.AsNoTracking().Where(sale => sale.BusinessDate >= from && sale.BusinessDate < until);
        var saleCount = await sales.CountAsync(cancellationToken);
        var totalSales = await sales.SelectMany(sale => sale.Items).SumAsync(item => (decimal?)item.UnitPrice, cancellationToken) ?? 0;
        return new CafeteriaPeriodSummaryResponse(saleCount, totalSales);
    }

    private async Task<IReadOnlyList<CafeteriaShiftSalesHistoryResponse>> GetRecentShiftHistoryAsync(DateOnly date, CancellationToken cancellationToken) =>
        await GetShiftHistoryForPeriodAsync(date.AddDays(-29), date.AddDays(1), cancellationToken);

    private async Task<IReadOnlyList<CafeteriaShiftSalesHistoryResponse>> GetShiftHistoryForPeriodAsync(DateOnly from, DateOnly until, CancellationToken cancellationToken)
    {
        var sales = await db.CafeteriaSales.AsNoTracking()
            .Where(sale => sale.BusinessDate >= from && sale.BusinessDate < until)
            .Include(sale => sale.Items)
            .ToListAsync(cancellationToken);

        return sales.GroupBy(sale => new { sale.BusinessDate, sale.Shift })
            .OrderByDescending(group => group.Key.BusinessDate)
            .ThenByDescending(group => group.Key.Shift)
            .Select(group => new CafeteriaShiftSalesHistoryResponse(
                group.Key.BusinessDate,
                group.Key.Shift,
                group.Count(),
                group.Sum(sale => sale.Items.Sum(item => item.UnitPrice))))
            .ToList();
    }

    private async Task<IReadOnlyList<CafeteriaProductResponse>> GetProductsAsync(CancellationToken cancellationToken) =>
        await db.CafeteriaProducts.AsNoTracking().Where(product => product.IsActive).OrderBy(product => product.CreatedAt).Select(product => new CafeteriaProductResponse(product.Id, product.Name, product.Price)).ToListAsync(cancellationToken);

    private Task<CigaretteShiftClose?> GetLastCloseAsync(CancellationToken cancellationToken) =>
        db.CigaretteShiftCloses.AsNoTracking().OrderByDescending(close => close.ClosedAt).FirstOrDefaultAsync(cancellationToken);

    private static (string Name, decimal Price) ValidateProduct(string name, decimal price)
    {
        name = name.Trim();
        if (string.IsNullOrWhiteSpace(name) || name.Length > 100) throw new CafeteriaValidationException("El nombre es obligatorio y admite hasta 100 caracteres.");
        if (price <= 0) throw new CafeteriaValidationException("El precio de venta debe ser mayor que cero.");
        return (name, price);
    }

    private static CafeteriaProductResponse ToResponse(CafeteriaProduct product) => new(product.Id, product.Name, product.Price);

}

public sealed class CafeteriaValidationException(string message) : InvalidOperationException(message);