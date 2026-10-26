namespace GestionMesas.Api;

public static class DatabaseConnection
{
    public static bool IsPostgreSqlConnectionString(string connectionString) =>
        connectionString.StartsWith("postgres://", StringComparison.OrdinalIgnoreCase)
        || connectionString.StartsWith("postgresql://", StringComparison.OrdinalIgnoreCase)
        || connectionString.Contains("Host=", StringComparison.OrdinalIgnoreCase)
        || connectionString.Contains("Server=", StringComparison.OrdinalIgnoreCase);

    public static string ToNpgsqlConnectionString(string configuredConnectionString)
    {
        if (!Uri.TryCreate(configuredConnectionString, UriKind.Absolute, out var databaseUrl)
            || databaseUrl.Scheme is not ("postgres" or "postgresql"))
        {
            return configuredConnectionString;
        }

        var credentials = databaseUrl.UserInfo.Split(':', 2);
        var connectionString = new Npgsql.NpgsqlConnectionStringBuilder
        {
            Host = databaseUrl.Host,
            Port = databaseUrl.IsDefaultPort ? 5432 : databaseUrl.Port,
            Database = databaseUrl.AbsolutePath.Trim('/'),
            Username = Uri.UnescapeDataString(credentials[0]),
            Password = credentials.Length > 1 ? Uri.UnescapeDataString(credentials[1]) : string.Empty
        };

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
