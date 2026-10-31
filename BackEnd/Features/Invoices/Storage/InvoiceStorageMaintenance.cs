// Mantenimiento en segundo plano: borra archivos huérfanos y migra PDFs antiguos.
using Microsoft.EntityFrameworkCore;

namespace GestionMesas.Api;

public sealed class InvoiceStorageMaintenance(RestaurantContext db, CloudinaryInvoiceClient cloudinary,
    CloudinaryInvoiceFileStore store, CloudinaryInvoiceOptions options, TimeProvider clock, ILogger<InvoiceStorageMaintenance> log)
{
    // Procesa hasta 10 tareas por ciclo, y después migra un documento.
    public async Task RunAsync(CancellationToken ct)
    {
        if (!options.IsConfigured) return;
        var now = clock.GetUtcNow().UtcDateTime;
        var pending = await db.InvoiceFileCleanups.Where(x => x.NotBefore <= now).OrderBy(x => x.NotBefore).Take(10).ToListAsync(ct);
        foreach (var job in pending)
        {
            try
            {
                // Nunca borra un archivo que una factura siga usando.
                var referenced = await db.InvoiceDocuments.AnyAsync(x => x.CloudinaryCloudName == job.CloudName && x.CloudinaryPublicId == job.PublicId, ct);
                if (!referenced) await cloudinary.DeleteAsync(job.CloudName, job.PublicId, ct);
                db.InvoiceFileCleanups.Remove(job);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                job.Attempts++;
                // Espera creciente entre reintentos, con un máximo de una hora.
                job.NotBefore = now.AddSeconds(Math.Min(3600, 30 * Math.Pow(2, Math.Min(job.Attempts, 7))));
                // Provider bodies and signed requests never enter application logs.
                log.LogWarning("No se pudo completar la limpieza de documento {JobId}; se reintentará.", job.Id);
            }
            await db.SaveChangesAsync(ct);
        }
        await MigrateOneAsync(ct);
    }

    // Mueve a Cloudinary un PDF antiguo guardado en la base.
    private async Task MigrateOneAsync(CancellationToken ct)
    {
        var legacy = await db.InvoiceDocuments.AsNoTracking()
            .Where(x => x.CloudinaryPublicId == "" && x.Content.Length >= 20).OrderBy(x => x.InvoiceId).FirstOrDefaultAsync(ct);
        if (legacy is null) return;
        var staged = await store.StageAsync(legacy.Content, ct);
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        // Compare-and-swap: only one worker can replace the original document.
        // A losing worker retains its cleanup job for its unused uploaded asset.
        var updated = await db.InvoiceDocuments.Where(x => x.InvoiceId == legacy.InvoiceId && x.CloudinaryPublicId == "")
            .ExecuteUpdateAsync(setters => setters
                .SetProperty(x => x.CloudinaryPublicId, staged.Document.CloudinaryPublicId)
                .SetProperty(x => x.CloudinaryAssetId, staged.Document.CloudinaryAssetId)
                .SetProperty(x => x.CloudinaryCloudName, staged.Document.CloudinaryCloudName)
                .SetProperty(x => x.Content, Array.Empty<byte>()), ct);
        if (updated == 0) return;
        var tracked = db.InvoiceDocuments.Local.FirstOrDefault(x => x.InvoiceId == legacy.InvoiceId);
        if (tracked is not null) db.Entry(tracked).State = EntityState.Detached;
        db.InvoiceFileCleanups.Remove(staged.Cleanup!);
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
    }
}

// Worker que ejecuta el mantenimiento cada 30 segundos.
public sealed class InvoiceStorageWorker(IServiceScopeFactory scopes, ILogger<InvoiceStorageWorker> log) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(30));
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await using var scope = scopes.CreateAsyncScope();
                await scope.ServiceProvider.GetRequiredService<InvoiceStorageMaintenance>().RunAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
            catch (Exception) { log.LogWarning("El mantenimiento de archivos de facturas se reintentará en el próximo ciclo."); }
            try { if (!await timer.WaitForNextTickAsync(stoppingToken)) break; }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
        }
    }
}
