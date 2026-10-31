// Interpreta la cadena de conexión configurada para decidir el motor y normalizar su formato.
namespace GestionMesas.Api;

public static class DatabaseConnection
{
    // Reconoce tanto el formato URL (postgres://...) como el clásico (Host=...).
    public static bool IsPostgreSqlConnectionString(string connectionString) =>
        connectionString.StartsWith("postgres://", StringComparison.OrdinalIgnoreCase)
        || connectionString.StartsWith("postgresql://", StringComparison.OrdinalIgnoreCase)
        || connectionString.Contains("Host=", StringComparison.OrdinalIgnoreCase)
        || connectionString.Contains("Server=", StringComparison.OrdinalIgnoreCase);

    // Render entrega una URL; Npgsql espera el formato clave=valor. Esta función convierte una en la otra.
    public static string ToNpgsqlConnectionString(string configuredConnectionString)
    {
        if (!Uri.TryCreate(configuredConnectionString, UriKind.Absolute, out var databaseUrl)
            || databaseUrl.Scheme is not ("postgres" or "postgresql"))
        {
            return configuredConnectionString;
        }

        // UserInfo llega como usuario:contraseña, y ambos pueden estar codificados para URL.
        var credentials = databaseUrl.UserInfo.Split(':', 2);
        var connectionString = new Npgsql.NpgsqlConnectionStringBuilder
        {
            Host = databaseUrl.Host,
            Port = databaseUrl.IsDefaultPort ? 5432 : databaseUrl.Port,
            Database = databaseUrl.AbsolutePath.Trim('/'),
            Username = Uri.UnescapeDataString(credentials[0]),
            Password = credentials.Length > 1 ? Uri.UnescapeDataString(credentials[1]) : string.Empty
        };

        // De los parámetros de la URL solo interesa sslmode.
        foreach (var parameter in databaseUrl.Query.TrimStart('?').Split('&', StringSplitOptions.RemoveEmptyEntries))
        {
            var parts = parameter.Split('=', 2);
            if (parts.Length == 2 && string.Equals(parts[0], "sslmode", StringComparison.OrdinalIgnoreCase))
            {
                connectionString.SslMode = Enum.Parse<Npgsql.SslMode>(Uri.UnescapeDataString(parts[1]), ignoreCase: true);
            }
        }

        return connectionString.ConnectionString;
    }


}
