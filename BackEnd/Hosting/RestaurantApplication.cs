using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authorization;
using System.Threading.RateLimiting;

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
        if (allowedOrigins.Length == 0 && (builder.Environment.IsDevelopment() || builder.Environment.IsEnvironment("Testing")))
            allowedOrigins = ["http://localhost:5173", "http://localhost:4173", "http://127.0.0.1:5173", "http://127.0.0.1:4173"];
        if (allowedOrigins.Length == 0 || allowedOrigins.Any(origin => origin.Contains('*') || !Uri.TryCreate(origin, UriKind.Absolute, out var uri)
            || uri.Scheme is not ("https" or "http") || uri.AbsolutePath != "/" || uri.Query != "" || uri.Fragment != "" || uri.UserInfo != ""))
            throw new InvalidOperationException("Configurá Cors__AllowedOrigins__0 con el origen exacto del frontend, sin rutas ni comodines.");
        builder.Services.AddCors(options => options.AddPolicy(FrontendCorsPolicy, policy =>
        {
            policy.WithOrigins(allowedOrigins);
            policy.AllowAnyHeader().WithMethods("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS");
        }));
        builder.Services.AddSingleton(TimeProvider.System);
        builder.Services.AddAuthentication(SessionAuthentication.SchemeName)
            .AddScheme<AuthenticationSchemeOptions, SessionAuthentication>(SessionAuthentication.SchemeName, _ => { });
        builder.Services.AddAuthorization(options =>
        {
            var access = new AuthorizationPolicyBuilder(SessionAuthentication.SchemeName)
                .RequireAuthenticatedUser().RequireRole("Administrator").Build();
            options.AddPolicy(SessionAuthentication.AccessPolicy, access);
            options.DefaultPolicy = access;
            options.FallbackPolicy = access;
        });
        builder.Services.AddRateLimiter(options =>
        {
            options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
            options.AddPolicy("login", context => RateLimitPartition.GetFixedWindowLimiter(
                context.Connection.RemoteIpAddress?.ToString() ?? "unknown", _ => new FixedWindowRateLimiterOptions
                {
                    PermitLimit = 10, Window = TimeSpan.FromMinutes(1), QueueLimit = 0, AutoReplenishment = true
                }));
        });
        builder.Services.AddHostedService<CoworkingBillingService>();
        builder.Services.AddScoped<ICigaretteService, CigaretteService>();
        builder.Services.AddScoped<ICafeteriaService, CafeteriaService>();
        builder.Services.AddScoped<ISupplierService, SupplierService>();
        builder.Services.AddScoped<ICashDropService, CashDropService>();

        return builder;
    }

    public static WebApplication InitializeRestaurant(this WebApplication app)
    {
        app.UseRouting();
        app.Use(async (context, next) =>
        {
            if (context.Request.Path.StartsWithSegments("/api"))
            {
                context.Response.Headers.CacheControl = "no-store";
                context.Response.Headers.XContentTypeOptions = "nosniff";
            }
            await next(context);
        });
        app.UseCors(FrontendCorsPolicy);
        app.UseRateLimiter();
        app.UseAuthentication();
        app.UseAuthorization();
        using var scope = app.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<RestaurantContext>();
        DatabaseInitializer.Initialize(db);
        AuthenticationBootstrap.Initialize(db, app.Configuration);
        return app;
    }
}
