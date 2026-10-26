namespace GestionMesas.Api;

public interface ICigaretteService
{
    Task<CigaretteDashboardResponse> GetDashboardAsync(DateOnly date, CancellationToken cancellationToken);
    Task<IReadOnlyList<CigaretteShiftCloseResponse>> GetClosesAsync(DateOnly from, DateOnly to, CancellationToken cancellationToken);
    Task<CigaretteProductResponse> CreateProductAsync(CreateCigaretteProductRequest request, CancellationToken cancellationToken);
    Task<CigaretteProductResponse?> UpdateProductAsync(int id, UpdateCigaretteProductRequest request, CancellationToken cancellationToken);
    Task<bool> DeleteProductAsync(int id, CancellationToken cancellationToken);
    Task<CigarettePurchaseResponse> CreatePurchaseAsync(CreateCigarettePurchaseRequest request, CancellationToken cancellationToken);
    Task<CigarettePurchaseResponse?> UpdatePurchaseAsync(int id, UpdateCigarettePurchaseRequest request, CancellationToken cancellationToken);
    Task<bool> DeletePurchaseAsync(int id, CancellationToken cancellationToken);
    Task<CigaretteShiftCloseResponse> CloseShiftAsync(CreateCigaretteShiftCloseRequest request, CancellationToken cancellationToken);
    Task<CigaretteShiftCloseResponse?> UpdateCloseAsync(int id, UpdateCigaretteShiftCloseRequest request, CancellationToken cancellationToken);
    Task<bool> DeleteCloseAsync(int id, CancellationToken cancellationToken);
    Task<CigaretteShiftCloseResponse?> ConsolidateCloseAsync(int id, int? targetId, CancellationToken cancellationToken, DateOnly? targetDate = null, string? targetShift = null);
}

public sealed class CigaretteValidationException(string message) : InvalidOperationException(message);
public sealed class CigaretteNotFoundException(string message) : KeyNotFoundException(message);
