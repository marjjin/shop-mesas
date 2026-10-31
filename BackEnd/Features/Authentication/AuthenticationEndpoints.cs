// Rutas de ingreso, consulta de sesión y salida.
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using System.Security.Cryptography;
using Microsoft.AspNetCore.Identity;

namespace GestionMesas.Api;

public static class AuthenticationEndpoints
{
    public static RouteGroupBuilder MapAuthenticationEndpoints(this RouteGroupBuilder api)
    {
        // Única ruta de negocio pública, con límite de intentos.
        api.MapPost("/login", LoginAsync).AllowAnonymous().RequireRateLimiting("login");
        api.MapGet("/session", (ClaimsPrincipal user) => Results.Ok(new { user = ToUser(user) }));
        api.MapPost("/logout", LogoutAsync);
        return api;
    }

    // Valida las credenciales y crea una sesión de 12 horas.
    private static async Task<IResult> LoginAsync(LoginRequest request, RestaurantContext db, TimeProvider clock, CancellationToken cancellationToken)
    {
        // Responde siempre 401 sin aclarar qué dato falló, para no revelar si el usuario existe.
        if (string.IsNullOrWhiteSpace(request.Username) || request.Username.Length > 100
            || string.IsNullOrEmpty(request.Password) || request.Password.Length > 1024)
            return Results.Unauthorized();
        var user = await db.Users.FirstOrDefaultAsync(item => item.Username == request.Username, cancellationToken);
        // Verify recibe user aunque sea null: así el tiempo de respuesta no delata usuarios inexistentes.
        var verified = UserPasswords.Verify(user, request.Password);
        if (user is null || verified == PasswordVerificationResult.Failed) return Results.Unauthorized();
        // Si cambió la configuración de hash, se actualiza aprovechando que ahora se conoce la contraseña.
        if (verified == PasswordVerificationResult.SuccessRehashNeeded)
            user.Password = UserPasswords.Hash(user, request.Password);

        var now = clock.GetUtcNow().UtcDateTime;
        // Limpieza oportunista de sesiones vencidas.
        await db.UserSessions.Where(session => session.ExpiresAt <= now).ExecuteDeleteAsync(cancellationToken);
        // Token aleatorio de 32 bytes, escrito como 64 caracteres hexadecimales.
        var token = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
        var expiresAt = now.AddHours(12);
        // Se guarda el hash del token. Si se filtra la base, las sesiones no se pueden usar.
        db.UserSessions.Add(new UserSession
        {
            TokenHash = SessionAuthentication.Hash(token), UserId = user.Id,
            // CredentialStamp liga la sesión a la contraseña actual: si esta cambia, la sesión deja de valer.
            CredentialStamp = SessionAuthentication.Hash(user.Password), ExpiresAt = expiresAt
        });
        await db.SaveChangesAsync(cancellationToken);
        return Results.Ok(new { token, expiresAt, user = new { user.Id, user.Name, user.Username } });
    }

    // Borra solo la sesión actual; las de otros dispositivos siguen activas.
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
