namespace GestionMesas.Api;

public sealed record UpdateWelcomeMessageSettingRequest(decimal Amount, string? BusinessName = null,
    string? GreetingText = null, string? MessageText = null, string? ConditionsText = null,
    string? MinimumLabel = null, string? FooterText = null);
