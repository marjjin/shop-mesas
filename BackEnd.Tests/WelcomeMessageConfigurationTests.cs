using GestionMesas.Api;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace GestionMesas.Api.Tests;

public sealed class WelcomeMessageConfigurationTests
{
    [Fact]
    public async Task UpgradesAnExistingAmountWithoutLosingItAndPersistsText()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        var options = new DbContextOptionsBuilder<RestaurantContext>().UseSqlite(connection).Options;
        await using (var db = new RestaurantContext(options))
        {
            await db.Database.ExecuteSqlRawAsync("""CREATE TABLE "WelcomeMessageSettings" ("Id" INTEGER PRIMARY KEY, "Amount" TEXT NOT NULL); INSERT INTO "WelcomeMessageSettings" VALUES (1, '3500');""");
            WelcomeMessageConfiguration.EnsureSchema(db);
            WelcomeMessageConfiguration.EnsureSchema(db);
            var existing = await db.WelcomeMessageSettings.SingleAsync();
            Assert.Equal(3500m, existing.Amount);
            Assert.Equal(new WelcomeMessageSetting().GreetingText, existing.GreetingText);
            existing.BusinessName = "Mi café";
            existing.GreetingText = "¡Bienvenido, {nombre}!";
            existing.ConditionsText = "Primera línea.\n\nSegunda línea.";
            existing.FooterText = "";
            await db.SaveChangesAsync();
        }
        await using var reloadedDb = new RestaurantContext(options);
        var reloaded = await reloadedDb.WelcomeMessageSettings.SingleAsync();
        Assert.Equal(3500m, reloaded.Amount);
        Assert.Equal("Mi café", reloaded.BusinessName);
        Assert.Equal("¡Bienvenido, {nombre}!", reloaded.GreetingText);
        Assert.Equal("Primera línea.\n\nSegunda línea.", reloaded.ConditionsText);
        Assert.Equal("", reloaded.FooterText);
    }

    [Fact]
    public void AmountOnlyClientsPreserveExistingTexts()
    {
        var current = new WelcomeMessageSetting { BusinessName = "Mi local", GreetingText = "Hola {nombre}", FooterText = "" };
        var updated = WelcomeMessageConfiguration.Merge(new UpdateWelcomeMessageSettingRequest(5000), current);
        Assert.Null(WelcomeMessageConfiguration.Validate(updated));
        Assert.Equal(5000m, updated.Amount);
        Assert.Equal(current.BusinessName, updated.BusinessName);
        Assert.Equal(current.GreetingText, updated.GreetingText);
        Assert.Equal("", updated.FooterText);
        Assert.Equal(3000m, current.Amount);
    }

    [Theory]
    [InlineData("", "Hola", "Consumo")]
    [InlineData("Mi café", " ", "Consumo")]
    [InlineData("Mi café", "Hola", "")]
    public void RequiredTextsCannotBeEmpty(string business, string greeting, string label)
    {
        var setting = WelcomeMessageConfiguration.Merge(new(3500, business, greeting, MinimumLabel: label), null);
        Assert.NotNull(WelcomeMessageConfiguration.Validate(setting));
    }

    [Fact]
    public void ValidatesLimitsAndAcceptsEmptyOptionalTexts()
    {
        var setting = WelcomeMessageConfiguration.Merge(new(3500, MessageText: "", ConditionsText: "", FooterText: ""), null);
        Assert.Null(WelcomeMessageConfiguration.Validate(setting));
        setting.ConditionsText = new string('a', 1501);
        Assert.NotNull(WelcomeMessageConfiguration.Validate(setting));
        setting.ConditionsText = "";
        setting.Amount = 3500.001m;
        Assert.NotNull(WelcomeMessageConfiguration.Validate(setting));
    }
}
