using Microsoft.EntityFrameworkCore;

namespace GestionMesas.Api;

public interface ICigaretteService
{
    Task<CigaretteDashboardResponse> GetDashboardAsync(DateOnly date, CancellationToken cancellationToken);
    Task<IReadOnlyList<CigaretteShiftCloseResponse>> GetClosesAsync(DateOnly from, DateOnly to, CancellationToken cancellationToken);
    Task<CigaretteProductResponse> CreateProductAsync(CreateCigaretteProductRequest request, CancellationToken cancellationToken);
    Task<CigaretteProductResponse?> UpdateProductAsync(int id, UpdateCigaretteProductRequest request, CancellationToken cancellationToken);
    Task<bool> DeleteProductAsync(int id, CancellationToken cancellationToken);
    Task<CigarettePurchaseResponse> CreatePurchaseAsync(CreateCigarettePurchaseRequest request, CancellationToken cancellationToken);
    Task<CigaretteShiftCloseResponse> CloseShiftAsync(CreateCigaretteShiftCloseRequest request, CancellationToken cancellationToken);
}

public sealed class CigaretteValidationException(string message) : InvalidOperationException(message);
public sealed class CigaretteNotFoundException(string message) : KeyNotFoundException(message);

public sealed class CigaretteService(RestaurantContext db) : ICigaretteService
{
    public async Task<CigaretteDashboardResponse> GetDashboardAsync(DateOnly date, CancellationToken cancellationToken)
    {
        var products = await db.CigaretteProducts.AsNoTracking().Where(product => product.IsActive)
            .OrderBy(product => product.Name).Select(product => ToResponse(product)).ToListAsync(cancellationToken);
        var purchases = await LoadPurchasesAsync(date, cancellationToken);
        var closes = await LoadClosesAsync(close => close.BusinessDate == date, cancellationToken);
        return new CigaretteDashboardResponse(date, products, purchases, closes);
    }

    public Task<IReadOnlyList<CigaretteShiftCloseResponse>> GetClosesAsync(DateOnly from, DateOnly to, CancellationToken cancellationToken)
    {
        if (from > to) throw new CigaretteValidationException("La fecha desde no puede ser posterior a la fecha hasta.");
        return LoadClosesAsync(close => close.BusinessDate >= from && close.BusinessDate <= to, cancellationToken);
    }

    public async Task<CigaretteProductResponse> CreateProductAsync(CreateCigaretteProductRequest request, CancellationToken cancellationToken)
    {
        var name = ValidateProduct(request.Name, request.Price);
        if (request.InitialStock < 0) throw new CigaretteValidationException("El stock inicial no puede ser negativo.");
        if (await db.CigaretteProducts.AnyAsync(product => product.Name.ToLower() == name.ToLower(), cancellationToken))
            throw new CigaretteValidationException("Ya existe un cigarrillo con ese nombre.");

        var product = new CigaretteProduct { Name = name, Price = request.Price, Stock = request.InitialStock, CreatedAt = DateTime.UtcNow };
        db.CigaretteProducts.Add(product);
        await db.SaveChangesAsync(cancellationToken);
        return ToResponse(product);
    }

    public async Task<CigaretteProductResponse?> UpdateProductAsync(int id, UpdateCigaretteProductRequest request, CancellationToken cancellationToken)
    {
        var product = await db.CigaretteProducts.FirstOrDefaultAsync(item => item.Id == id && item.IsActive, cancellationToken);
        if (product is null) return null;
        var name = ValidateProduct(request.Name, request.Price);
        if (await db.CigaretteProducts.AnyAsync(item => item.Id != id && item.Name.ToLower() == name.ToLower(), cancellationToken))
            throw new CigaretteValidationException("Ya existe un cigarrillo con ese nombre.");
        product.Name = name;
        product.Price = request.Price;
        await db.SaveChangesAsync(cancellationToken);
        return ToResponse(product);
    }

    public async Task<bool> DeleteProductAsync(int id, CancellationToken cancellationToken)
    {
        var product = await db.CigaretteProducts.FirstOrDefaultAsync(item => item.Id == id && item.IsActive, cancellationToken);
        if (product is null) return false;
        product.IsActive = false;
        await db.SaveChangesAsync(cancellationToken);
        return true;
    }

    public async Task<CigarettePurchaseResponse> CreatePurchaseAsync(CreateCigarettePurchaseRequest request, CancellationToken cancellationToken)
    {
        var shift = NormalizeShift(request.Shift);
        if (request.Quantity <= 0) throw new CigaretteValidationException("La cantidad comprada debe ser mayor que cero.");
        if (await db.CigaretteShiftCloses.AnyAsync(close => close.BusinessDate == request.BusinessDate && close.Shift == shift, cancellationToken))
            throw new CigaretteValidationException("No se pueden cargar compras en un turno que ya fue cerrado.");
        var product = await db.CigaretteProducts.FirstOrDefaultAsync(item => item.Id == request.CigaretteProductId && item.IsActive, cancellationToken)
            ?? throw new CigaretteNotFoundException("El cigarrillo indicado no existe.");

        var purchase = new CigarettePurchase { CigaretteProductId = product.Id, Quantity = request.Quantity, UnitCost = 0, BusinessDate = request.BusinessDate, Shift = shift, CreatedAt = DateTime.UtcNow };
        product.Stock += request.Quantity;
        db.CigarettePurchases.Add(purchase);
        await db.SaveChangesAsync(cancellationToken);
        return ToResponse(purchase, product.Name);
    }

