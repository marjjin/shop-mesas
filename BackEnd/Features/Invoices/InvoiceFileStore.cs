using Microsoft.EntityFrameworkCore;

namespace GestionMesas.Api;

// Metadata queries never load the PDF bytes; document persistence has its own adapter.
public interface IInvoiceFileStore
{
    Task<StagedInvoiceFile> StageAsync(byte[] content, CancellationToken cancellationToken);
    Task<byte[]?> ReadAsync(int invoiceId, CancellationToken cancellationToken);
    Task QueueDeletionAsync(int invoiceId, CancellationToken cancellationToken);
}

public sealed record StagedInvoiceFile(InvoiceDocument Document, InvoiceFileCleanup? Cleanup = null);

public sealed class DatabaseInvoiceFileStore(RestaurantContext db) : IInvoiceFileStore
{
    // Used by isolated tests. Production uploads always use CloudinaryInvoiceFileStore.
    public Task<StagedInvoiceFile> StageAsync(byte[] content, CancellationToken cancellationToken) =>
        Task.FromResult(new StagedInvoiceFile(new() { Content = content }));
    public Task QueueDeletionAsync(int invoiceId, CancellationToken cancellationToken) => Task.CompletedTask;
    public Task<byte[]?> ReadAsync(int invoiceId, CancellationToken cancellationToken) => db.InvoiceDocuments.AsNoTracking()
        .Where(x => x.InvoiceId == invoiceId).Select(x => x.Content).SingleOrDefaultAsync(cancellationToken);
}
