using System.Text;
using GestionMesas.Api;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace GestionMesas.Api.Tests;

public sealed class InvoiceServiceTests
{
    internal static readonly byte[] Pdf = Encoding.ASCII.GetBytes("%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF\n");
    private static readonly DateOnly Date = new(2026, 10, 30);

    [Fact]
    public async Task InvoicePersistsCompressedDocumentAndSupplierWithoutChangingFinancialAccounts()
    {
        await using var fixture = await Fixture.CreateAsync();
        var invoice = await fixture.Service.CreateAsync(new(fixture.SupplierId, Date, " A-123 ", " Copia "), Pdf, 2, 1000000, default);
        Assert.Equal("A-123", invoice.Reference);
        Assert.Equal("Copia", invoice.Note);
        Assert.Equal("Proveedor uno", invoice.SupplierName);
        Assert.Equal(2, invoice.PageCount);
        Assert.Equal(Pdf.Length, invoice.SizeBytes);
        Assert.Equal(1000000, invoice.OriginalBytes);
        Assert.Equal(Pdf, await fixture.Files.ReadAsync(invoice.Id, default));
        var supplier = await fixture.Db.Suppliers.FindAsync(fixture.SupplierId);
        Assert.Equal(500, supplier!.ReservedBalance);
        Assert.Equal(300, supplier.CurrentAccountBalance);
        Assert.Empty(await fixture.Db.SupplierTransactions.ToListAsync());
        Assert.Empty(await fixture.Db.CigarettePurchases.ToListAsync());
        Assert.Empty(await fixture.Db.CashDrops.ToListAsync());
    }

    [Fact]
    public async Task SearchAndSupplierFiltersKeepGlobalSummaryAndPaginatedResults()
    {
        await using var fixture = await Fixture.CreateAsync();
        await fixture.Service.CreateAsync(new(fixture.SupplierId, Date, "A-123"), Pdf, 1, 100, default);
        await fixture.Service.CreateAsync(new(fixture.SupplierId, Date, "B-456"), Pdf, 1, 100, default);
        var second = new Supplier { Name = "Proveedor dos", CreatedAt = DateTime.UtcNow };
        fixture.Db.Suppliers.Add(second); await fixture.Db.SaveChangesAsync();
        await fixture.Service.CreateAsync(new(second.Id, Date, "C-789"), Pdf, 1, 100, default);
        var list = await fixture.Service.ListAsync(null, fixture.SupplierId, 2, 1, default);
        Assert.Equal(2, list.TotalCount);
        Assert.Single(list.Items);
        Assert.Equal(3, list.Summary.Count);
        Assert.Equal(2, list.Summary.SupplierCount);
        Assert.Equal(Pdf.Length * 3, list.Summary.SizeBytes);
        Assert.Single((await fixture.Service.ListAsync("a-123", null, 1, 12, default)).Items);
        Assert.Single((await fixture.Service.ListAsync("proveedor DOS", null, 1, 12, default)).Items);
        Assert.Empty((await fixture.Service.ListAsync("no existe", null, 1, 12, default)).Items);
    }

    [Fact]
    public async Task InactiveSuppliersRemainLinkedButCannotReceiveNewInvoicesOrReassignments()
    {
        await using var fixture = await Fixture.CreateAsync();
        var invoice = await fixture.Service.CreateAsync(new(fixture.SupplierId, Date), Pdf, 1, 100, default);
        var supplier = await fixture.Db.Suppliers.FindAsync(fixture.SupplierId);
        supplier!.IsActive = false; await fixture.Db.SaveChangesAsync();
        Assert.False(Assert.Single(await fixture.Service.SuppliersAsync(default)).IsActive);
        Assert.NotNull(await fixture.Service.UpdateAsync(invoice.Id, new(fixture.SupplierId, Date, "Corregida"), default));
        await Assert.ThrowsAsync<InvoiceValidationException>(() => fixture.Service.CreateAsync(new(fixture.SupplierId, Date), Pdf, 1, 100, default));
        var active = new Supplier { Name = "Nuevo", CreatedAt = DateTime.UtcNow };
        fixture.Db.Suppliers.Add(active); await fixture.Db.SaveChangesAsync();
        var reassigned = await fixture.Service.UpdateAsync(invoice.Id, new(active.Id, Date), default);
        Assert.Equal(active.Id, reassigned!.SupplierId);
        await Assert.ThrowsAsync<InvoiceValidationException>(() => fixture.Service.UpdateAsync(invoice.Id, new(fixture.SupplierId, Date), default));
        Assert.Equal(Pdf, await fixture.Files.ReadAsync(invoice.Id, default));
    }