    public async Task<CigaretteShiftCloseResponse> CloseShiftAsync(CreateCigaretteShiftCloseRequest request, CancellationToken cancellationToken)
    {
        var shift = NormalizeShift(request.Shift);
        if (request.Items.Count == 0) throw new CigaretteValidationException("El cierre debe incluir al menos un cigarrillo.");
        if (request.Items.Select(item => item.CigaretteProductId).Distinct().Count() != request.Items.Count)
            throw new CigaretteValidationException("No se puede repetir un cigarrillo en el cierre.");
        if (await db.CigaretteShiftCloses.AnyAsync(close => close.BusinessDate == request.BusinessDate && close.Shift == shift, cancellationToken))
            throw new CigaretteValidationException("Ese turno ya fue cerrado.");

        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        var ids = request.Items.Select(item => item.CigaretteProductId).ToList();
        var products = await db.CigaretteProducts.Where(product => product.IsActive && ids.Contains(product.Id)).ToDictionaryAsync(product => product.Id, cancellationToken);
        if (products.Count != ids.Count) throw new CigaretteNotFoundException("Uno de los cigarrillos del cierre no existe.");
        var purchases = await db.CigarettePurchases.Where(purchase => purchase.BusinessDate == request.BusinessDate && purchase.Shift == shift && ids.Contains(purchase.CigaretteProductId))
            .GroupBy(purchase => purchase.CigaretteProductId).Select(group => new { ProductId = group.Key, Quantity = group.Sum(item => item.Quantity) })
            .ToDictionaryAsync(item => item.ProductId, item => item.Quantity, cancellationToken);

        var close = new CigaretteShiftClose { BusinessDate = request.BusinessDate, Shift = shift, ClosedAt = DateTime.UtcNow };
        foreach (var input in request.Items)
        {
            var product = products[input.CigaretteProductId];
            var purchased = purchases.GetValueOrDefault(product.Id);
            var initial = product.Stock - purchased;
            if (initial < 0) throw new CigaretteValidationException($"El stock inicial calculado de {product.Name} es inválido.");
            if (input.FinalStock < 0 || input.FinalStock > product.Stock)
                throw new CigaretteValidationException($"El stock final de {product.Name} debe estar entre 0 y {product.Stock}.");
            var sold = initial + purchased - input.FinalStock;
            close.Items.Add(new CigaretteShiftCloseItem { CigaretteProductId = product.Id, ProductName = product.Name, UnitPrice = product.Price, InitialStock = initial, PurchasedQuantity = purchased, FinalStock = input.FinalStock, SoldQuantity = sold, SalesAmount = sold * product.Price });
            product.Stock = input.FinalStock;
        }

        db.CigaretteShiftCloses.Add(close);
        await db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return ToResponse(close);
    }

    private async Task<IReadOnlyList<CigarettePurchaseResponse>> LoadPurchasesAsync(DateOnly date, CancellationToken cancellationToken)
    {
        var query = from purchase in db.CigarettePurchases.AsNoTracking()
                    join product in db.CigaretteProducts.AsNoTracking() on purchase.CigaretteProductId equals product.Id
                    where purchase.BusinessDate == date
                    orderby purchase.CreatedAt descending
                    select new CigarettePurchaseResponse(purchase.Id, purchase.CigaretteProductId, product.Name, purchase.Quantity, purchase.BusinessDate, purchase.Shift, new DateTimeOffset(purchase.CreatedAt, TimeSpan.Zero));
        return await query.ToListAsync(cancellationToken);
    }

    private async Task<IReadOnlyList<CigaretteShiftCloseResponse>> LoadClosesAsync(System.Linq.Expressions.Expression<Func<CigaretteShiftClose, bool>> predicate, CancellationToken cancellationToken)
    {
        var closes = await db.CigaretteShiftCloses.AsNoTracking().Where(predicate).Include(close => close.Items)
            .OrderByDescending(close => close.BusinessDate).ThenByDescending(close => close.Shift).ToListAsync(cancellationToken);
        return closes.Select(ToResponse).ToList();
    }

    private static string ValidateProduct(string name, decimal price)
    {
        name = name.Trim();
        if (string.IsNullOrWhiteSpace(name) || name.Length > 100) throw new CigaretteValidationException("El nombre es obligatorio y admite hasta 100 caracteres.");
        if (price <= 0) throw new CigaretteValidationException("El precio de venta debe ser mayor que cero.");
        return name;
    }

    private static string NormalizeShift(string shift) => shift.Trim().ToLowerInvariant() switch
    {
        "morning" => "morning",
        "afternoon" => "afternoon",
        _ => throw new CigaretteValidationException("El turno debe ser morning o afternoon.")
    };

    private static CigaretteProductResponse ToResponse(CigaretteProduct product) => new(product.Id, product.Name, product.Price, product.Stock);
    private static CigarettePurchaseResponse ToResponse(CigarettePurchase purchase, string productName) => new(purchase.Id, purchase.CigaretteProductId, productName, purchase.Quantity, purchase.BusinessDate, purchase.Shift, new DateTimeOffset(purchase.CreatedAt, TimeSpan.Zero));
    private static CigaretteShiftCloseResponse ToResponse(CigaretteShiftClose close)
    {
        var items = close.Items.Select(item => new CigaretteShiftCloseItemResponse(item.CigaretteProductId, item.ProductName, item.UnitPrice, item.InitialStock, item.PurchasedQuantity, item.FinalStock, item.SoldQuantity, item.SalesAmount)).ToList();
        return new CigaretteShiftCloseResponse(close.Id, close.BusinessDate, close.Shift, new DateTimeOffset(close.ClosedAt, TimeSpan.Zero), items.Sum(item => item.SoldQuantity), items.Sum(item => item.SalesAmount), items);
    }
}