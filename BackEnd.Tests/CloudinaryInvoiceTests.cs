using System.Net;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text;
using GestionMesas.Api;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace GestionMesas.Api.Tests;

public sealed class CloudinaryInvoiceTests
{
    private static readonly DateOnly Date = new(2026, 10, 30);

    [Fact]
    public async Task NewInvoicesUploadPrivateRawPdfAndStoreOnlyCloudinaryReferences()
    {
        await using var fixture = await Fixture.CreateAsync();
        var invoice = await fixture.CreateInvoiceAsync();
        var document = await fixture.Db.InvoiceDocuments.SingleAsync();
        Assert.Empty(document.Content);
        Assert.EndsWith(".pdf", document.CloudinaryPublicId);
        Assert.StartsWith("shop-family/facturas/", document.CloudinaryPublicId);
        Assert.Equal("test-cloud", document.CloudinaryCloudName);
        Assert.NotEmpty(document.CloudinaryAssetId);
        Assert.Empty(await fixture.Db.InvoiceFileCleanups.ToListAsync());
        Assert.Equal(InvoiceServiceTests.Pdf, await fixture.Store.ReadAsync(invoice.Id, default));
        Assert.Equal(1, fixture.Handler.Reads);
        Assert.Single(fixture.Handler.Assets);
    }

    [Fact]
    public async Task DeletionQueuesCloudinaryRemovalAtomicallyAndRetriesFailures()
    {
        await using var fixture = await Fixture.CreateAsync();
        var invoice = await fixture.CreateInvoiceAsync();
        await fixture.Service.DeleteAsync(invoice.Id, default);
        Assert.Null(await fixture.Store.ReadAsync(invoice.Id, default));
        Assert.Single(fixture.Handler.Assets);
        fixture.Handler.FailDeletes = 1;
        await fixture.Maintenance.RunAsync(default);
        var job = await fixture.Db.InvoiceFileCleanups.SingleAsync();
        Assert.Equal(1, job.Attempts);
        Assert.True(job.NotBefore > fixture.Clock.GetUtcNow().UtcDateTime);
        fixture.Clock.Now = fixture.Clock.Now.AddMinutes(2);
        await fixture.Maintenance.RunAsync(default);
        Assert.Empty(fixture.Handler.Assets);
        Assert.Empty(await fixture.Db.InvoiceFileCleanups.ToListAsync());
        Assert.Empty(await fixture.Db.Invoices.ToListAsync());
    }

    [Fact]
    public async Task InterruptedUploadKeepsRecoveryInformationWithoutCreatingAnInvoice()
    {
        await using var fixture = await Fixture.CreateAsync();
        fixture.Handler.FailAfterUpload = true;
        await Assert.ThrowsAsync<InvoiceStorageException>(() => fixture.CreateInvoiceAsync());
        Assert.Empty(await fixture.Db.Invoices.ToListAsync());
        Assert.Single(await fixture.Db.InvoiceFileCleanups.ToListAsync());
        Assert.Single(fixture.Handler.Assets);
        fixture.Clock.Now = fixture.Clock.Now.AddDays(2);
        await fixture.Maintenance.RunAsync(default);
        Assert.Empty(fixture.Handler.Assets);
        Assert.Empty(await fixture.Db.InvoiceFileCleanups.ToListAsync());
    }

    [Fact]
    public async Task MetadataPersistenceFailureLeavesTheUploadedFileRecoverable()
    {
        await using var fixture = await Fixture.CreateAsync(rejectInvoices: true);
        await Assert.ThrowsAsync<DbUpdateException>(() => fixture.CreateInvoiceAsync());
        fixture.Db.ChangeTracker.Clear();
        Assert.Equal(0, await fixture.Db.Invoices.CountAsync());
        Assert.Single(await fixture.Db.InvoiceFileCleanups.ToListAsync());
        fixture.Clock.Now = fixture.Clock.Now.AddDays(2);
        await fixture.Maintenance.RunAsync(default);
        Assert.Empty(fixture.Handler.Assets);
    }

