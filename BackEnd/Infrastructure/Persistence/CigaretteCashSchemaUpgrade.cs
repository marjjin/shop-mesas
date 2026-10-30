using Microsoft.EntityFrameworkCore;

namespace GestionMesas.Api;

public static class CigaretteCashSchemaUpgrade
{
    public static void Apply(RestaurantContext db)
    {
        AddColumn(db, "CigarettePurchases", "TotalCost", "numeric(12,2) NULL", "TEXT NULL");
        AddColumn(db, "CigarettePurchases", "PaymentMethod", "text NOT NULL DEFAULT 'cash'", "TEXT NOT NULL DEFAULT 'cash'");
        AddColumn(db, "CigaretteShiftCloses", "CigaretteReservedCash", "numeric(12,2) NULL", "TEXT NULL");
        AddColumn(db, "CigaretteShiftCloses", "CigaretteReservedMercadoPago", "numeric(12,2) NULL", "TEXT NULL");
    }

    // Definitions belong to this upgrade and never contain request data.
#pragma warning disable EF1002 // Static identifiers/types only; DDL cannot parameterize SQL identifiers.
    private static void AddColumn(RestaurantContext db, string table, string column, string postgresType, string sqliteType)
    {
        if (db.Database.IsNpgsql())
        {
            db.Database.ExecuteSqlRaw($"ALTER TABLE \"{table}\" ADD COLUMN IF NOT EXISTS \"{column}\" {postgresType};");
            return;
        }
        if (!db.Database.IsSqlite()) return;
        var connection = db.Database.GetDbConnection();
        var wasClosed = connection.State != System.Data.ConnectionState.Open;
        if (wasClosed) connection.Open();
        var exists = false;
        try
        {
            using var command = connection.CreateCommand();
            command.CommandText = $"PRAGMA table_info(\"{table}\");";
            using var reader = command.ExecuteReader();
            while (reader.Read()) exists |= reader.GetString(1) == column;
        }
        finally { if (wasClosed) connection.Close(); }
        if (!exists)
            db.Database.ExecuteSqlRaw($"ALTER TABLE \"{table}\" ADD COLUMN \"{column}\" {sqliteType};");
    }
#pragma warning restore EF1002
}
