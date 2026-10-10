using Microsoft.EntityFrameworkCore;

namespace GestionMesas.Api;

public interface ISupplierService
{
    Task<IReadOnlyList<SupplierResponse>> GetAllAsync(CancellationToken cancellationToken);
    Task<SupplierResponse> CreateAsync(CreateSupplierRequest request, CancellationToken cancellationToken);
    Task<SupplierResponse?> UpdateAsync(int id, UpdateSupplierRequest request, CancellationToken cancellationToken);
    Task<bool> DeactivateAsync(int id, CancellationToken cancellationToken);
    Task<SupplierResponse> RecordPaymentAsync(int id, CreateSupplierPaymentRequest request, CancellationToken cancellationToken);
}

public sealed class SupplierValidationException(string message) : InvalidOperationException(message);

public sealed class SupplierService(RestaurantContext db) : ISupplierService
{
    public async Task<IReadOnlyList<SupplierResponse>> GetAllAsync(CancellationToken cancellationToken)
    {
        var suppliers = await db.Suppliers.AsNoTracking().OrderBy(supplier => supplier.Name).ToListAsync(cancellationToken);
        var transactions = await db.SupplierTransactions.AsNoTracking().OrderByDescending(transaction => transaction.CreatedAt).ToListAsync(cancellationToken);
        var closes = await db.CigaretteShiftCloses.AsNoTracking().ToDictionaryAsync(close => close.Id, cancellationToken);
        return suppliers.Select(supplier => ToResponse(supplier, transactions.Where(transaction => transaction.SupplierId == supplier.Id), closes)).ToList();
    }

    public async Task<SupplierResponse> CreateAsync(CreateSupplierRequest request, CancellationToken cancellationToken)
    {
        var name = ValidateName(request.Name);
        if (await db.Suppliers.AnyAsync(supplier => supplier.Name.ToLower() == name.ToLower(), cancellationToken))
            throw new SupplierValidationException("Ya existe un proveedor con ese nombre.");

        var supplier = new Supplier { Name = name, CreatedAt = DateTime.UtcNow };
        db.Suppliers.Add(supplier);
        await db.SaveChangesAsync(cancellationToken);
        return ToResponse(supplier, [], new Dictionary<int, CigaretteShiftClose>());
    }

    public async Task<SupplierResponse?> UpdateAsync(int id, UpdateSupplierRequest request, CancellationToken cancellationToken)
    {
        var supplier = await db.Suppliers.FirstOrDefaultAsync(item => item.Id == id && item.IsActive, cancellationToken);
        if (supplier is null) return null;
        var name = ValidateName(request.Name);
        if (await db.Suppliers.AnyAsync(item => item.Id != id && item.Name.ToLower() == name.ToLower(), cancellationToken))
            throw new SupplierValidationException("Ya existe un proveedor con ese nombre.");
        supplier.Name = name;
        await db.SaveChangesAsync(cancellationToken);
        var transactions = await db.SupplierTransactions.Where(item => item.SupplierId == id).ToListAsync(cancellationToken);
        var closes = await db.CigaretteShiftCloses.ToDictionaryAsync(close => close.Id, cancellationToken);
        return ToResponse(supplier, transactions, closes);
    }

    public async Task<bool> DeactivateAsync(int id, CancellationToken cancellationToken)
    {
        var supplier = await db.Suppliers.FirstOrDefaultAsync(item => item.Id == id && item.IsActive, cancellationToken);
        if (supplier is null) return false;
        supplier.IsActive = false;
        await db.SaveChangesAsync(cancellationToken);
        return true;
    }

    public async Task<SupplierResponse> RecordPaymentAsync(int id, CreateSupplierPaymentRequest request, CancellationToken cancellationToken)
    {
        var supplier = await db.Suppliers.FirstOrDefaultAsync(item => item.Id == id && item.IsActive, cancellationToken)
            ?? throw new KeyNotFoundException();
        if (request.Amount <= 0) throw new SupplierValidationException("El pago debe ser mayor que cero.");
        if (request.Amount > supplier.Balance) throw new SupplierValidationException("El pago no puede ser mayor al saldo disponible del proveedor.");

        supplier.Balance -= request.Amount;
        db.SupplierTransactions.Add(new SupplierTransaction
        {
            SupplierId = supplier.Id, Type = "payment", Amount = request.Amount,
            BusinessDate = DateOnly.FromDateTime(DateTime.UtcNow), Note = NormalizeNote(request.Note), CreatedAt = DateTime.UtcNow
        });
        await db.SaveChangesAsync(cancellationToken);
        var transactions = await db.SupplierTransactions.Where(item => item.SupplierId == id).OrderByDescending(item => item.CreatedAt).ToListAsync(cancellationToken);
        var closes = await db.CigaretteShiftCloses.ToDictionaryAsync(close => close.Id, cancellationToken);
        return ToResponse(supplier, transactions, closes);
    }

    private static SupplierResponse ToResponse(Supplier supplier, IEnumerable<SupplierTransaction> transactions, IReadOnlyDictionary<int, CigaretteShiftClose> closes)
    {
        var ordered = transactions.OrderByDescending(transaction => transaction.CreatedAt).ToList();
        var runningBalance = supplier.Balance;
        var result = ordered.Select(transaction =>
        {
            var balanceAfter = runningBalance;
            runningBalance += transaction.Type == "payment" ? transaction.Amount : -transaction.Amount;
            return new SupplierTransactionResponse(transaction.Id, transaction.Type, transaction.Amount, balanceAfter, transaction.BusinessDate,
                transaction.CigaretteShiftCloseId is int closeId && closes.TryGetValue(closeId, out var close) ? close.Shift : null,
                transaction.Note, new DateTimeOffset(DateTime.SpecifyKind(transaction.CreatedAt, DateTimeKind.Utc)));
        }).ToList();
        return new SupplierResponse(supplier.Id, supplier.Name, supplier.Balance, supplier.IsActive, result);
    }

    private static string ValidateName(string name)
    {
        name = name.Trim();
        if (string.IsNullOrWhiteSpace(name) || name.Length > 100)
            throw new SupplierValidationException("El nombre es obligatorio y admite hasta 100 caracteres.");
        return name;
    }

    private static string? NormalizeNote(string? note) => string.IsNullOrWhiteSpace(note) ? null : note.Trim()[..Math.Min(note.Trim().Length, 250)];
}
