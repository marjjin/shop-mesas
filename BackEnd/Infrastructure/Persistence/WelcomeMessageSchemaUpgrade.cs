using Microsoft.EntityFrameworkCore;

namespace GestionMesas.Api;

internal sealed class WelcomeMessageSchemaUpgrade
{
    // Upgrade existing installations as well as newly created databases.
    public static void Apply(RestaurantContext db)
    {
        if (!db.Database.IsSqlite() && !db.Database.IsNpgsql()) return;
        var sqlite = db.Database.IsSqlite();
        db.Database.ExecuteSqlRaw(sqlite
            ? """CREATE TABLE IF NOT EXISTS "WelcomeMessageSettings" ("Id" INTEGER NOT NULL PRIMARY KEY, "Amount" TEXT NOT NULL DEFAULT '3000');"""
            : """CREATE TABLE IF NOT EXISTS "WelcomeMessageSettings" ("Id" integer PRIMARY KEY, "Amount" numeric(12,2) NOT NULL DEFAULT 3000);""");

        var existingColumns = new HashSet<string>();
        if (sqlite)
        {
            var connection = db.Database.GetDbConnection();
            var wasClosed = connection.State != System.Data.ConnectionState.Open;
            if (wasClosed) connection.Open();
            try
            {
                using var command = connection.CreateCommand();
                command.CommandText = """PRAGMA table_info("WelcomeMessageSettings");""";
                using var reader = command.ExecuteReader();
                while (reader.Read()) existingColumns.Add(reader.GetString(1));
            }
            finally { if (wasClosed) connection.Close(); }
        }

        foreach (var field in WelcomeMessageConfiguration.TextFields(new WelcomeMessageSetting()))
        {
            if (sqlite && existingColumns.Contains(field.Column)) continue;
            // Column names and default values come exclusively from the constants above.
            var optional = sqlite ? "" : "IF NOT EXISTS ";
            // ExecuteSqlRaw interprets braces as formatting placeholders.
            var defaultValue = field.Value.Replace("'", "''").Replace("{", "{{").Replace("}", "}}");
            var sql = $"ALTER TABLE \"WelcomeMessageSettings\" ADD COLUMN {optional}\"{field.Column}\" TEXT NOT NULL DEFAULT '{defaultValue}';";
            db.Database.ExecuteSqlRaw(sql);
        }
    }
}
