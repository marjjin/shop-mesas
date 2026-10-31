// Tablas de usuarios y sesiones.
namespace GestionMesas.Api;

public class User
{
    public int Id { get; set; }
    public string Username { get; set; } = "";
    // Nunca es texto plano: contiene un hash con prefijo identity:.
    public string Password { get; set; } = "";
    public string Name { get; set; } = "";
    public string Role { get; set; } = "Administrator";
}

public sealed class UserSession
{
    // Hash SHA-256 del token, no el token.
    public string TokenHash { get; set; } = "";
    public int UserId { get; set; }
    public User User { get; set; } = null!;
    // Hash de la contraseña vigente al iniciar la sesión.
    public string CredentialStamp { get; set; } = "";
    public DateTime ExpiresAt { get; set; }
}
