using Microsoft.EntityFrameworkCore;

namespace GestionMesas.Api;

public static class AuthenticationEndpoints
{
    public static RouteGroupBuilder MapAuthenticationEndpoints(this RouteGroupBuilder api)
    {
        api.MapPost("/login", LoginAsync);
        return api;
    }

    private static async Task<IResult> LoginAsync(LoginRequest request, RestaurantContext db)
    {
        var user = await db.Users.FirstOrDefaultAsync(item => item.Username == request.Username && item.Password == request.Password);
        return user is null ? Results.Unauthorized() : Results.Ok(new { token = "demo-admin-token", user = new { user.Id, user.Name, user.Username } });
    }
}
