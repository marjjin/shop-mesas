using Microsoft.EntityFrameworkCore;

namespace GestionMesas.Api;

public interface ICashDropService
{
    Task<OpenCashDropsResponse> GetOpenAsync(DateOnly businessDate, CancellationToken cancellationToken);
    Task<IReadOnlyList<CashDropResponse>> GetAsync(DateOnly businessDate, string shift, CancellationToken cancellationToken);
    Task<CashDropResponse> CreateAsync(CreateCashDropRequest request, CancellationToken cancellationToken);
    Task<CashDropResponse?> UpdateAsync(int id, UpdateCashDropRequest request, CancellationToken cancellationToken);
    Task<bool> DeleteAsync(int id, CancellationToken cancellationToken);
}

public sealed class CashDropService(RestaurantContext db) : ICashDropService
{
    public async Task<OpenCashDropsResponse> GetOpenAsync(DateOnly businessDate, CancellationToken cancellationToken)
    {
        var closedShifts = await db.CigaretteShiftCloses.AsNoTracking()
            .Where(close => close.BusinessDate == businessDate)
            .Select(close => close.Shift)
            .ToListAsync(cancellationToken);
        var shift = !closedShifts.Contains("morning")
            ? "morning"
            : !closedShifts.Contains("afternoon")
                ? "afternoon"
                : null;
        var drops = shift is null
            ? []
            : await db.CashDrops.AsNoTracking()
                .Where(drop => drop.BusinessDate == businessDate && drop.Shift == shift)
                .OrderByDescending(drop => drop.CreatedAt)
                .Select(drop => ToResponse(drop))
                .ToListAsync(cancellationToken);
        return new OpenCashDropsResponse(businessDate, shift, drops);
    }

    public async Task<IReadOnlyList<CashDropResponse>> GetAsync(DateOnly businessDate, string shift, CancellationToken cancellationToken)
    {
        var normalizedShift = NormalizeShift(shift);
        return await db.CashDrops.AsNoTracking()
            .Where(drop => drop.BusinessDate == businessDate && drop.Shift == normalizedShift)
            .OrderByDescending(drop => drop.CreatedAt)
            .Select(drop => ToResponse(drop))
            .ToListAsync(cancellationToken);
    }

    public async Task<CashDropResponse> CreateAsync(CreateCashDropRequest request, CancellationToken cancellationToken)
    {
        ValidateAmount(request.Amount);
        var shift = NormalizeShift(request.Shift);
        await EnsureOpenAsync(request.BusinessDate, shift, cancellationToken);
        var drop = new CashDrop
        {
            Amount = request.Amount,
            BusinessDate = request.BusinessDate,
            Shift = shift,
            CreatedAt = DateTime.UtcNow
        };
        db.CashDrops.Add(drop);
        await db.SaveChangesAsync(cancellationToken);
        return ToResponse(drop);
    }

    public async Task<CashDropResponse?> UpdateAsync(int id, UpdateCashDropRequest request, CancellationToken cancellationToken)
    {
        ValidateAmount(request.Amount);
        var drop = await db.CashDrops.FirstOrDefaultAsync(item => item.Id == id, cancellationToken);
        if (drop is null) return null;
        drop.Amount = request.Amount;
        await db.SaveChangesAsync(cancellationToken);
        return ToResponse(drop);
    }

    public async Task<bool> DeleteAsync(int id, CancellationToken cancellationToken)
    {
        var drop = await db.CashDrops.FirstOrDefaultAsync(item => item.Id == id, cancellationToken);
        if (drop is null) return false;
        db.CashDrops.Remove(drop);
        await db.SaveChangesAsync(cancellationToken);
        return true;
    }

    private async Task EnsureOpenAsync(DateOnly businessDate, string shift, CancellationToken cancellationToken)
    {
        if (await db.CigaretteShiftCloses.AnyAsync(close => close.BusinessDate == businessDate && close.Shift == shift, cancellationToken))
            throw new CigaretteValidationException("No se pueden registrar tiradas en un turno que ya fue cerrado.");
    }

    private static void ValidateAmount(decimal amount)
    {
        if (amount <= 0) throw new CigaretteValidationException("El importe de la tirada debe ser mayor que cero.");
    }

    internal static string NormalizeShift(string shift) => shift.Trim().ToLowerInvariant() switch
    {
        "morning" => "morning",
        "afternoon" => "afternoon",
        _ => throw new CigaretteValidationException("El turno debe ser morning o afternoon.")
    };

    internal static CashDropResponse ToResponse(CashDrop drop) => new(
        drop.Id,
        drop.Amount,
        drop.BusinessDate,
        drop.Shift,
        new DateTimeOffset(DateTime.SpecifyKind(drop.CreatedAt, DateTimeKind.Utc)),
        drop.CigaretteShiftCloseId.HasValue);
}
