// Punto único donde se registran las rutas de todos los módulos.
namespace GestionMesas.Api;

public static class RestaurantEndpoints
{
    public static WebApplication MapRestaurantEndpoints(this WebApplication app)
    {
        // Todo lo que cuelga de /api exige una sesión válida salvo que un endpoint declare AllowAnonymous.
        var api = app.MapGroup("/api").RequireAuthorization(SessionAuthentication.AccessPolicy);
        api.MapCigaretteEndpoints();
        api.MapInvoiceEndpoints();
        api.MapCafeteriaEndpoints();
        api.MapSupplierEndpoints();
        api.MapCashDropEndpoints();
        api.MapAuthenticationEndpoints();
        api.MapSettingsEndpoints();
        api.MapBootstrapEndpoints();
        api.MapHistoryEndpoints();
        api.MapTablesEndpoints();
        api.MapCatalogEndpoints();
        api.MapPendingOrdersEndpoints();
        api.MapOrdersEndpoints();
        // Health check público: Render lo usa para saber si el servicio responde, y commit indica la versión publicada.
        app.MapGet("/", () => Results.Ok(new
        {
            name = "Gestion Mesas API",
            status = "online",
            commit = app.Configuration["RENDER_GIT_COMMIT"]
        })).AllowAnonymous();
        return app;
    }
}
