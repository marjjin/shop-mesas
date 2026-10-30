using Microsoft.EntityFrameworkCore;

namespace GestionMesas.Api;

public sealed class CloudinaryInvoiceFileStore(RestaurantContext db, CloudinaryInvoiceClient cloudinary,
    CloudinaryInvoiceOptions options, TimeProvider clock) : IInvoiceFileStore
{
    public async Task<StagedInvoiceFile> StageAsync(byte[] content, CancellationToken ct)
    {
        options.RequireConfigured();
        var publicId = $"{options.Folder}/{Guid.NewGuid():N}.pdf";
        // Persist recovery information before contacting the external service. An interrupted
        // upload is collectible even if its response never reaches this process.
        var cleanup = new InvoiceFileCleanup { CloudName = options.CloudName, PublicId = publicId,
            NotBefore = clock.GetUtcNow().UtcDateTime.AddHours(24) };
        db.InvoiceFileCleanups.Add(cleanup);
        await db.SaveChangesAsync(ct);
        var asset = await cloudinary.UploadAsync(publicId, content, ct);
        return new(new InvoiceDocument { CloudinaryCloudName = options.CloudName,
            CloudinaryPublicId = asset.PublicId, CloudinaryAssetId = asset.AssetId }, cleanup);
    }

    public async Task<byte[]?> ReadAsync(int invoiceId, CancellationToken ct)
    {
        var document = await db.InvoiceDocuments.AsNoTracking().SingleOrDefaultAsync(x => x.InvoiceId == invoiceId, ct);
        if (document is null) return null;
        // Keep existing files available while their background migration runs.
        if (string.IsNullOrEmpty(document.CloudinaryPublicId)) return document.Content.Length > 0 ? document.Content : null;
        return await cloudinary.ReadAsync(document.CloudinaryCloudName, document.CloudinaryAssetId, ct);
    }

    public async Task QueueDeletionAsync(int invoiceId, CancellationToken ct)
    {
        var document = await db.InvoiceDocuments.AsNoTracking().SingleOrDefaultAsync(x => x.InvoiceId == invoiceId, ct);
        if (document is null || string.IsNullOrEmpty(document.CloudinaryPublicId)) return;
        db.InvoiceFileCleanups.Add(new() { CloudName = document.CloudinaryCloudName,
            PublicId = document.CloudinaryPublicId, NotBefore = clock.GetUtcNow().UtcDateTime });
        // InvoiceService saves this row atomically with the removal of the invoice.
    }
}
