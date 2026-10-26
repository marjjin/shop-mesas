using Microsoft.EntityFrameworkCore;

namespace GestionMesas.Api;

public static class RestaurantApplication
{
    public const string FrontendCorsPolicy = "Frontend";

    public static WebApplicationBuilder AddRestaurantServices(this WebApplicationBuilder builder)
    {
        if (int.TryParse(Environment.GetEnvironmentVariable("PORT"), out var renderPort) && renderPort > 0 && renderPort <= 65535)
            builder.WebHost.UseUrls($"http://0.0.0.0:{renderPort}");
        var configuredConnectionString = builder.Configuration.GetConnectionString("Restaurant")
            ?? "Data Source=gestion-mesas.db";
        builder.Services.AddDbContext<RestaurantContext>(options =>
        {
            if (DatabaseConnection.IsPostgreSqlConnectionString(configuredConnectionString))
                options.UseNpgsql(DatabaseConnection.ToNpgsqlConnectionString(configuredConnectionString));
            else
                options.UseSqlite(configuredConnectionString);
        });
        var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()?
            .Where(origin => !string.IsNullOrWhiteSpace(origin)).Select(origin => origin.Trim().TrimEnd('/')).ToArray() ?? [];
        builder.Services.AddCors(options => options.AddPolicy(FrontendCorsPolicy, policy =>
        {
            // Without an origin list, support local clients and deployed frontend domains.
            if (allowedOrigins.Length == 0) policy.AllowAnyOrigin();
            else policy.WithOrigins(allowedOrigins);
            policy.AllowAnyHeader().WithMethods("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS");
        }));
        builder.Services.AddHostedService<CoworkingBillingService>();
        builder.Services.AddScoped<ICigaretteService, CigaretteService>();
        builder.Services.AddScoped<ICafeteriaService, CafeteriaService>();
        builder.Services.AddScoped<ISupplierService, SupplierService>();
        builder.Services.AddScoped<ICashDropService, CashDropService>();

        return builder;
    }

    public static WebApplication InitializeRestaurant(this WebApplication app)
    {
        app.UseCors(FrontendCorsPolicy);
        using var scope = app.Services.CreateScope();
        DatabaseInitializer.Initialize(scope.ServiceProvider.GetRequiredService<RestaurantContext>());
        return app;
    }
}
