using System.Text.RegularExpressions;

namespace GestionMesas.Api;

public sealed class CloudinaryInvoiceOptions
{
    public string CloudName { get; init; } = "";
    public string ApiKey { get; init; } = "";
    public string ApiSecret { get; init; } = "";
    public string Folder { get; init; } = "shop-family/facturas";
    public bool IsConfigured => Regex.IsMatch(CloudName, "^[a-zA-Z0-9_-]{1,100}$")
        && !string.IsNullOrWhiteSpace(ApiKey) && !string.IsNullOrWhiteSpace(ApiSecret)
        && !ApiSecret.Contains("CHANGE_ME", StringComparison.OrdinalIgnoreCase)
        && Folder.Length <= 150 && Regex.IsMatch(Folder, "^[a-zA-Z0-9_-]+(/[a-zA-Z0-9_-]+)*$");

    public static CloudinaryInvoiceOptions FromConfiguration(IConfiguration config)
    {
        var name = config["Cloudinary:CloudName"] ?? "";
        var key = config["Cloudinary:ApiKey"] ?? "";
        var secret = config["Cloudinary:ApiSecret"] ?? "";
        var folder = config["Cloudinary:InvoiceFolder"] ?? "shop-family/facturas";
        if (string.IsNullOrEmpty(name) && string.IsNullOrEmpty(key) && string.IsNullOrEmpty(secret)
            && Uri.TryCreate(config["CLOUDINARY_URL"], UriKind.Absolute, out var url) && url.Scheme == "cloudinary")
        {
            var parts = url.UserInfo.Split(':', 2);
            if (parts.Length == 2) { name = url.Host; key = Uri.UnescapeDataString(parts[0]); secret = Uri.UnescapeDataString(parts[1]); }
        }
        return new() { CloudName = name, ApiKey = key, ApiSecret = secret, Folder = folder };
    }

    public void RequireConfigured(string? cloudName = null)
    {
        if (!IsConfigured) throw new InvoiceStorageException("Falta configurar Cloudinary en el servidor para guardar o consultar estos documentos.");
        if (cloudName is not null && cloudName != CloudName)
            throw new InvoiceStorageException("El documento pertenece a otra cuenta de Cloudinary. Revisá la configuración del servidor.");
    }
}

public sealed class InvoiceStorageException(string message, Exception? inner = null) : Exception(message, inner);
