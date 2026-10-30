using GestionMesas.Api;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace GestionMesas.Api.Tests;

public sealed class InvoiceSchemaTests
{
    [Fact]
    public async Task SQLiteUpgradeAddsArchiveToExistingDatabaseAndPreservesDocumentsOnRepeatedStartup()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:"); await connection.OpenAsync();
        await using var db = new RestaurantContext(new DbContextOptionsBuilder<RestaurantContext>().UseSqlite(connection).Options);
        await VerifyUpgradeAsync(db);
    }

    [PostgresFact]
    public async Task PostgreSqlUpgradeAddsArchiveToExistingDatabaseAndPreservesDocumentsOnRepeatedStartup()
    {
        await using var database = await PostgresTestDatabase.CreateAsync(Environment.GetEnvironmentVariable(PostgresTestDatabase.EnvironmentVariable)!);
        await using var db = new RestaurantContext(new DbContextOptionsBuilder<RestaurantContext>().UseNpgsql(database.ConnectionString).Options);
        await VerifyUpgradeAsync(db);
    }

    private static async Task VerifyUpgradeAsync(RestaurantContext db)
    {
        await db.Database.EnsureCreatedAsync();
        var supplier = new Supplier { Name = "Proveedor conservado", CreatedAt = DateTime.UtcNow, ReservedBalance = 500, ReservedCashBalance = 500 };
        db.Suppliers.Add(supplier); await db.SaveChangesAsync();
        await db.Database.ExecuteSqlRawAsync("""DROP TABLE "InvoiceDocuments";""");
        await db.Database.ExecuteSqlRawAsync("""DROP TABLE "Invoices";""");
        InvoiceSchemaUpgrade.Apply(db);
        var store = new DatabaseInvoiceFileStore(db);
        var service = new InvoiceService(db, store);
        var invoice = await service.CreateAsync(new(supplier.Id, new(2026, 10, 30)), InvoiceServiceTests.Pdf, 1, 1000, default);
        db.ChangeTracker.Clear();
        await db.Database.ExecuteSqlRawAsync("""DROP INDEX "IX_InvoiceDocuments_CloudinaryPublicId";""");
        await db.Database.ExecuteSqlRawAsync("""ALTER TABLE "InvoiceDocuments" DROP COLUMN "CloudinaryPublicId";""");
        await db.Database.ExecuteSqlRawAsync("""ALTER TABLE "InvoiceDocuments" DROP COLUMN "CloudinaryAssetId";""");
        await db.Database.ExecuteSqlRawAsync("""ALTER TABLE "InvoiceDocuments" DROP COLUMN "CloudinaryCloudName";""");
        await db.Database.ExecuteSqlRawAsync("""DROP TABLE "InvoiceFileCleanups";""");
        InvoiceSchemaUpgrade.Apply(db);
        InvoiceSchemaUpgrade.Apply(db);
        Assert.Equal(500, (await db.Suppliers.SingleAsync()).ReservedBalance);
        Assert.Single((await service.ListAsync(null, null, 1, 12, default)).Items);
        Assert.Equal(InvoiceServiceTests.Pdf, await store.ReadAsync(invoice.Id, default));
        Assert.Equal("", (await db.InvoiceDocuments.SingleAsync()).CloudinaryPublicId);
        Assert.Empty(await db.InvoiceFileCleanups.ToListAsync());
    }
}
