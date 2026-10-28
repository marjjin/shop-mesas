namespace GestionMesas.Api;

public class User
{
    public int Id { get; set; }
    public string Username { get; set; } = "";
    public string Password { get; set; } = "";
    public string Name { get; set; } = "";
    public string Role { get; set; } = "Administrator";
}

public sealed class UserSession
{
    public string TokenHash { get; set; } = "";
    public int UserId { get; set; }
    public User User { get; set; } = null!;
    public string CredentialStamp { get; set; } = "";
    public DateTime ExpiresAt { get; set; }
}