    [Fact]
    public async Task DeletingInvoiceRemovesItsDocumentAndRetainsTheSupplier()
    {
        await using var fixture = await Fixture.CreateAsync();
        var invoice = await fixture.Service.CreateAsync(new(fixture.SupplierId, Date), Pdf, 1, 100, default);
        Assert.True(await fixture.Service.DeleteAsync(invoice.Id, default));
        fixture.Db.ChangeTracker.Clear();
        Assert.Null(await fixture.Files.ReadAsync(invoice.Id, default));
        Assert.Single(await fixture.Db.Suppliers.ToListAsync());
        Assert.Equal(0, (await fixture.Service.ListAsync(null, null, 1, 12, default)).Summary.SizeBytes);
        Assert.False(await fixture.Service.DeleteAsync(invoice.Id, default));
    }

    [Fact]
    public async Task FailedDocumentPersistenceRollsBackItsMetadata()
    {
        await using var fixture = await Fixture.CreateAsync();
        var service = new InvoiceService(fixture.Db, new FailingFileStore());
        await Assert.ThrowsAsync<IOException>(() => service.CreateAsync(new(fixture.SupplierId, Date), Pdf, 1, 100, default));
        Assert.Equal(0, await fixture.Db.Invoices.CountAsync());
        Assert.Equal(0, await fixture.Db.InvoiceDocuments.CountAsync());
    }

    [Theory]
    [InlineData(0)]
    [InlineData(11)]
    public async Task InvalidPageCountsCannotCreateInvoices(int pages)
    {
        await using var fixture = await Fixture.CreateAsync();
        await Assert.ThrowsAsync<InvoiceValidationException>(() => fixture.Service.CreateAsync(new(fixture.SupplierId, Date), Pdf, pages, 100, default));
        Assert.Empty(await fixture.Db.Invoices.ToListAsync());
    }

    [Fact]
    public async Task InvalidPdfMissingSupplierAndOversizedFilesAreRejected()
    {
        await using var fixture = await Fixture.CreateAsync();
        foreach (var bytes in new[] { Array.Empty<byte>(), Encoding.ASCII.GetBytes("Imagen que no es un PDF"), new byte[InvoiceService.MaxFileBytes + 1] })
            await Assert.ThrowsAsync<InvoiceValidationException>(() => fixture.Service.CreateAsync(new(fixture.SupplierId, Date), bytes, 1, 100, default));
        await Assert.ThrowsAsync<InvoiceValidationException>(() => fixture.Service.CreateAsync(new(9999, Date), Pdf, 1, 100, default));
        await Assert.ThrowsAsync<InvoiceValidationException>(() => fixture.Service.CreateAsync(new(fixture.SupplierId, Date, new string('a', 101)), Pdf, 1, 100, default));
        await Assert.ThrowsAsync<InvoiceValidationException>(() => fixture.Service.ListAsync(null, null, int.MaxValue, 12, default));
        Assert.Empty(await fixture.Db.Invoices.ToListAsync());
    }

    private sealed class FailingFileStore : IInvoiceFileStore
    {
        public Task<StagedInvoiceFile> StageAsync(byte[] content, CancellationToken ct) => throw new IOException("Simulated storage failure");
        public Task<byte[]?> ReadAsync(int invoiceId, CancellationToken ct) => throw new NotSupportedException();
        public Task QueueDeletionAsync(int invoiceId, CancellationToken ct) => Task.CompletedTask;
    }

    private sealed class Fixture(SqliteConnection connection, RestaurantContext db, int supplierId) : IAsyncDisposable
    {
        public RestaurantContext Db { get; } = db;
        public DatabaseInvoiceFileStore Files { get; } = new(db);
        public InvoiceService Service { get; } = new(db, new DatabaseInvoiceFileStore(db));
        public int SupplierId { get; } = supplierId;
        public static async Task<Fixture> CreateAsync()
        {
            var connection = new SqliteConnection("Data Source=:memory:"); await connection.OpenAsync();
            var db = new RestaurantContext(new DbContextOptionsBuilder<RestaurantContext>().UseSqlite(connection).Options);
            await db.Database.EnsureCreatedAsync();
            var supplier = new Supplier { Name = "Proveedor uno", CreatedAt = DateTime.UtcNow, ReservedBalance = 500, ReservedCashBalance = 500, CurrentAccountBalance = 300 };
            db.Suppliers.Add(supplier); await db.SaveChangesAsync();
            return new(connection, db, supplier.Id);
        }
        public async ValueTask DisposeAsync() { await Db.DisposeAsync(); await connection.DisposeAsync(); }
    }
}
