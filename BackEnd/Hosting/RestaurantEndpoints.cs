namespace GestionMesas.Api;

public static class RestaurantEndpoints
{
    public static WebApplication MapRestaurantEndpoints(this WebApplication app)
    {
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
        app.MapGet("/", () => Results.Ok(new
        {
            name = "Gestion Mesas API",
            status = "online",
            commit = app.Configuration["RENDER_GIT_COMMIT"]
        })).AllowAnonymous();
        return app;
    }
}
