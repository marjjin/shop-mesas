using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Options;

namespace GestionMesas.Api;

public static class UserPasswords
{
    private const string Prefix = "identity:";
    private static readonly PasswordHasher<User> Hasher = new(Options.Create(new PasswordHasherOptions { IterationCount = 210_000 }));
    private static readonly User DummyUser = new();
    private static readonly string DummyHash = Hash(DummyUser, Guid.NewGuid().ToString());

    public static bool IsHashed(string password) => password.StartsWith(Prefix, StringComparison.Ordinal);

    public static string Hash(User user, string password) => Prefix + Hasher.HashPassword(user, password);

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
