using Npgsql;

namespace GestionMesas.Api.Tests;

// Opt-in only. Every test owns a newly generated database on a loopback-only test server.
internal sealed class PostgresTestDatabase(string adminConnectionString, string databaseName, string connectionString) : IAsyncDisposable
{
    public const string EnvironmentVariable = "SHOP_MESAS_TEST_POSTGRES";
    public string ConnectionString { get; } = connectionString;

    public static async Task<PostgresTestDatabase> CreateAsync(string configuredConnectionString)
    {
        var admin = new NpgsqlConnectionStringBuilder(configuredConnectionString);
        if (admin.Host is not ("127.0.0.1" or "localhost" or "::1") || admin.Database != "postgres")
            throw new InvalidOperationException("Las pruebas PostgreSQL solo permiten un servidor local y la base de control postgres. No uses una conexión de producción.");
        admin.Pooling = false;
        admin.IncludeErrorDetail = false;
        var databaseName = "shop_security_" + Guid.NewGuid().ToString("N");
        await using var connection = new NpgsqlConnection(admin.ConnectionString);
        await connection.OpenAsync();
        await using var command = new NpgsqlCommand($"CREATE DATABASE \"{databaseName}\"", connection);
        await command.ExecuteNonQueryAsync();
        var database = new NpgsqlConnectionStringBuilder(admin.ConnectionString) { Database = databaseName, Pooling = true };
        return new PostgresTestDatabase(admin.ConnectionString, databaseName, database.ConnectionString);
    }

    public async ValueTask DisposeAsync()
    {
        using (var pooledConnection = new NpgsqlConnection(ConnectionString)) NpgsqlConnection.ClearPool(pooledConnection);
        await using var connection = new NpgsqlConnection(adminConnectionString);
        await connection.OpenAsync();
        // databaseName is generated above, never supplied by environment/configuration.
        await using var command = new NpgsqlCommand($"DROP DATABASE IF EXISTS \"{databaseName}\" WITH (FORCE)", connection);
        await command.ExecuteNonQueryAsync();
    }
}

internal sealed class PostgresFactAttribute : Xunit.FactAttribute
{
    public PostgresFactAttribute()
    {
        if (string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable(PostgresTestDatabase.EnvironmentVariable)))
            Skip = "Requiere PostgreSQL local aislado mediante SHOP_MESAS_TEST_POSTGRES.";
    }
}
