using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Xunit;

namespace GestionMesas.Api.Tests;

public sealed class ApiContractTests
{
    [Fact]
    public async Task LoginBootstrapAndWelcomeSettingsKeepTheirHttpContract()
    {
        await using var host = await ApiTestHost.StartAsync();
        var http = host.Client;
        Assert.Equal("online", (await GetJson(http, "/" )).GetProperty("status").GetString());
        Assert.Equal(HttpStatusCode.Unauthorized, (await http.PostAsJsonAsync("/api/login", new { username = "admin", password = "wrong" })).StatusCode);
        var login = await SendJson(http, HttpMethod.Post, "/api/login", new { username = "admin", password = "admin" }, HttpStatusCode.OK);
        Assert.Equal("demo-admin-token", login.GetProperty("token").GetString());
        Assert.Equal("Administrador", login.GetProperty("user").GetProperty("name").GetString());
        var bootstrap = await GetJson(http, "/api/bootstrap");
        foreach (var field in new[] { "tables", "products", "categories", "orders", "pendingOrders", "pendingOrderItems" })
            Assert.Equal(JsonValueKind.Array, bootstrap.GetProperty(field).ValueKind);

        var initial = await http.GetAsync("/api/settings/welcome-message");
        Assert.Equal(HttpStatusCode.OK, initial.StatusCode);
        Assert.True(initial.Headers.CacheControl?.NoStore);
        var updated = await SendJson(http, HttpMethod.Put, "/api/settings/welcome-message", new
        {
            amount = 4500.50m, businessName = "Mi café", greetingText = "Hola {nombre}", messageText = "",
            conditionsText = "Primera línea\n\nSegunda línea", minimumLabel = "Consumo", footerText = ""
        }, HttpStatusCode.OK);
        Assert.Equal("Hola {nombre}", updated.GetProperty("greetingText").GetString());
        await SendJson(http, HttpMethod.Put, "/api/settings/welcome-message", new { amount = 5000 }, HttpStatusCode.OK);
        var reloaded = await GetJson(http, "/api/settings/welcome-message");
        Assert.Equal(5000, reloaded.GetProperty("amount").GetDecimal());
        Assert.Equal("Mi café", reloaded.GetProperty("businessName").GetString());
        Assert.Equal("Primera línea\n\nSegunda línea", reloaded.GetProperty("conditionsText").GetString());
        var invalid = await SendJson(http, HttpMethod.Put, "/api/settings/welcome-message", new { amount = -1 }, HttpStatusCode.BadRequest);
        Assert.False(string.IsNullOrWhiteSpace(invalid.GetProperty("detail").GetString()));
        Assert.Equal(5000, (await GetJson(http, "/api/settings/welcome-message")).GetProperty("amount").GetDecimal());
    }

