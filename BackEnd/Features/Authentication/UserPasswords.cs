// Hash y verificación de contraseñas con el PasswordHasher de ASP.NET Core Identity.
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Options;

namespace GestionMesas.Api;

public static class UserPasswords
{
    private const string Prefix = "identity:";
    // 210.000 iteraciones hacen costoso probar contraseñas por fuerza bruta.
    private static readonly PasswordHasher<User> Hasher = new(Options.Create(new PasswordHasherOptions { IterationCount = 210_000 }));
    // Hash de relleno usado cuando el usuario no existe.
    private static readonly User DummyUser = new();
    private static readonly string DummyHash = Hash(DummyUser, Guid.NewGuid().ToString());

    public static bool IsHashed(string password) => password.StartsWith(Prefix, StringComparison.Ordinal);

    public static string Hash(User user, string password) => Prefix + Hasher.HashPassword(user, password);

    // Hace el mismo trabajo exista o no el usuario: evita filtrar información por el tiempo de respuesta.
    public static PasswordVerificationResult Verify(User? user, string password)
    {
        if (user is null || !IsHashed(user.Password))
        {
            Hasher.VerifyHashedPassword(DummyUser, DummyHash[Prefix.Length..], password);
            return PasswordVerificationResult.Failed;
        }
        try { return Hasher.VerifyHashedPassword(user, user.Password[Prefix.Length..], password); }
        catch (FormatException) { return PasswordVerificationResult.Failed; }
    }
}
