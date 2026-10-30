using Microsoft.EntityFrameworkCore;

namespace GestionMesas.Api;

public sealed class InvoiceRecord
{
    public int Id { get; set; }
    public int SupplierId { get; set; }
    public Supplier Supplier { get; set; } = null!;
    public string Reference { get; set; } = "";
    public string Note { get; set; } = "";
    public DateOnly IssueDate { get; set; }
    public DateTime CreatedAt { get; set; }
    public int PageCount { get; set; }
    public int SizeBytes { get; set; }
    public long OriginalBytes { get; set; }
}

public sealed class InvoiceDocument
{
    public int InvoiceId { get; set; }
    public byte[] Content { get; set; } = [];
    public string CloudinaryPublicId { get; set; } = "";
    public string CloudinaryAssetId { get; set; } = "";
    public string CloudinaryCloudName { get; set; } = "";
}

public sealed class InvoiceFileCleanup
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N");
    public string CloudName { get; set; } = "";
    public string PublicId { get; set; } = "";
    public DateTime NotBefore { get; set; }
    public int Attempts { get; set; }
}

internal static class InvoiceModel
{
    public static void Configure(ModelBuilder model)
    {
        model.Entity<InvoiceRecord>().ToTable("Invoices");
        model.Entity<InvoiceRecord>().Property(x => x.Reference).HasMaxLength(100);
        model.Entity<InvoiceRecord>().Property(x => x.Note).HasMaxLength(1000);
        model.Entity<InvoiceRecord>().HasIndex(x => new { x.SupplierId, x.IssueDate });
        model.Entity<InvoiceRecord>().HasIndex(x => x.CreatedAt);
        model.Entity<InvoiceRecord>().HasOne(x => x.Supplier).WithMany().HasForeignKey(x => x.SupplierId).OnDelete(DeleteBehavior.Restrict);
        model.Entity<InvoiceDocument>().ToTable("InvoiceDocuments").HasKey(x => x.InvoiceId);
        model.Entity<InvoiceDocument>().Property(x => x.CloudinaryPublicId).HasDefaultValue("");
        model.Entity<InvoiceDocument>().Property(x => x.CloudinaryAssetId).HasDefaultValue("");
        model.Entity<InvoiceDocument>().Property(x => x.CloudinaryCloudName).HasDefaultValue("");
        model.Entity<InvoiceDocument>().HasIndex(x => x.CloudinaryPublicId);
        model.Entity<InvoiceDocument>().HasOne<InvoiceRecord>().WithOne().HasForeignKey<InvoiceDocument>(x => x.InvoiceId).OnDelete(DeleteBehavior.Cascade);
        model.Entity<InvoiceFileCleanup>().ToTable("InvoiceFileCleanups").HasKey(x => x.Id);
        model.Entity<InvoiceFileCleanup>().HasIndex(x => x.NotBefore);
        model.Entity<InvoiceFileCleanup>().HasIndex(x => new { x.CloudName, x.PublicId }).IsUnique();
    }
}
