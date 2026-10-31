// Validaciones compartidas por inventario y cierres.
namespace GestionMesas.Api;

internal static class CigaretteRules
{
    public static void ValidateCashAmount(decimal? amount)
    {
        if (amount is < 0 or > 9999999999.99m || (amount.HasValue && decimal.Round(amount.Value, 2) != amount.Value))
            throw new CigaretteValidationException("El importe debe ser positivo o cero, con hasta dos decimales y menor a 10.000 millones.");
    }

    // Convierte el texto recibido al valor canónico guardado en la base.
    public static string NormalizePaymentMethod(string? method) => method?.Trim().ToLowerInvariant() switch
    {
        "cash" => "cash",
        "mercadoPago" or "mercadopago" => "mercadoPago",
        _ => throw new CigaretteValidationException("El medio de pago debe ser efectivo o Mercado Pago.")
    };

    // Los turnos se guardan como morning o afternoon.
    public static string NormalizeShift(string shift) => shift.Trim().ToLowerInvariant() switch
    {
        "morning" => "morning",
        "afternoon" => "afternoon",
        _ => throw new CigaretteValidationException("El turno debe ser morning o afternoon.")
    };
}
