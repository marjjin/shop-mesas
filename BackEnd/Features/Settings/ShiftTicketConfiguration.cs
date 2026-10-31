using System.Text.Json;
using System.Text.RegularExpressions;

namespace GestionMesas.Api;

// Diseño del ticket de cierre de turno: orden, visibilidad, textos y márgenes.
// Los importes nunca se guardan acá: siempre salen del cierre.
public class ShiftTicketSetting
{
    public int Id { get; set; } = 1;
    // El diseño se guarda como JSON porque su estructura es jerárquica: bloques con renglones.
    public string Configuration { get; set; } = "";
}

public sealed record ShiftTicketRow(string Id, bool Visible, string? Label);
public sealed record ShiftTicketBlock(string Id, string Type, bool Visible, string? Title, string? Text, IReadOnlyList<ShiftTicketRow>? Rows);
public sealed record ShiftTicketMargins(decimal Top, decimal Right, decimal Bottom, decimal Left);
public sealed record ShiftTicketLayout(ShiftTicketMargins? Margins, IReadOnlyList<ShiftTicketBlock>? Blocks);
// Layout null significa que todavía no se personalizó, y el frontend usa el diseño por defecto.
public sealed record ShiftTicketSettingResponse(ShiftTicketLayout? Layout);

public static class ShiftTicketConfiguration
{
    private const int MaxBlocks = 40;
    private const int MaxRows = 30;
    private const decimal MaxMargin = 20;
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    public static string Serialize(ShiftTicketLayout layout) => JsonSerializer.Serialize(layout, Json);

    public static ShiftTicketLayout? Deserialize(string? configuration) =>
        string.IsNullOrWhiteSpace(configuration) ? null : JsonSerializer.Deserialize<ShiftTicketLayout>(configuration, Json);

    // Devuelve el mensaje de error, o null si el diseño es válido.
    public static string? Validate(ShiftTicketLayout? layout)
    {
        if (layout?.Margins is null || layout.Blocks is null) return "El diseño del ticket está incompleto.";
        var margins = layout.Margins;
        if (new[] { margins.Top, margins.Right, margins.Bottom, margins.Left }.Any(value => value < 0 || value > MaxMargin || decimal.Round(value, 1) != value))
            return "Los márgenes deben estar entre 0 y 20 mm, con hasta un decimal.";
        // El papel mide 80 mm: debe quedar lugar para imprimir.
        if (margins.Left + margins.Right > 40) return "Los márgenes izquierdo y derecho no pueden sumar más de 40 mm.";
        if (layout.Blocks.Count is 0 or > MaxBlocks) return $"El ticket admite entre 1 y {MaxBlocks} bloques.";
        if (layout.Blocks.Select(block => block.Id).Distinct().Count() != layout.Blocks.Count) return "Hay bloques repetidos en el ticket.";

        foreach (var block in layout.Blocks)
        {
            if (!IsValidId(block.Id) || block.Type is not ("section" or "text" or "signature")) return "El ticket contiene un bloque desconocido.";
            if (block.Title?.Length > 100) return "Los títulos admiten hasta 100 caracteres.";
            if (block.Text?.Length > 1000) return "Los textos libres admiten hasta 1000 caracteres.";
            var rows = block.Rows ?? [];
            if (rows.Count > MaxRows || rows.Select(row => row.Id).Distinct().Count() != rows.Count || rows.Any(row => !IsValidId(row.Id)))
                return "El ticket contiene renglones inválidos.";
            if (rows.Any(row => row.Label?.Length > 100)) return "Las etiquetas admiten hasta 100 caracteres.";
        }
        return null;
    }

    private static bool IsValidId(string? id) => id is not null && Regex.IsMatch(id, "^[a-zA-Z0-9_-]{1,40}$");
}