    [Fact]
    public async Task ExistingDatabaseScansRemainReadableUntilMigratedAndBytesAreClearedOnlyAfterSuccess()
    {
        await using var fixture = await Fixture.CreateAsync();
        var legacyService = new InvoiceService(fixture.Db, new DatabaseInvoiceFileStore(fixture.Db));
        var invoice = await legacyService.CreateAsync(new(fixture.SupplierId, Date), InvoiceServiceTests.Pdf, 1, 1000, default);
        Assert.Equal(InvoiceServiceTests.Pdf, await fixture.Store.ReadAsync(invoice.Id, default));
        fixture.Handler.FailAfterUpload = true;
        await Assert.ThrowsAsync<InvoiceStorageException>(() => fixture.Maintenance.RunAsync(default));
        Assert.Equal(InvoiceServiceTests.Pdf, (await fixture.Db.InvoiceDocuments.SingleAsync()).Content);
        fixture.Handler.FailAfterUpload = false;
        await fixture.Maintenance.RunAsync(default);
        var migrated = await fixture.Db.InvoiceDocuments.SingleAsync();
        Assert.Empty(migrated.Content);
        Assert.NotEmpty(migrated.CloudinaryAssetId);
        Assert.Equal(InvoiceServiceTests.Pdf, await fixture.Store.ReadAsync(invoice.Id, default));
        fixture.Clock.Now = fixture.Clock.Now.AddDays(2);
        await fixture.Maintenance.RunAsync(default);
        Assert.Single(fixture.Handler.Assets);
    }

    [Fact]
    public async Task CleanupNeverRemovesAnAssetReferencedByASavedInvoice()
    {
        await using var fixture = await Fixture.CreateAsync();
        await fixture.CreateInvoiceAsync();
        var document = await fixture.Db.InvoiceDocuments.SingleAsync();
        fixture.Db.InvoiceFileCleanups.Add(new() { CloudName = document.CloudinaryCloudName,
            PublicId = document.CloudinaryPublicId, NotBefore = fixture.Clock.GetUtcNow().UtcDateTime });
        await fixture.Db.SaveChangesAsync();
        await fixture.Maintenance.RunAsync(default);
        Assert.Single(fixture.Handler.Assets);
        Assert.Equal(0, fixture.Handler.Deletes);
        Assert.Empty(await fixture.Db.InvoiceFileCleanups.ToListAsync());
    }

    [Fact]
    public async Task ChangedCloudAccountCannotReadOrDeleteAnOriginalAccountsAssets()
    {
        await using var fixture = await Fixture.CreateAsync();
        var invoice = await fixture.CreateInvoiceAsync();
        var document = await fixture.Db.InvoiceDocuments.SingleAsync();
        document.CloudinaryCloudName = "another-cloud";
        await fixture.Db.SaveChangesAsync();
        await Assert.ThrowsAsync<InvoiceStorageException>(() => fixture.Store.ReadAsync(invoice.Id, default));
        await fixture.Service.DeleteAsync(invoice.Id, default);
        await fixture.Maintenance.RunAsync(default);
        Assert.Single(fixture.Handler.Assets);
        Assert.Equal(0, fixture.Handler.Deletes);
        Assert.Equal(1, (await fixture.Db.InvoiceFileCleanups.SingleAsync()).Attempts);
    }

    [Fact]
    public async Task MissingConfigurationReturnsActionableErrorAndNeverFallsBackToDatabaseUploads()
    {
        await using var host = await ApiTestHost.StartAsync(); await host.SignInAsync();
        var response = await host.Client.PostAsJsonAsync("/api/suppliers", new CreateSupplierRequest("Proveedor Cloudinary"));
        var supplier = (await response.Content.ReadFromJsonAsync<SupplierResponse>())!;
        using var form = new MultipartFormDataContent();
        var file = new ByteArrayContent(InvoiceServiceTests.Pdf); file.Headers.ContentType = new("application/pdf");
        form.Add(file, "document", "factura.pdf");
        foreach (var item in new Dictionary<string, string> { ["supplierId"] = supplier.Id.ToString(), ["issueDate"] = "2026-10-30", ["pageCount"] = "1", ["originalBytes"] = "1000" })
            form.Add(new StringContent(item.Value), item.Key);
        var upload = await host.Client.PostAsync("/api/invoices", form);
        Assert.Equal(HttpStatusCode.ServiceUnavailable, upload.StatusCode);
        Assert.Contains("configurar Cloudinary", await upload.Content.ReadAsStringAsync());
        Assert.Equal(0, (await host.Client.GetFromJsonAsync<InvoiceListResponse>("/api/invoices"))!.TotalCount);
    }

    private sealed class FakeClock : TimeProvider
    {
        public DateTimeOffset Now { get; set; } = new(2026, 10, 30, 12, 0, 0, TimeSpan.Zero);
        public override DateTimeOffset GetUtcNow() => Now;
    }

