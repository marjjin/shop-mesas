namespace GestionMesas.Api;

public static class WelcomeMessageConfiguration
{
    public static void EnsureSchema(RestaurantContext db) => WelcomeMessageSchemaUpgrade.Apply(db);

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

    internal static (string Column, string Value, string Label, int MaxLength, bool Required)[] TextFields(WelcomeMessageSetting setting) =>
    [
        ("BusinessName", setting.BusinessName, "nombre del local", 100, true),
        ("GreetingText", setting.GreetingText, "saludo", 300, true),
        ("MessageText", setting.MessageText, "mensaje del pedido", 500, false),
        ("ConditionsText", setting.ConditionsText, "condiciones de la mesa", 1500, false),
        ("MinimumLabel", setting.MinimumLabel, "texto del importe", 100, true),
        ("FooterText", setting.FooterText, "despedida", 300, false)
    ];
}
