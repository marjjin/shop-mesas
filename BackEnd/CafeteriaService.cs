using Microsoft.EntityFrameworkCore;

namespace GestionMesas.Api;

public interface ICafeteriaService
{
    Task<CafeteriaDashboardResponse> GetDashboardAsync(DateOnly date, CancellationToken cancellationToken);
    Task<CafeteriaDashboardResponse> RegisterSaleAsync(DateOnly date, CancellationToken cancellationToken);
    Task<CafeteriaProductResponse> CreateProductAsync(CreateCafeteriaProductRequest request, CancellationToken cancellationToken);
    Task<CafeteriaProductResponse?> UpdateProductAsync(int id, UpdateCafeteriaProductRequest request, CancellationToken cancellationToken);
    Task<bool> DeleteProductAsync(int id, CancellationToken cancellationToken);
    Task<CafeteriaSalesSummaryResponse> GetSummaryAsync(DateOnly date, DateTime? from, DateTime? until, CancellationToken cancellationToken);
}

public sealed class CafeteriaService(RestaurantContext db) : ICafeteriaService
{
    public async Task<CafeteriaDashboardResponse> GetDashboardAsync(DateOnly date, CancellationToken cancellationToken)
    {
        var products = await GetProductsAsync(cancellationToken);
        var lastCloseAt = await GetLastCloseAtAsync(date, cancellationToken);
        return new CafeteriaDashboardResponse(date, products, await GetSummaryAsync(date, lastCloseAt, null, cancellationToken));
    }

    public async Task<CafeteriaDashboardResponse> RegisterSaleAsync(DateOnly date, CancellationToken cancellationToken)
    {
        var products = await db.CafeteriaProducts.Where(product => product.IsActive).OrderBy(product => product.CreatedAt).ToListAsync(cancellationToken);
        if (products.Count == 0) throw new CafeteriaValidationException("Primero cargá al menos un artículo en Caja Cafetería.");

        var now = DateTime.UtcNow;
        var sale = new CafeteriaSale
        {
            CreatedAt = date == DateOnly.FromDateTime(now)
                ? now
                : date.ToDateTime(TimeOnly.FromDateTime(now), DateTimeKind.Utc)
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

    public async Task<CafeteriaSalesSummaryResponse> GetSummaryAsync(DateOnly date, DateTime? from, DateTime? until, CancellationToken cancellationToken)
    {
        var dayStart = date.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
        var start = dayStart;
        var fromUtc = from.HasValue ? AsUtc(from.Value) : (DateTime?)null;
        if (fromUtc.HasValue && fromUtc.Value > start) start = fromUtc.Value;
        var end = until.HasValue ? AsUtc(until.Value) : dayStart.AddDays(1);
        var sales = await db.CafeteriaSales.AsNoTracking().Where(sale => sale.CreatedAt >= start && sale.CreatedAt < end)
            .Include(sale => sale.Items).ToListAsync(cancellationToken);
        var items = sales.SelectMany(sale => sale.Items).GroupBy(item => new { item.ProductName, item.UnitPrice })
            .OrderBy(group => group.Key.ProductName).Select(group => new CafeteriaSalesSummaryItemResponse(group.Key.ProductName, group.Count(), group.Key.UnitPrice, group.Sum(item => item.UnitPrice))).ToList();
        return new CafeteriaSalesSummaryResponse(sales.Count, items.Sum(item => item.TotalSales), items);
    }

    private async Task<IReadOnlyList<CafeteriaProductResponse>> GetProductsAsync(CancellationToken cancellationToken) =>
        await db.CafeteriaProducts.AsNoTracking().Where(product => product.IsActive).OrderBy(product => product.CreatedAt).Select(product => new CafeteriaProductResponse(product.Id, product.Name, product.Price)).ToListAsync(cancellationToken);

    private async Task<DateTime?> GetLastCloseAtAsync(DateOnly date, CancellationToken cancellationToken) =>
        await db.CigaretteShiftCloses.AsNoTracking().Where(close => close.BusinessDate == date)
            .OrderByDescending(close => close.ClosedAt).Select(close => (DateTime?)close.ClosedAt).FirstOrDefaultAsync(cancellationToken);

    private static (string Name, decimal Price) ValidateProduct(string name, decimal price)
    {
        name = name.Trim();
        if (string.IsNullOrWhiteSpace(name) || name.Length > 100) throw new CafeteriaValidationException("El nombre es obligatorio y admite hasta 100 caracteres.");
        if (price <= 0) throw new CafeteriaValidationException("El precio de venta debe ser mayor que cero.");
        return (name, price);
    }

    private static CafeteriaProductResponse ToResponse(CafeteriaProduct product) => new(product.Id, product.Name, product.Price);

    private static DateTime AsUtc(DateTime value) => value.Kind == DateTimeKind.Utc
        ? value
        : DateTime.SpecifyKind(value, DateTimeKind.Utc);
}

public sealed class CafeteriaValidationException(string message) : InvalidOperationException(message);