    [Fact]
    public async Task PendingOrdersAndTableClosurePreserveConsumptionAndHistory()
    {
        await using var host = await ApiTestHost.StartAsync();
        var http = host.Client;
        var product = await SendJson(http, HttpMethod.Post, "/api/products", new { name = "Artículo de prueba" }, HttpStatusCode.Created);
        var productId = product.GetProperty("id").GetInt32();
        var table = await SendJson(http, HttpMethod.Post, "/api/tables", new { name = "Mesa prueba", seats = 2 }, HttpStatusCode.Created);
        var tableId = table.GetProperty("id").GetInt32();
        var pending = await SendJson(http, HttpMethod.Post, "/api/pending-orders", new { customerName = "Ana" }, HttpStatusCode.Created);
        var pendingId = pending.GetProperty("id").GetInt32();
        await SendJson(http, HttpMethod.Post, $"/api/pending-orders/{pendingId}/items", new { productId, quantity = 2 }, HttpStatusCode.OK);
        var assignment = await SendJson(http, HttpMethod.Post, $"/api/pending-orders/{pendingId}/assign", new { tableId }, HttpStatusCode.OK);
        Assert.Equal("Ana", assignment.GetProperty("table").GetProperty("customerName").GetString());
        Assert.Equal("occupied", assignment.GetProperty("table").GetProperty("status").GetString());
        await SendJson(http, HttpMethod.Patch, $"/api/tables/{tableId}", new { openedAt = DateTimeOffset.UtcNow.AddHours(-1) }, HttpStatusCode.OK);
        var consumption = await SendJson(http, HttpMethod.Post, "/api/orders", new { tableId, productId, quantity = 1 }, HttpStatusCode.Created);
        var orderId = consumption.GetProperty("order").GetProperty("id").GetInt32();
        await SendJson(http, HttpMethod.Patch, $"/api/orders/{orderId}", new { createdAt = DateTimeOffset.UtcNow.AddMinutes(-30) }, HttpStatusCode.OK);
        Assert.Equal(HttpStatusCode.NoContent, (await http.DeleteAsync($"/api/orders/{orderId}")).StatusCode);
        var close = await SendJson(http, HttpMethod.Post, $"/api/tables/{tableId}/close", null, HttpStatusCode.OK);
        Assert.Equal("free", close.GetProperty("table").GetProperty("status").GetString());
        Assert.Equal(JsonValueKind.Null, close.GetProperty("table").GetProperty("customerName").ValueKind);
        var receiptItem = Assert.Single(close.GetProperty("history").GetProperty("items").EnumerateArray());
        Assert.Equal("Artículo de prueba", receiptItem.GetProperty("productName").GetString());
        Assert.Equal(2, receiptItem.GetProperty("quantity").GetInt32());
        var history = Assert.Single((await GetJson(http, "/api/history")).EnumerateArray());
        Assert.Equal(close.GetProperty("historyId").GetInt32(), history.GetProperty("id").GetInt32());
        Assert.Equal(HttpStatusCode.BadRequest, (await http.PostAsync($"/api/tables/{tableId}/close", null)).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await http.DeleteAsync($"/api/products/{productId}")).StatusCode);
        Assert.Equal("Artículo de prueba", (await GetJson(http, "/api/history"))[0].GetProperty("items")[0].GetProperty("productName").GetString());
        Assert.Equal(HttpStatusCode.NoContent, (await http.DeleteAsync($"/api/tables/{tableId}")).StatusCode);
    }

    [Fact]
    public async Task ShiftClosesIncludeCafeteriaCashDropsAndSupplierAllocations()
    {
        await using var host = await ApiTestHost.StartAsync();
        var http = host.Client;
        const string date = "2026-10-23";
        var cigarette = await SendJson(http, HttpMethod.Post, "/api/cigarettes/products", new { name = "Cigarrillo prueba", price = 100, initialStock = 10 }, HttpStatusCode.Created);
        var cigaretteId = cigarette.GetProperty("id").GetInt32();
        await SendJson(http, HttpMethod.Post, "/api/cafeteria/products", new { name = "Café prueba", price = 1000 }, HttpStatusCode.Created);
        await SendJson(http, HttpMethod.Post, $"/api/cafeteria/sales?date={date}", null, HttpStatusCode.Created);
        var supplier = await SendJson(http, HttpMethod.Post, "/api/suppliers", new { name = "Proveedor prueba" }, HttpStatusCode.Created);
        var supplierId = supplier.GetProperty("id").GetInt32();
        await SendJson(http, HttpMethod.Post, "/api/cash-drops", new { amount = 50, businessDate = date, shift = "morning" }, HttpStatusCode.Created);
        var close = await SendJson(http, HttpMethod.Post, "/api/cigarettes/closes", new
        {
            businessDate = date, shift = "morning", items = new[] { new { cigaretteProductId = cigaretteId, finalStock = 8 } },
            supplierAllocations = new[] { new { supplierId, cashAmount = 100, mercadoPagoAmount = 50 } },
            endingCashBalance = 200, endingMercadoPagoBalance = 300, nextShiftChangeCash = 20, receivedChangeCash = 10, posnetTotal = 40
        }, HttpStatusCode.Created);
        Assert.Equal(2, close.GetProperty("totalSold").GetInt32());
        Assert.Equal(200, close.GetProperty("totalSales").GetDecimal());
        Assert.Equal(1000, close.GetProperty("cafeteria").GetProperty("totalSales").GetDecimal());
        Assert.Equal(50, close.GetProperty("cashDropsTotal").GetDecimal());
        Assert.True(Assert.Single(close.GetProperty("cashDrops").EnumerateArray()).GetProperty("isClosed").GetBoolean());
        Assert.Equal(150, Assert.Single(close.GetProperty("supplierAllocations").EnumerateArray()).GetProperty("amount").GetDecimal());
        var suppliers = await GetJson(http, "/api/suppliers");
        Assert.Equal(150, Assert.Single(suppliers.EnumerateArray()).GetProperty("reservedBalance").GetDecimal());
        Assert.Single((await GetJson(http, $"/api/cigarettes/closes?from={date}&to={date}")).EnumerateArray());
        Assert.Equal(8, Assert.Single((await GetJson(http, $"/api/cigarettes?date={date}")).GetProperty("products").EnumerateArray()).GetProperty("stock").GetInt32());
        Assert.Equal(HttpStatusCode.OK, (await http.GetAsync($"/api/cafeteria/dashboard?date={date}")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await http.GetAsync($"/api/cafeteria/history?date={date}")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await http.GetAsync($"/api/cash-drops/open?date={date}")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await http.GetAsync($"/api/cash-drops?date={date}&shift=morning")).StatusCode);
    }

    [Theory]
    [InlineData(null, "http://localhost:5173", "*")]
    [InlineData(null, "https://mesas.vercel.app", "*")]
    [InlineData(" https://mesas.vercel.app/ ", "https://mesas.vercel.app", "https://mesas.vercel.app")]
    [InlineData("https://mesas.vercel.app", "https://otro.example", null)]
    public async Task CorsPreservesLocalAndDeployedOrigins(string? configured, string origin, string? expected)
    {
        await using var host = await ApiTestHost.StartAsync(configured);
        using var request = new HttpRequestMessage(HttpMethod.Options, "/api/settings/welcome-message");
        request.Headers.Add("Origin", origin);
        request.Headers.Add("Access-Control-Request-Method", "PUT");
        request.Headers.Add("Access-Control-Request-Headers", "content-type");
        using var response = await host.Client.SendAsync(request);
        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        var hasOrigin = response.Headers.TryGetValues("Access-Control-Allow-Origin", out var origins);
        if (expected is null) Assert.False(hasOrigin);
        else
        {
            Assert.Equal(expected, Assert.Single(origins!));
            Assert.Contains("PUT", string.Join(',', response.Headers.GetValues("Access-Control-Allow-Methods")));
        }
    }

    private static async Task<JsonElement> GetJson(HttpClient http, string path)
    {
        using var response = await http.GetAsync(path);
        response.EnsureSuccessStatusCode();
        return await response.Content.ReadFromJsonAsync<JsonElement>();
    }

    private static async Task<JsonElement> SendJson(HttpClient http, HttpMethod method, string path, object? body, HttpStatusCode expected)
    {
        using var request = new HttpRequestMessage(method, path) { Content = body is null ? null : JsonContent.Create(body) };
        using var response = await http.SendAsync(request);
        Assert.True(response.StatusCode == expected, $"{method} {path}: expected {expected}, got {response.StatusCode}. {await response.Content.ReadAsStringAsync()}");
        return await response.Content.ReadFromJsonAsync<JsonElement>();
    }
}
