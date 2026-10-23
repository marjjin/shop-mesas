using Microsoft.EntityFrameworkCore;

namespace GestionMesas.Api;

public static class WelcomeMessageConfiguration
{
    private static readonly WelcomeMessageSetting Defaults = new();

    // Upgrade existing installations as well as newly created databases.
    public static void EnsureSchema(RestaurantContext db)
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

        foreach (var field in TextFields(Defaults))
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

    public static WelcomeMessageSetting Merge(UpdateWelcomeMessageSettingRequest request, WelcomeMessageSetting? current)
    {
        current ??= new();
        return new()
        {
            Amount = request.Amount,
            BusinessName = (request.BusinessName ?? current.BusinessName).Trim(),
            GreetingText = (request.GreetingText ?? current.GreetingText).Trim(),
            MessageText = (request.MessageText ?? current.MessageText).Trim(),
            ConditionsText = (request.ConditionsText ?? current.ConditionsText).Trim(),
            MinimumLabel = (request.MinimumLabel ?? current.MinimumLabel).Trim(),
            FooterText = (request.FooterText ?? current.FooterText).Trim()
        };
    }

    public static string? Validate(WelcomeMessageSetting setting)
    {
        if (setting.Amount < 0 || setting.Amount > 999999999.99m || decimal.Round(setting.Amount, 2) != setting.Amount)
            return "Ingresá un importe entre $0 y $999.999.999,99 con hasta dos decimales.";
        foreach (var field in TextFields(setting))
        {
            if (field.Required && string.IsNullOrWhiteSpace(field.Value)) return $"Completá el campo {field.Label}.";
            if (field.Value.Length > field.MaxLength) return $"El campo {field.Label} admite hasta {field.MaxLength} caracteres.";
        }
        return null;
    }

    private static (string Column, string Value, string Label, int MaxLength, bool Required)[] TextFields(WelcomeMessageSetting setting) =>
    [
        ("BusinessName", setting.BusinessName, "nombre del local", 100, true),
        ("GreetingText", setting.GreetingText, "saludo", 300, true),
        ("MessageText", setting.MessageText, "mensaje del pedido", 500, false),
        ("ConditionsText", setting.ConditionsText, "condiciones de la mesa", 1500, false),
        ("MinimumLabel", setting.MinimumLabel, "texto del importe", 100, true),
        ("FooterText", setting.FooterText, "despedida", 300, false)
    ];
}
