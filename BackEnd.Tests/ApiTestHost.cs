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

namespace GestionMesas.Api.Tests;

// Uses the production composition and routes with its own in-memory database and ephemeral port.
internal sealed class ApiTestHost(WebApplication app, SqliteConnection connection, HttpClient client) : IAsyncDisposable
{
    public HttpClient Client { get; } = client;

    public static async Task<ApiTestHost> StartAsync(string? allowedOrigin = null)
    {
        var connectionString = $"Data Source=api-tests-{Guid.NewGuid():N};Mode=Memory;Cache=Shared";
        var connection = new SqliteConnection(connectionString);
        await connection.OpenAsync();
        var builder = WebApplication.CreateBuilder(new WebApplicationOptions
        {
            EnvironmentName = "Testing",
            ContentRootPath = AppContext.BaseDirectory
        });
        builder.Configuration.AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["ConnectionStrings:Restaurant"] = connectionString,
            ["Cors:AllowedOrigins:0"] = allowedOrigin
        });
        builder.Logging.ClearProviders();
        builder.WebHost.ConfigureKestrel(server => server.Listen(IPAddress.Loopback, 0));
        builder.AddRestaurantServices();
        var worker = builder.Services.Single(service => service.ImplementationType == typeof(CoworkingBillingService));
        builder.Services.Remove(worker); // Billing has dedicated clock-controlled tests.
        var app = builder.Build();
        try
        {
            app.InitializeRestaurant();
            app.MapRestaurantEndpoints();
            await app.StartAsync();
            var addresses = app.Services.GetRequiredService<IServer>().Features.Get<IServerAddressesFeature>()!;
            return new ApiTestHost(app, connection, new HttpClient { BaseAddress = new Uri(addresses.Addresses.Single()) });
        }
        catch
        {
            await app.DisposeAsync();
            await connection.DisposeAsync();
            throw;
        }
    }

    public async ValueTask DisposeAsync()
    {
        Client.Dispose();
        await app.StopAsync();
        await app.DisposeAsync();
        await connection.DisposeAsync();
    }
}
