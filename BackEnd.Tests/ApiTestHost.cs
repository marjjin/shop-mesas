using System.Net;
using GestionMesas.Api;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Hosting.Server;
using Microsoft.AspNetCore.Hosting.Server.Features;
using Microsoft.Data.Sqlite;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using System.Net.Http.Json;
using System.Net.Http.Headers;
using System.Text.Json;
using Microsoft.AspNetCore.Routing;
using Microsoft.AspNetCore.Http;

namespace GestionMesas.Api.Tests;

// Uses production routes with an isolated SQLite or opt-in local PostgreSQL database and ephemeral port.
internal sealed class ApiTestHost(WebApplication app, IAsyncDisposable database, HttpClient client) : IAsyncDisposable
{
    public HttpClient Client { get; } = client;
    public const string AdminPassword = "Fictitious test password 2026!";
    public IServiceProvider Services => app.Services;
    public IReadOnlyList<Endpoint> Endpoints => app.Services.GetRequiredService<EndpointDataSource>().Endpoints;

    public static async Task<ApiTestHost> StartAsync(string? allowedOrigin = null, TimeProvider? clock = null, string environment = "Testing", string adminPassword = AdminPassword, string? adminUsername = null, Func<RestaurantContext, Task>? prepareDatabase = null, Action<IServiceCollection>? configureServices = null)
    {
        string connectionString;
        IAsyncDisposable database;
        var postgres = Environment.GetEnvironmentVariable(PostgresTestDatabase.EnvironmentVariable);
        if (string.IsNullOrWhiteSpace(postgres))
        {
            connectionString = $"Data Source=api-tests-{Guid.NewGuid():N};Mode=Memory;Cache=Shared";
            var connection = new SqliteConnection(connectionString);
            await connection.OpenAsync();
            database = connection;
        }
        else
        {
            var postgresDatabase = await PostgresTestDatabase.CreateAsync(postgres);
            database = postgresDatabase;
            connectionString = postgresDatabase.ConnectionString;
        }
        var builder = WebApplication.CreateBuilder(new WebApplicationOptions
        {
            EnvironmentName = environment,
            ContentRootPath = AppContext.BaseDirectory
        });
        builder.Configuration.AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["ConnectionStrings:Restaurant"] = connectionString,
            ["Cors:AllowedOrigins:0"] = allowedOrigin ?? "http://localhost:5173",
            ["Authentication:AdminPassword"] = adminPassword,
            ["Authentication:AdminUsername"] = adminUsername,
            ["Authentication:AdminUserId"] = null,
            ["Cloudinary:CloudName"] = "", ["Cloudinary:ApiKey"] = "", ["Cloudinary:ApiSecret"] = "", ["CLOUDINARY_URL"] = ""
        });
        builder.Logging.ClearProviders();
        builder.WebHost.ConfigureKestrel(server => server.Listen(IPAddress.Loopback, 0));
        builder.AddRestaurantServices();
        configureServices?.Invoke(builder.Services);
        if (clock is not null) builder.Services.AddSingleton(clock);
        var worker = builder.Services.Single(service => service.ImplementationType == typeof(CoworkingBillingService));
        builder.Services.Remove(worker); // Billing has dedicated clock-controlled tests.
        builder.Services.Remove(builder.Services.Single(service => service.ImplementationType == typeof(InvoiceStorageWorker)));
        var app = builder.Build();
        try
        {
            if (prepareDatabase is not null)
            {
                await using var scope = app.Services.CreateAsyncScope();
                await prepareDatabase(scope.ServiceProvider.GetRequiredService<RestaurantContext>());
            }
            app.InitializeRestaurant();
            app.MapRestaurantEndpoints();
            // This intentionally omits RequireAuthorization to verify the global fallback policy.
            app.MapGet("/future-route", () => "must require a session");
            await app.StartAsync();
            var addresses = app.Services.GetRequiredService<IServer>().Features.Get<IServerAddressesFeature>()!;
            return new ApiTestHost(app, database, new HttpClient { BaseAddress = new Uri(addresses.Addresses.Single()) });
        }
        catch
        {
            await app.DisposeAsync();
            await database.DisposeAsync();
            throw;
        }
    }

    public async Task<string> SignInAsync(string username = "admin", string password = AdminPassword)
    {
        using var response = await Client.PostAsJsonAsync("/api/login", new { username, password });
        response.EnsureSuccessStatusCode();
        var login = await response.Content.ReadFromJsonAsync<JsonElement>();
        var token = login.GetProperty("token").GetString()!;
        Client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return token;
    }

    public async ValueTask DisposeAsync()
    {
        Client.Dispose();
        await app.StopAsync();
        await app.DisposeAsync();
        await database.DisposeAsync();
    }
}
