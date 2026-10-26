namespace GestionMesas.Api;

public interface ISupplierService
{
    Task<IReadOnlyList<SupplierResponse>> GetAllAsync(CancellationToken cancellationToken);
    Task<SupplierResponse> CreateAsync(CreateSupplierRequest request, CancellationToken cancellationToken);
    Task<SupplierResponse?> UpdateAsync(int id, UpdateSupplierRequest request, CancellationToken cancellationToken);
    Task<bool> DeactivateAsync(int id, CancellationToken cancellationToken);
    Task<SupplierResponse?> UpdateBalancesAsync(int id, UpdateSupplierBalancesRequest request, CancellationToken cancellationToken);
    Task TransferReservedFundsAsync(CreateSupplierReservedFundsTransferRequest request, CancellationToken cancellationToken);
    Task<SupplierResponse> ExchangeReservedFundsAsync(int id, CreateSupplierReservedFundsExchangeRequest request, CancellationToken cancellationToken);
    Task<SupplierResponse> RecordPurchaseAsync(int id, CreateSupplierPurchaseRequest request, CancellationToken cancellationToken);
    Task<SupplierResponse> RecordPaymentAsync(int id, CreateSupplierPaymentRequest request, CancellationToken cancellationToken);
    Task<SupplierResponse?> UpdateTransactionAsync(int supplierId, int transactionId, UpdateSupplierTransactionRequest request, CancellationToken cancellationToken);
    Task<SupplierResponse?> DeleteTransactionAsync(int supplierId, int transactionId, CancellationToken cancellationToken);
}

public sealed class SupplierValidationException(string message) : InvalidOperationException(message);
