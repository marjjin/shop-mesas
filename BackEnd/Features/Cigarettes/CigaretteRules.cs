namespace GestionMesas.Api;

internal static class CigaretteRules
{
    public static string NormalizeShift(string shift) => shift.Trim().ToLowerInvariant() switch
    {
        "morning" => "morning",
        "afternoon" => "afternoon",
        _ => throw new CigaretteValidationException("El turno debe ser morning o afternoon.")
    };
}
