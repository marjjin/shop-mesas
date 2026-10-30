using GestionMesas.Api;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace GestionMesas.Api.Tests;

public sealed class CigaretteCashSchemaTests
{
    [Fact]
    public async Task SQLiteUpgradePreservesLegacyPurchasesAndClosesAndIsIdempotent()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        await using var db = new RestaurantContext(new DbContextOptionsBuilder<RestaurantContext>().UseSqlite(connection).Options);
        await VerifyLegacyUpgradeAsync(db);
    }

    [PostgresFact]
    public async Task PostgreSqlUpgradePreservesLegacyPurchasesAndClosesAndIsIdempotent()
    {
        await using var database = await PostgresTestDatabase.CreateAsync(Environment.GetEnvironmentVariable(PostgresTestDatabase.EnvironmentVariable)!);
        await using var db = new RestaurantContext(new DbContextOptionsBuilder<RestaurantContext>().UseNpgsql(database.ConnectionString).Options);
        await VerifyLegacyUpgradeAsync(db);
    }

    private static async Task VerifyLegacyUpgradeAsync(RestaurantContext db)
    {
        await db.Database.EnsureCreatedAsync();
        var date = new DateOnly(2026, 10, 30);
        var product = new CigaretteProduct { Name = "Histórico", Price = 100, Stock = 10, CreatedAt = DateTime.UtcNow };
        db.CigaretteProducts.Add(product);
        await db.SaveChangesAsync();
        db.CigarettePurchases.Add(new CigarettePurchase { CigaretteProductId = product.Id, Quantity = 2, BusinessDate = date, Shift = "morning", CreatedAt = DateTime.UtcNow });
        db.CigaretteShiftCloses.Add(new CigaretteShiftClose { BusinessDate = date, Shift = "morning", ClosedAt = DateTime.UtcNow,
            Items = [new() { CigaretteProductId = product.Id, ProductName = product.Name, InitialStock = 10, PurchasedQuantity = 2, FinalStock = 10, SoldQuantity = 2, UnitPrice = 100, SalesAmount = 200 }] });
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();
        await db.Database.ExecuteSqlRawAsync("""ALTER TABLE "CigarettePurchases" DROP COLUMN "TotalCost";""");
        await db.Database.ExecuteSqlRawAsync("""ALTER TABLE "CigarettePurchases" DROP COLUMN "PaymentMethod";""");
        await db.Database.ExecuteSqlRawAsync("""ALTER TABLE "CigaretteShiftCloses" DROP COLUMN "CigaretteReservedCash";""");
        await db.Database.ExecuteSqlRawAsync("""ALTER TABLE "CigaretteShiftCloses" DROP COLUMN "CigaretteReservedMercadoPago";""");

        CigaretteCashSchemaUpgrade.Apply(db);
        CigaretteCashSchemaUpgrade.Apply(db);
        var purchase = await db.CigarettePurchases.SingleAsync();
        Assert.Null(purchase.TotalCost);
        Assert.Equal("cash", purchase.PaymentMethod);
        Assert.Equal(2, purchase.Quantity);
        var close = await db.CigaretteShiftCloses.SingleAsync();
        Assert.Null(close.CigaretteReservedCash);
        Assert.Null(close.CigaretteReservedMercadoPago);
        var cash = await new CigaretteCashService(db).GetAsync(date, 1, 12, default);
        Assert.Equal(200, cash.Totals.Sales);
        Assert.Equal(0, cash.Totals.Balance);
        Assert.Equal(1, cash.Totals.MissingPurchaseAmounts);
        Assert.Equal(1, cash.Totals.MissingReservations);
    }
}