    private sealed class FakeCloudinary : HttpMessageHandler
    {
        public Dictionary<string, byte[]> Assets { get; } = [];
        public int Reads { get; private set; }
        public int Deletes { get; private set; }
        public int FailDeletes { get; set; }
        public bool FailAfterUpload { get; set; }
        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            Assert.Equal("https", request.RequestUri!.Scheme);
            Assert.Equal("api.cloudinary.com", request.RequestUri.Host);
            Assert.Empty(request.RequestUri.Query);
            var fields = new Dictionary<string, string>(); byte[]? file = null;
            if (request.Content is MultipartFormDataContent multipart)
                foreach (var part in multipart)
                {
                    var name = part.Headers.ContentDisposition!.Name!.Trim('"');
                    if (name == "file") file = await part.ReadAsByteArrayAsync(ct);
                    else fields[name] = await part.ReadAsStringAsync(ct);
                }
            else
                foreach (var pair in (await request.Content!.ReadAsStringAsync(ct)).Split('&'))
                { var parts = pair.Split('=', 2); fields[Uri.UnescapeDataString(parts[0])] = Uri.UnescapeDataString(parts[1].Replace('+', ' ')); }
            Assert.Equal("test-key", fields["api_key"]);
            Assert.DoesNotContain("test-private-secret", string.Join('&', fields.Values));
            var payload = string.Join('&', fields.Where(x => x.Key is not ("signature" or "api_key")).OrderBy(x => x.Key, StringComparer.Ordinal).Select(x => $"{x.Key}={x.Value}")) + "test-private-secret";
            Assert.Equal(Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(payload))), fields["signature"]);
            if (request.RequestUri.AbsolutePath.EndsWith("raw/upload"))
            {
                Assert.Equal("private", fields["type"]); Assert.Equal("false", fields["overwrite"]);
                Assets[fields["public_id"]] = file!;
                if (FailAfterUpload) return new(HttpStatusCode.ServiceUnavailable);
                return new(HttpStatusCode.OK) { Content = JsonContent.Create(new { public_id = fields["public_id"], asset_id = fields["public_id"], resource_type = "raw", type = "private", bytes = file!.Length }) };
            }
            if (request.RequestUri.AbsolutePath.EndsWith("asset/download"))
            {
                Reads++;
                return new(HttpStatusCode.OK) { Content = new ByteArrayContent(Assets[fields["asset_id"]]) };
            }
            Assert.EndsWith("raw/destroy", request.RequestUri.AbsolutePath);
            if (FailDeletes-- > 0) return new(HttpStatusCode.ServiceUnavailable);
            Deletes++;
            return new(HttpStatusCode.OK) { Content = JsonContent.Create(new { result = Assets.Remove(fields["public_id"]) ? "ok" : "not found" }) };
        }
    }

    private sealed class RejectInvoiceContext(DbContextOptions<RestaurantContext> options) : RestaurantContext(options)
    {
        public override Task<int> SaveChangesAsync(CancellationToken ct = default)
        {
            if (ChangeTracker.Entries<InvoiceRecord>().Any(x => x.State == EntityState.Added)) throw new DbUpdateException("Simulated metadata failure");
            return base.SaveChangesAsync(ct);
        }
    }

    private sealed class Fixture(SqliteConnection connection, RestaurantContext db, HttpClient http, FakeCloudinary handler, FakeClock clock, int supplierId) : IAsyncDisposable
    {
        private static readonly CloudinaryInvoiceOptions Options = new() { CloudName = "test-cloud", ApiKey = "test-key", ApiSecret = "test-private-secret" };
        public RestaurantContext Db { get; } = db;
        public FakeCloudinary Handler { get; } = handler;
        public FakeClock Clock { get; } = clock;
        public int SupplierId { get; } = supplierId;
        public CloudinaryInvoiceFileStore Store { get; } = new(db, new(http, Options, clock), Options, clock);
        public InvoiceService Service => new(Db, Store);
        public InvoiceStorageMaintenance Maintenance => new(Db, new(http, Options, Clock), Store, Options, Clock, NullLogger<InvoiceStorageMaintenance>.Instance);
        public Task<InvoiceResponse> CreateInvoiceAsync() => Service.CreateAsync(new(SupplierId, Date), InvoiceServiceTests.Pdf, 1, 1000, default);
        public static async Task<Fixture> CreateAsync(bool rejectInvoices = false)
        {
            var connection = new SqliteConnection("Data Source=:memory:"); await connection.OpenAsync();
            var options = new DbContextOptionsBuilder<RestaurantContext>().UseSqlite(connection).Options;
            RestaurantContext db = rejectInvoices ? new RejectInvoiceContext(options) : new RestaurantContext(options);
            await db.Database.EnsureCreatedAsync();
            var supplier = new Supplier { Name = "Proveedor", CreatedAt = DateTime.UtcNow };
            db.Suppliers.Add(supplier); await db.SaveChangesAsync();
            var handler = new FakeCloudinary(); var http = new HttpClient(handler);
            return new(connection, db, http, handler, new FakeClock(), supplier.Id);
        }
        public async ValueTask DisposeAsync() { http.Dispose(); await Db.DisposeAsync(); await connection.DisposeAsync(); }
    }
}
