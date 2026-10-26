using GestionMesas.Api;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Xunit;

namespace GestionMesas.Api.Tests;

public sealed class DatabaseInitializationTests
{
    [Fact]
    public async Task RepeatedStartupPreservesExistingRowsSettingsAndPendingOrders()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        var options = new DbContextOptionsBuilder<RestaurantContext>().UseSqlite(connection).Options;
        await using (var db = new RestaurantContext(options))
        {
            DatabaseInitializer.Initialize(db);
            var table = await db.Tables.FirstAsync();
            table.Name = "Mesa personalizada";
            db.WelcomeMessageSettings.Add(new WelcomeMessageSetting { Amount = 4500, GreetingText = "Hola {nombre}", FooterText = "" });
            db.PendingOrders.Add(new PendingOrder { CustomerName = "Ana", CreatedAt = DateTime.UtcNow, Items = [new PendingOrderItem { ProductId = 1, Quantity = 2, CreatedAt = DateTime.UtcNow }] });
            await db.SaveChangesAsync();
        }
        await using var reloaded = new RestaurantContext(options);
        DatabaseInitializer.Initialize(reloaded);
        DatabaseInitializer.Initialize(reloaded);
        Assert.Single(await reloaded.Users.ToListAsync());
        Assert.Equal(5, await reloaded.Tables.CountAsync());
        Assert.Contains(await reloaded.Tables.ToListAsync(), table => table.Name == "Mesa personalizada");
        Assert.Equal(5, await reloaded.Products.CountAsync());
        Assert.Equal(4500, (await reloaded.WelcomeMessageSettings.SingleAsync()).Amount);
        Assert.Equal("", (await reloaded.WelcomeMessageSettings.SingleAsync()).FooterText);
        Assert.Equal("Ana", (await reloaded.PendingOrders.SingleAsync()).CustomerName);
        Assert.Equal(2, (await reloaded.PendingOrderItems.SingleAsync()).Quantity);
    }

    [Theory]
    [InlineData("Data Source=gestion-mesas.db", false)]
    [InlineData("Host=localhost;Database=mesas", true)]
    [InlineData("postgres://demo:example@localhost/mesas", true)]
    [InlineData("postgresql://demo:example@localhost/mesas", true)]
    public void ProviderSelectionPreservesExistingConnectionFormats(string connection, bool postgres) =>
        Assert.Equal(postgres, DatabaseConnection.IsPostgreSqlConnectionString(connection));

    [Fact]
    public void RenderDatabaseUrlsKeepCredentialsPortDatabaseAndSsl()
    {
        var converted = DatabaseConnection.ToNpgsqlConnectionString("postgresql://demo%40user:example%3Avalue@db.example:5433/mesas?sslmode=require");
        var parsed = new NpgsqlConnectionStringBuilder(converted);
        Assert.Equal("db.example", parsed.Host);
        Assert.Equal(5433, parsed.Port);
        Assert.Equal("demo@user", parsed.Username);
        Assert.Equal("example:value", parsed.Password);
        Assert.Equal("mesas", parsed.Database);
        Assert.Equal(SslMode.Require, parsed.SslMode);
        const string sqlite = "Data Source=gestion-mesas.db";
        Assert.Equal(sqlite, DatabaseConnection.ToNpgsqlConnectionString(sqlite));
    }
}
