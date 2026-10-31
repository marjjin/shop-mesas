// Se ejecuta al arrancar: sincroniza la cuenta administradora con las variables de entorno.
namespace GestionMesas.Api;

public static class AuthenticationBootstrap
{
    // Lanza una excepción, y frena el arranque, si la configuración de acceso es insegura o ambigua.
    public static void Initialize(RestaurantContext db, IConfiguration configuration)
    {
        // Authentication:AdminPassword se lee de la variable Authentication__AdminPassword.
        var adminPassword = configuration["Authentication:AdminPassword"];
        var adminUsername = configuration["Authentication:AdminUsername"]?.Trim();
        if (adminUsername is not null && (string.IsNullOrWhiteSpace(adminUsername) || adminUsername.Length > 100 || adminUsername.Any(char.IsControl)))
            throw new InvalidOperationException("Authentication__AdminUsername debe contener entre 1 y 100 caracteres, sin caracteres de control.");
        if (adminPassword is not null && (string.IsNullOrWhiteSpace(adminPassword) || adminPassword.Length > 1024
            || adminPassword.Equals("admin", StringComparison.OrdinalIgnoreCase)
            || adminPassword.Contains("CHANGE_ME", StringComparison.OrdinalIgnoreCase)))
            throw new InvalidOperationException("Authentication__AdminPassword no puede estar vacía, superar 1024 caracteres ni ser admin o un valor de ejemplo.");

        var users = db.Users.ToList();
        var administrator = FindAdministrator(users, configuration, adminUsername is not null || adminPassword is not null);
        if (administrator is not null)
        {
            if (adminUsername is not null && users.Any(user => user.Id != administrator.Id
                && string.Equals(user.Username, adminUsername, StringComparison.OrdinalIgnoreCase)))
                throw new InvalidOperationException("Ese nombre de usuario ya pertenece a otra cuenta. No se modificó el acceso.");

            // Sin contraseña configurada, se prohíbe seguir con la clave vacía o con admin/admin.
            if (adminPassword is null && (string.IsNullOrEmpty(administrator.Password) || administrator.Password == "admin"
                || UserPasswords.Verify(administrator, "admin") != Microsoft.AspNetCore.Identity.PasswordVerificationResult.Failed))
                throw new InvalidOperationException("Configurá Authentication__AdminPassword con una contraseña privada antes de iniciar. El acceso admin/admin ya no está permitido.");

            var credentialsChanged = false;
            // Solo reescribe el hash si la contraseña realmente cambió.
            if (adminPassword is not null && UserPasswords.Verify(administrator, adminPassword) == Microsoft.AspNetCore.Identity.PasswordVerificationResult.Failed)
            {
                administrator.Password = UserPasswords.Hash(administrator, adminPassword);
                credentialsChanged = true;
            }
            if (adminUsername is not null && administrator.Username != adminUsername)
            {
                administrator.Username = adminUsername;
                credentialsChanged = true;
            }
            // Cambiar credenciales invalida las sesiones abiertas de esa cuenta.
            if (credentialsChanged)
                db.UserSessions.RemoveRange(db.UserSessions.Where(session => session.UserId == administrator.Id));
        }

        // Migración: cualquier contraseña heredada en texto plano pasa a hash.
        foreach (var user in users)
        {
            if (!UserPasswords.IsHashed(user.Password))
                user.Password = UserPasswords.Hash(user, user.Password);
        }
        db.SaveChanges();
    }

    // Elige qué cuenta administrar. Si hay varias candidatas exige indicar el ID en lugar de adivinar.
    private static User? FindAdministrator(IReadOnlyList<User> users, IConfiguration configuration, bool changesRequested)
    {
        var configuredId = configuration["Authentication:AdminUserId"];
        if (configuredId is not null)
        {
            if (!int.TryParse(configuredId, out var id) || id <= 0)
                throw new InvalidOperationException("Authentication__AdminUserId debe ser un identificador de cuenta válido.");
            return users.SingleOrDefault(user => user.Id == id && user.Role == "Administrator")
                ?? throw new InvalidOperationException("Authentication__AdminUserId no identifica una cuenta administradora existente.");
        }

        var administrators = users.Where(user => user.Role == "Administrator").ToList();
        var originalAdmin = administrators.Where(user => user.Username == "admin").ToList();
        if (originalAdmin.Count == 1) return originalAdmin[0];
        if (administrators.Count == 1) return administrators[0];
        if (changesRequested)
            throw new InvalidOperationException("No se pudo identificar una única cuenta administradora. Configurá Authentication__AdminUserId para elegirla sin modificar otras cuentas.");
        return null;
    }
}
