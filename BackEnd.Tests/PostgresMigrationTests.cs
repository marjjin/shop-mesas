using System.Net;
using GestionMesas.Api;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace GestionMesas.Api.Tests;

public sealed class PostgresMigrationTests
{
    [PostgresFact]
    public async Task LegacyPostgresStartupMigratesLoginWithoutLosingBalancesOrBusinessData()
    {
        await using var host = await ApiTestHost.StartAsync(environment: "Production", adminUsername: "shopfamily",
            prepareDatabase: async db =>
            {
                await db.Database.EnsureCreatedAsync();
                var now = DateTime.UtcNow;
                var category = new Category { Name = "Categoría conservada" };
                db.Categories.Add(category);
                var table = new RestaurantTable { Name = "Mesa conservada", CustomerName = "Cliente de prueba", Status = "occupied", OpenedAt = now.AddHours(-1), LastConsumptionAt = now };
                db.Tables.Add(table);
                db.Users.Add(new User { Username = "admin", Password = "admin", Name = "Administrador" });
                var supplier = new Supplier { Name = "Proveedor conservado", ReservedBalance = 650m, ReservedCashBalance = 650m, CurrentAccountBalance = 300m, CreatedAt = now };
                db.Suppliers.Add(supplier);
                var coffee = new CafeteriaProduct { Name = "Café", Price = 2500m, CreatedAt = now };
                db.CafeteriaProducts.Add(coffee);
                var close = new CigaretteShiftClose { BusinessDate = new DateOnly(2026, 10, 27), Shift = "afternoon", ClosedAt = now.AddHours(-2) };
                db.CigaretteShiftCloses.Add(close);
                db.WelcomeMessageSettings.Add(new WelcomeMessageSetting { Amount = 4123m, BusinessName = "SHOP FAMILY", FooterText = "Texto conservado" });
                await db.SaveChangesAsync();
                var product = new Product { Name = "Artículo conservado", CategoryId = category.Id };
                db.Products.Add(product);
                await db.SaveChangesAsync();
                db.Orders.Add(new Order { TableId = table.Id, ProductId = product.Id, Quantity = 2, CreatedAt = now });
                db.CafeteriaSales.Add(new CafeteriaSale { BusinessDate = new DateOnly(2026, 10, 28), Shift = "morning", CreatedAt = now,
                    Items = [new CafeteriaSaleItem { CafeteriaProductId = coffee.Id, ProductName = coffee.Name, UnitPrice = coffee.Price }] });
                db.CashDrops.Add(new CashDrop { Amount = 50m, BusinessDate = close.BusinessDate, Shift = close.Shift, CreatedAt = now.AddHours(-3), CigaretteShiftCloseId = close.Id });
                db.SupplierTransactions.Add(new SupplierTransaction { SupplierId = supplier.Id, Type = "purchase", Amount = 300m, BusinessDate = new DateOnly(2026, 10, 27), CreatedAt = now });
                await db.SaveChangesAsync();
                // Recreate the relevant old columns using only this freshly generated test database.
                await db.Database.ExecuteSqlRawAsync("""
                    DROP TABLE "UserSessions";
                    ALTER TABLE "Users" DROP COLUMN "Role";
                    ALTER TABLE "Suppliers" ADD COLUMN "Balance" numeric(12,2) NOT NULL DEFAULT 0;
                    UPDATE "Suppliers" SET "Balance" = "ReservedBalance";
                    ALTER TABLE "Suppliers" DROP COLUMN "ReservedBalance";
                    ALTER TABLE "Suppliers" DROP COLUMN "ReservedCashBalance";
                    ALTER TABLE "Suppliers" DROP COLUMN "ReservedMercadoPagoBalance";
                    ALTER TABLE "SupplierTransactions" ALTER COLUMN "Type" TYPE character varying(16);
                    """);
            });

        Assert.Equal(HttpStatusCode.Unauthorized, (await host.Client.GetAsync("/api/bootstrap")).StatusCode);
        await host.SignInAsync(username: "shopfamily");
        Assert.Equal(HttpStatusCode.OK, (await host.Client.GetAsync("/api/bootstrap")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await host.Client.GetAsync("/api/suppliers")).StatusCode);

        await using var scope = host.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<RestaurantContext>();
        Assert.True(db.Database.IsNpgsql());
        var user = await db.Users.SingleAsync();
        var hash = user.Password;
        Assert.Equal(1, user.Id);
        Assert.Equal("shopfamily", user.Username);
        Assert.Equal("Administrator", user.Role);
        Assert.True(UserPasswords.IsHashed(hash));
        Assert.Equal(650m, (await db.Suppliers.SingleAsync()).ReservedBalance);
        Assert.Equal(650m, (await db.Suppliers.SingleAsync()).ReservedCashBalance);
        Assert.Equal(300m, (await db.Suppliers.SingleAsync()).CurrentAccountBalance);
        Assert.Equal("Mesa conservada", (await db.Tables.SingleAsync()).Name);
        Assert.Equal(2, (await db.Orders.SingleAsync()).Quantity);
        Assert.Single(await db.CafeteriaSales.ToListAsync());
        Assert.Single(await db.CigaretteShiftCloses.ToListAsync());
        Assert.Equal(50m, (await db.CashDrops.SingleAsync()).Amount);
        Assert.Equal(4123m, (await db.WelcomeMessageSettings.SingleAsync()).Amount);
        Assert.Equal("Texto conservado", (await db.WelcomeMessageSettings.SingleAsync()).FooterText);
        var configuration = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["Authentication:AdminUsername"] = "shopfamily", ["Authentication:AdminPassword"] = ApiTestHost.AdminPassword
        }).Build();
        DatabaseInitializer.Initialize(db);
        AuthenticationBootstrap.Initialize(db, configuration);
        DatabaseInitializer.Initialize(db);
        AuthenticationBootstrap.Initialize(db, configuration);
        Assert.Equal(hash, user.Password);
        Assert.Single(await db.UserSessions.ToListAsync());
        Assert.Single(await db.SupplierTransactions.ToListAsync());
        Assert.Equal(HttpStatusCode.OK, (await host.Client.GetAsync("/api/session")).StatusCode);
    }

    [Theory]
    [InlineData("Host=db.example;Database=postgres;Username=test")]
    [InlineData("Host=127.0.0.1;Database=real_business;Username=test")]
    [InlineData("Host=localhost,db.example;Database=postgres;Username=test")]
    public async Task ValidationRejectsRemoteServersAndNonControlDatabasesBeforeConnecting(string connectionString)
    {
        await Assert.ThrowsAsync<InvalidOperationException>(() => PostgresTestDatabase.CreateAsync(connectionString));
    }
}
