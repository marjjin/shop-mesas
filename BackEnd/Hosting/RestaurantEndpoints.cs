namespace GestionMesas.Api;

public static class RestaurantEndpoints
{
    public static WebApplication MapRestaurantEndpoints(this WebApplication app)
    {
        var api = app.MapGroup("/api");
        api.MapCigaretteEndpoints();
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
        app.MapGet("/", () => Results.Ok(new { name = "Gestion Mesas API", status = "online" }));
        return app;
    }
}
