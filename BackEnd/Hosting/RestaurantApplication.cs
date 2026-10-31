// Configuración central de la API: qué servicios existen y por qué etapas pasa cada pedido HTTP.
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authorization;
using System.Threading.RateLimiting;

namespace GestionMesas.Api;

public static class RestaurantApplication
{
    public const string FrontendCorsPolicy = "Frontend";

    // Registra los servicios en el contenedor de inyección de dependencias.
    // Después, cualquier endpoint puede recibirlos como parámetro sin crearlos a mano.
    public static WebApplicationBuilder AddRestaurantServices(this WebApplicationBuilder builder)
    {
        // Render indica el puerto en la variable PORT; en local se usa el valor de --urls.
        if (int.TryParse(Environment.GetEnvironmentVariable("PORT"), out var renderPort) && renderPort > 0 && renderPort <= 65535)
            builder.WebHost.UseUrls($"http://0.0.0.0:{renderPort}");
        // Sin cadena de conexión configurada se usa un archivo SQLite local.
        var configuredConnectionString = builder.Configuration.GetConnectionString("Restaurant")
            ?? "Data Source=gestion-mesas.db";
        // El tipo de cadena decide el motor: PostgreSQL en producción o SQLite en desarrollo y pruebas.
        builder.Services.AddDbContext<RestaurantContext>(options =>
        {
            if (DatabaseConnection.IsPostgreSqlConnectionString(configuredConnectionString))
                options.UseNpgsql(DatabaseConnection.ToNpgsqlConnectionString(configuredConnectionString));
            else
                options.UseSqlite(configuredConnectionString);
        });
        // Orígenes web autorizados a llamar a la API desde el navegador (CORS).
        var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()?
            .Where(origin => !string.IsNullOrWhiteSpace(origin)).Select(origin => origin.Trim().TrimEnd('/')).ToArray() ?? [];
        // En desarrollo y pruebas se aceptan los puertos de Vite aunque no haya configuración.
        if (allowedOrigins.Length == 0 && (builder.Environment.IsDevelopment() || builder.Environment.IsEnvironment("Testing")))
            allowedOrigins = ["http://localhost:5173", "http://localhost:4173", "http://127.0.0.1:5173", "http://127.0.0.1:4173"];
        // Falla al arrancar si la lista queda vacía o contiene comodines, rutas o credenciales.
        if (allowedOrigins.Length == 0 || allowedOrigins.Any(origin => origin.Contains('*') || !Uri.TryCreate(origin, UriKind.Absolute, out var uri)
            || uri.Scheme is not ("https" or "http") || uri.AbsolutePath != "/" || uri.Query != "" || uri.Fragment != "" || uri.UserInfo != ""))
            throw new InvalidOperationException("Configurá Cors__AllowedOrigins__0 con el origen exacto del frontend, sin rutas ni comodines.");
        builder.Services.AddCors(options => options.AddPolicy(FrontendCorsPolicy, policy =>
        {
            policy.WithOrigins(allowedOrigins);
            policy.AllowAnyHeader().WithMethods("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS");
        }));
        // Reloj inyectable: permite que las pruebas controlen la hora actual.
        builder.Services.AddSingleton(TimeProvider.System);
        // Autenticación propia por token: ver SessionAuthentication.
        builder.Services.AddAuthentication(SessionAuthentication.SchemeName)
            .AddScheme<AuthenticationSchemeOptions, SessionAuthentication>(SessionAuthentication.SchemeName, _ => { });
        // Autorización: exige sesión válida y rol Administrator.
        builder.Services.AddAuthorization(options =>
        {
            var access = new AuthorizationPolicyBuilder(SessionAuthentication.SchemeName)
                .RequireAuthenticatedUser().RequireRole("Administrator").Build();
            options.AddPolicy(SessionAuthentication.AccessPolicy, access);
            // DefaultPolicy se aplica a RequireAuthorization() sin nombre de política.
            options.DefaultPolicy = access;
            // FallbackPolicy protege cualquier ruta nueva aunque nadie recuerde marcarla.
            options.FallbackPolicy = access;
        });
        // Limita el login a 10 intentos por minuto por IP para frenar ataques de fuerza bruta.
        builder.Services.AddRateLimiter(options =>
        {
            options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
            options.AddPolicy("login", context => RateLimitPartition.GetFixedWindowLimiter(
                context.Connection.RemoteIpAddress?.ToString() ?? "unknown", _ => new FixedWindowRateLimiterOptions
                {
                    PermitLimit = 10, Window = TimeSpan.FromMinutes(1), QueueLimit = 0, AutoReplenishment = true
                }));
        });
        // Hosted service: tarea que corre en segundo plano durante toda la vida del servidor.
        builder.Services.AddHostedService<CoworkingBillingService>();
        // AddScoped crea una instancia nueva por cada pedido HTTP.
        // Por eso cada servicio usa su propio RestaurantContext, que no se comparte entre pedidos.
        builder.Services.AddScoped<ICigaretteService, CigaretteService>();
        builder.Services.AddScoped<CigaretteCashService>();
        // AddSingleton crea una sola instancia para toda la aplicación.
        builder.Services.AddSingleton(CloudinaryInvoiceOptions.FromConfiguration(builder.Configuration));
        // Cliente HTTP para hablar con Cloudinary, con límites de tiempo y de tamaño de respuesta.
        builder.Services.AddHttpClient<CloudinaryInvoiceClient>(client =>
        {
            client.Timeout = TimeSpan.FromSeconds(60);
            client.MaxResponseContentBufferSize = InvoiceService.MaxFileBytes;
        })
            // Sin redirecciones automáticas y sin logs: las solicitudes firmadas no deben quedar registradas.
            .ConfigurePrimaryHttpMessageHandler(() => new HttpClientHandler { AllowAutoRedirect = false })
            .RemoveAllLoggers();
        builder.Services.AddScoped<CloudinaryInvoiceFileStore>();
        // Cuando alguien pide IInvoiceFileStore recibe la implementación de Cloudinary.
        builder.Services.AddScoped<IInvoiceFileStore>(provider => provider.GetRequiredService<CloudinaryInvoiceFileStore>());
        builder.Services.AddScoped<InvoiceStorageMaintenance>();
        builder.Services.AddHostedService<InvoiceStorageWorker>();
        builder.Services.AddScoped<InvoiceService>();
        builder.Services.AddScoped<ICafeteriaService, CafeteriaService>();
        builder.Services.AddScoped<ISupplierService, SupplierService>();
        builder.Services.AddScoped<ICashDropService, CashDropService>();

        return builder;
    }

    // Define el pipeline HTTP y prepara la base de datos antes de aceptar pedidos.
    public static WebApplication InitializeRestaurant(this WebApplication app)
    {
        // El orden importa: cada etapa recibe el pedido, actúa y lo pasa a la siguiente.
        app.UseRouting();
        // Middleware propio: las respuestas de la API nunca se guardan en caché.
        app.Use(async (context, next) =>
        {
            if (context.Request.Path.StartsWithSegments("/api"))
            {
                context.Response.Headers.CacheControl = "no-store";
                context.Response.Headers.XContentTypeOptions = "nosniff";
            }
            await next(context);
        });
        // CORS va antes de autenticar para que el navegador reciba sus cabeceras incluso ante un 401.
        app.UseCors(FrontendCorsPolicy);
        app.UseRateLimiter();
        app.UseAuthentication();
        app.UseAuthorization();
        // Los servicios Scoped necesitan un scope; acá no hay pedido HTTP, así que se crea uno manual.
        using var scope = app.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<RestaurantContext>();
        // Crea o actualiza las tablas.
        DatabaseInitializer.Initialize(db);
        // Aplica la contraseña configurada y migra contraseñas heredadas.
        AuthenticationBootstrap.Initialize(db, app.Configuration);
        return app;
    }
}
