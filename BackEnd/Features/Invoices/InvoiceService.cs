using System.Text;
using Microsoft.EntityFrameworkCore;

namespace GestionMesas.Api;

public sealed class InvoiceService(RestaurantContext db, IInvoiceFileStore files)
{
    public const int MaxFileBytes = 8 * 1024 * 1024;
    public const int MaxPages = 10;

    private static IQueryable<InvoiceResponse> Responses(IQueryable<InvoiceRecord> query) => query.Select(invoice =>
        new InvoiceResponse(invoice.Id, invoice.SupplierId, invoice.Supplier.Name, invoice.Reference, invoice.Note,
            invoice.IssueDate, invoice.CreatedAt, invoice.PageCount, invoice.SizeBytes, invoice.OriginalBytes));

    public async Task<InvoiceListResponse> ListAsync(string? search, int? supplierId, int page, int pageSize, CancellationToken ct)
    {
        if (page is < 1 or > 1000000 || pageSize is < 1 or > 50 || search?.Length > 100 || supplierId is <= 0)
            throw new InvoiceValidationException("Revisá los filtros y la página del archivo de facturas.");
        var query = db.Invoices.AsNoTracking();
        if (supplierId.HasValue) query = query.Where(x => x.SupplierId == supplierId.Value);
        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLowerInvariant();
            query = query.Where(x => x.Reference.ToLower().Contains(term) || x.Supplier.Name.ToLower().Contains(term) || x.Note.ToLower().Contains(term));
        }
        var count = await query.CountAsync(ct);
        page = Math.Min(page, Math.Max(1, (count + pageSize - 1) / pageSize));
        var items = await Responses(query.OrderByDescending(x => x.CreatedAt).ThenByDescending(x => x.Id).Skip((page - 1) * pageSize).Take(pageSize)).ToListAsync(ct);
        var summary = new InvoiceArchiveSummary(await db.Invoices.CountAsync(ct),
            await db.Invoices.Select(x => x.SupplierId).Distinct().CountAsync(ct),
            await db.Invoices.SumAsync(x => (long)x.SizeBytes, ct));
        return new(items, count, page, pageSize, summary);
    }

    public Task<List<InvoiceSupplierResponse>> SuppliersAsync(CancellationToken ct) => db.Suppliers.AsNoTracking()
        .Where(s => s.IsActive || db.Invoices.Any(i => i.SupplierId == s.Id)).OrderBy(s => s.Name)
        .Select(s => new InvoiceSupplierResponse(s.Id, s.Name, s.IsActive)).ToListAsync(ct);

    public async Task<InvoiceResponse> CreateAsync(InvoiceMetadataRequest input, byte[] content, int pageCount, long originalBytes, CancellationToken ct)
    {
        ValidateMetadata(input);
        if (pageCount is < 1 or > MaxPages || originalBytes is < 0 or > 209715200)
            throw new InvoiceValidationException("La factura admite entre 1 y 10 páginas.");
        if (content.Length is < 20 or > MaxFileBytes || !content.AsSpan(0, 5).SequenceEqual("%PDF-"u8)
            || !Encoding.ASCII.GetString(content, Math.Max(0, content.Length - 1024), Math.Min(1024, content.Length)).Contains("%%EOF", StringComparison.Ordinal))
            throw new InvoiceValidationException("El archivo debe ser un PDF válido de hasta 8 MB.");
        await RequireSupplierAsync(input.SupplierId, null, ct);
        var staged = await files.StageAsync(content, ct);
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        var invoice = new InvoiceRecord { SupplierId = input.SupplierId, IssueDate = input.IssueDate,
            Reference = input.Reference?.Trim() ?? "", Note = input.Note?.Trim() ?? "", CreatedAt = DateTime.UtcNow,
            PageCount = pageCount, SizeBytes = content.Length, OriginalBytes = originalBytes };
        db.Invoices.Add(invoice);
        await db.SaveChangesAsync(ct);
        staged.Document.InvoiceId = invoice.Id;
        db.InvoiceDocuments.Add(staged.Document);
        if (staged.Cleanup is not null) db.InvoiceFileCleanups.Remove(staged.Cleanup);
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        return await Responses(db.Invoices.AsNoTracking().Where(x => x.Id == invoice.Id)).SingleAsync(ct);
    }

    public async Task<InvoiceResponse?> UpdateAsync(int id, InvoiceMetadataRequest input, CancellationToken ct)
    {
        ValidateMetadata(input);
        var invoice = await db.Invoices.FindAsync([id], ct);
        if (invoice is null) return null;
        await RequireSupplierAsync(input.SupplierId, invoice.SupplierId, ct);
        invoice.SupplierId = input.SupplierId;
        invoice.IssueDate = input.IssueDate;
        invoice.Reference = input.Reference?.Trim() ?? "";
        invoice.Note = input.Note?.Trim() ?? "";
        await db.SaveChangesAsync(ct);
        return await Responses(db.Invoices.AsNoTracking().Where(x => x.Id == id)).SingleAsync(ct);
    }

    public async Task<bool> DeleteAsync(int id, CancellationToken ct)
    {
        var invoice = await db.Invoices.FindAsync([id], ct);
        if (invoice is null) return false;
        await files.QueueDeletionAsync(id, ct);
        db.Invoices.Remove(invoice);
        await db.SaveChangesAsync(ct);
        return true;
    }

    private async Task RequireSupplierAsync(int id, int? existingId, CancellationToken ct)
    {
        if (!await db.Suppliers.AnyAsync(x => x.Id == id && (x.IsActive || x.Id == existingId), ct))
            throw new InvoiceValidationException("Elegí un proveedor activo de los que tenés cargados.");
    }

    private static void ValidateMetadata(InvoiceMetadataRequest input)
    {
        if (input.SupplierId <= 0 || input.IssueDate.Year < 1900 || input.Reference?.Length > 100 || input.Note?.Length > 1000)
            throw new InvoiceValidationException("Revisá el proveedor, la fecha y la extensión de los datos de la factura.");
    }
}
