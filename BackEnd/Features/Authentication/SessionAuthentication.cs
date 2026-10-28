using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Authentication;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace GestionMesas.Api;

public sealed class SessionAuthentication(
    IOptionsMonitor<AuthenticationSchemeOptions> options,
    ILoggerFactory logger,
    UrlEncoder encoder,
    RestaurantContext db,
    TimeProvider clock) : AuthenticationHandler<AuthenticationSchemeOptions>(options, logger, encoder)
{
    public const string SchemeName = "RestaurantSession";
    public const string AccessPolicy = "RestaurantAccess";
    public const string SessionClaim = "session_hash";

    public static string Hash(string value) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value)));

    protected override async Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        var authorization = Request.Headers.Authorization.ToString();
        if (string.IsNullOrEmpty(authorization)) return AuthenticateResult.NoResult();
        if (!authorization.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
            return AuthenticateResult.Fail("Invalid authorization scheme.");
        var token = authorization[7..];
        if (token.Length != 64 || token.Any(character => !Uri.IsHexDigit(character)))
            return AuthenticateResult.Fail("Invalid session.");

        var hash = Hash(token);
        var session = await db.UserSessions.AsNoTracking().Include(item => item.User)
            .SingleOrDefaultAsync(item => item.TokenHash == hash, Context.RequestAborted);
        if (session is null || session.ExpiresAt <= clock.GetUtcNow().UtcDateTime
            || session.CredentialStamp != Hash(session.User.Password))
            return AuthenticateResult.Fail("Invalid or expired session.");

        var identity = new ClaimsIdentity(new[]
        {
            new Claim(ClaimTypes.NameIdentifier, session.UserId.ToString(System.Globalization.CultureInfo.InvariantCulture)),
            new Claim(ClaimTypes.Name, session.User.Name),
            new Claim(ClaimTypes.Role, session.User.Role),
            new Claim("username", session.User.Username),
            new Claim(SessionClaim, hash)
        }, SchemeName);
        return AuthenticateResult.Success(new AuthenticationTicket(new ClaimsPrincipal(identity), SchemeName));
    }
}
