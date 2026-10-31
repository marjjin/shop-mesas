// Lectura y guardado de la configuración del ticket.
using Microsoft.EntityFrameworkCore;

namespace GestionMesas.Api;

public static class SettingsEndpoints
{
    public static RouteGroupBuilder MapSettingsEndpoints(this RouteGroupBuilder api)
    {
        api.MapGet("/settings/welcome-message", GetWelcomeMessageAsync);
        api.MapPut("/settings/welcome-message", UpdateWelcomeMessageAsync);
        api.MapGet("/settings/shift-ticket", GetShiftTicketAsync);
        api.MapPut("/settings/shift-ticket", UpdateShiftTicketAsync);
        return api;
    }

    private static async Task<IResult> GetShiftTicketAsync(RestaurantContext db, HttpResponse response)
    {
        response.Headers.CacheControl = "no-store";
        var setting = await db.ShiftTicketSettings.FindAsync(1);
        return Results.Ok(new ShiftTicketSettingResponse(ShiftTicketConfiguration.Deserialize(setting?.Configuration)));
    }

    private static async Task<IResult> UpdateShiftTicketAsync(ShiftTicketLayout layout, RestaurantContext db, HttpResponse response)
    {
        response.Headers.CacheControl = "no-store";
        var error = ShiftTicketConfiguration.Validate(layout);
        if (error is not null) return Results.BadRequest(new { detail = error });
        var setting = await db.ShiftTicketSettings.FindAsync(1);
        if (setting is null)
        {
            setting = new ShiftTicketSetting();
            db.ShiftTicketSettings.Add(setting);
        }
        setting.Configuration = ShiftTicketConfiguration.Serialize(layout);
        await db.SaveChangesAsync();
        return Results.Ok(new ShiftTicketSettingResponse(layout));
    }

    private static async Task<IResult> GetWelcomeMessageAsync(RestaurantContext db, HttpResponse response)
    {
        response.Headers.CacheControl = "no-store";
        var setting = await db.WelcomeMessageSettings.FindAsync(1);
        // Si todavía no hay fila, responde con los valores por defecto de la entidad.
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
