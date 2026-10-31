using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using GestionMesas.Api;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace GestionMesas.Api.Tests;

public sealed class ShiftTicketSettingsTests
{
    private static ShiftTicketLayout ValidLayout() => new(new(8, 6, 8, 6),
    [
        new("cashSummary", "section", true, "ARQUEO", null, [new("cash", true, "Efectivo"), new("posnet", false, "Posnet")]),
        new("custom-1", "text", true, "Aviso", "Primera línea\nSegunda línea", null),
        new("custom-2", "signature", true, "Firma del encargado", null, null)
    ]);

    [Fact]
    public async Task DesignIsPrivateStartsEmptyAndPersistsOrderVisibilityAndTexts()
    {
        await using var host = await ApiTestHost.StartAsync();
        Assert.Equal(HttpStatusCode.Unauthorized, (await host.Client.GetAsync("/api/settings/shift-ticket")).StatusCode);
        await host.SignInAsync();

        var initial = await host.Client.GetFromJsonAsync<JsonElement>("/api/settings/shift-ticket");
        Assert.Equal(JsonValueKind.Null, initial.GetProperty("layout").ValueKind);

        Assert.Equal(HttpStatusCode.OK, (await host.Client.PutAsJsonAsync("/api/settings/shift-ticket", ValidLayout())).StatusCode);
        var replaced = ValidLayout() with { Margins = new(4.5m, 3, 2, 1) };
        Assert.Equal(HttpStatusCode.OK, (await host.Client.PutAsJsonAsync("/api/settings/shift-ticket", replaced)).StatusCode);

        var response = await host.Client.GetAsync("/api/settings/shift-ticket");
        Assert.True(response.Headers.CacheControl?.NoStore);
        var layout = (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("layout");
        Assert.Equal(4.5m, layout.GetProperty("margins").GetProperty("top").GetDecimal());
        var blocks = layout.GetProperty("blocks").EnumerateArray().ToList();
        Assert.Equal(["cashSummary", "custom-1", "custom-2"], blocks.Select(block => block.GetProperty("id").GetString()));
        Assert.False(blocks[0].GetProperty("rows")[1].GetProperty("visible").GetBoolean());
        Assert.Equal("Primera línea\nSegunda línea", blocks[1].GetProperty("text").GetString());
    }

    [Fact]
    public async Task InvalidDesignIsRejectedWithoutReplacingTheSavedOne()
    {
        await using var host = await ApiTestHost.StartAsync();
        await host.SignInAsync();
        await host.Client.PutAsJsonAsync("/api/settings/shift-ticket", ValidLayout());

        var invalid = await host.Client.PutAsJsonAsync("/api/settings/shift-ticket", ValidLayout() with { Margins = new(50, 0, 0, 0) });
        Assert.Equal(HttpStatusCode.BadRequest, invalid.StatusCode);
        Assert.False(string.IsNullOrWhiteSpace((await invalid.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("detail").GetString()));

        var saved = await host.Client.GetFromJsonAsync<JsonElement>("/api/settings/shift-ticket");
        Assert.Equal(8, saved.GetProperty("layout").GetProperty("margins").GetProperty("top").GetDecimal());
    }

    public static TheoryData<ShiftTicketLayout> InvalidLayouts => new()
    {
        new ShiftTicketLayout(null, []),
        new ShiftTicketLayout(new(0, 0, 0, 0), []),
        new ShiftTicketLayout(new(-1, 0, 0, 0), [new("a", "text", true, null, "x", null)]),
        new ShiftTicketLayout(new(1.25m, 0, 0, 0), [new("a", "text", true, null, "x", null)]),
        new ShiftTicketLayout(new(0, 20, 0, 20.5m), [new("a", "text", true, null, "x", null)]),
        new ShiftTicketLayout(new(0, 0, 0, 0), [new("a", "script", true, null, "x", null)]),
        new ShiftTicketLayout(new(0, 0, 0, 0), [new("<a>", "text", true, null, "x", null)]),
        new ShiftTicketLayout(new(0, 0, 0, 0), [new("a", "text", true, null, "x", null), new("a", "text", true, null, "y", null)]),
        new ShiftTicketLayout(new(0, 0, 0, 0), [new("a", "text", true, null, new string('x', 1001), null)]),
        new ShiftTicketLayout(new(0, 0, 0, 0), [new("a", "section", true, null, null, [new("r", true, new string('x', 101))])]),
        new ShiftTicketLayout(new(0, 0, 0, 0), [new("a", "section", true, null, null, [new("r", true, "x"), new("r", true, "y")])])
    };

    [Theory]
    [MemberData(nameof(InvalidLayouts))]
    public void RejectsLayoutsOutsideItsLimits(ShiftTicketLayout layout) => Assert.NotNull(ShiftTicketConfiguration.Validate(layout));

    [Fact]
    public async Task UpgradeAddsTheTableToAnExistingDatabaseAndCanRepeat()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        var options = new DbContextOptionsBuilder<RestaurantContext>().UseSqlite(connection).Options;
        await using var db = new RestaurantContext(options);
        ShiftTicketSchemaUpgrade.Apply(db);
        db.ShiftTicketSettings.Add(new ShiftTicketSetting { Configuration = "{}" });
        await db.SaveChangesAsync();
        ShiftTicketSchemaUpgrade.Apply(db);
        Assert.Equal("{}", (await db.ShiftTicketSettings.SingleAsync()).Configuration);
    }
}
