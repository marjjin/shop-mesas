using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using System.Security.Cryptography;
using Microsoft.AspNetCore.Identity;

namespace GestionMesas.Api;

public static class AuthenticationEndpoints
{
    public static RouteGroupBuilder MapAuthenticationEndpoints(this RouteGroupBuilder api)
    {
        api.MapPost("/login", LoginAsync).AllowAnonymous().RequireRateLimiting("login");
        api.MapGet("/session", (ClaimsPrincipal user) => Results.Ok(new { user = ToUser(user) }));
        api.MapPost("/logout", LogoutAsync);
        return api;
    }

    private static async Task<IResult> LoginAsync(LoginRequest request, RestaurantContext db, TimeProvider clock, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Username) || request.Username.Length > 100
            || string.IsNullOrEmpty(request.Password) || request.Password.Length > 1024)
            return Results.Unauthorized();
        var user = await db.Users.FirstOrDefaultAsync(item => item.Username == request.Username, cancellationToken);
        var verified = UserPasswords.Verify(user, request.Password);
        if (user is null || verified == PasswordVerificationResult.Failed) return Results.Unauthorized();
        if (verified == PasswordVerificationResult.SuccessRehashNeeded)
            user.Password = UserPasswords.Hash(user, request.Password);

        var now = clock.GetUtcNow().UtcDateTime;
        await db.UserSessions.Where(session => session.ExpiresAt <= now).ExecuteDeleteAsync(cancellationToken);
        var token = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
        var expiresAt = now.AddHours(12);
        db.UserSessions.Add(new UserSession
        {
            TokenHash = SessionAuthentication.Hash(token), UserId = user.Id,
            CredentialStamp = SessionAuthentication.Hash(user.Password), ExpiresAt = expiresAt
        });
        await db.SaveChangesAsync(cancellationToken);
        return Results.Ok(new { token, expiresAt, user = new { user.Id, user.Name, user.Username } });
    }

    private static async Task<IResult> LogoutAsync(ClaimsPrincipal user, RestaurantContext db, CancellationToken cancellationToken)
    {
        var hash = user.FindFirstValue(SessionAuthentication.SessionClaim);
        await db.UserSessions.Where(session => session.TokenHash == hash).ExecuteDeleteAsync(cancellationToken);
        return Results.NoContent();
    }

    private static object ToUser(ClaimsPrincipal user) => new
    {
        Id = int.Parse(user.FindFirstValue(ClaimTypes.NameIdentifier)!, System.Globalization.CultureInfo.InvariantCulture),
        Name = user.FindFirstValue(ClaimTypes.Name), Username = user.FindFirstValue("username")
    };
}
