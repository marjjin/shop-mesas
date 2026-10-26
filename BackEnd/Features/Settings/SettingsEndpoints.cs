using Microsoft.EntityFrameworkCore;

namespace GestionMesas.Api;

public static class SettingsEndpoints
{
    public static RouteGroupBuilder MapSettingsEndpoints(this RouteGroupBuilder api)
    {
        api.MapGet("/settings/welcome-message", GetWelcomeMessageAsync);
        api.MapPut("/settings/welcome-message", UpdateWelcomeMessageAsync);
        return api;
    }

    private static async Task<IResult> GetWelcomeMessageAsync(RestaurantContext db, HttpResponse response)
    {
        response.Headers.CacheControl = "no-store";
        var setting = await db.WelcomeMessageSettings.FindAsync(1);
        return Results.Ok(setting ?? new WelcomeMessageSetting());
    }

    private static async Task<IResult> UpdateWelcomeMessageAsync(UpdateWelcomeMessageSettingRequest request, RestaurantContext db, HttpResponse response)
    {
        response.Headers.CacheControl = "no-store";
        var current = await db.WelcomeMessageSettings.FindAsync(1);
        var setting = WelcomeMessageConfiguration.Merge(request, current);
        var error = WelcomeMessageConfiguration.Validate(setting);
        if (error is not null) return Results.BadRequest(new { detail = error });
        if (current is null) db.WelcomeMessageSettings.Add(setting);
        else db.Entry(current).CurrentValues.SetValues(setting);
        await db.SaveChangesAsync();
        return Results.Ok(setting);
    }
}
