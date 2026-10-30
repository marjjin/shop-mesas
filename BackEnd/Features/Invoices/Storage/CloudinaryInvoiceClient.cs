using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace GestionMesas.Api;

public sealed record CloudinaryInvoiceAsset(string AssetId, string PublicId);

public sealed class CloudinaryInvoiceClient(HttpClient http, CloudinaryInvoiceOptions options, TimeProvider clock)
{
    public async Task<CloudinaryInvoiceAsset> UploadAsync(string publicId, byte[] pdf, CancellationToken ct)
    {
        options.RequireConfigured();
        var fields = Signed(new() { ["public_id"] = publicId, ["type"] = "private", ["overwrite"] = "false" });
        using var body = new MultipartFormDataContent();
        foreach (var field in fields) body.Add(new StringContent(field.Value), field.Key);
        using var file = new ByteArrayContent(pdf);
        file.Headers.ContentType = new MediaTypeHeaderValue("application/pdf");
        body.Add(file, "file", "factura.pdf");
        using var response = await SendAsync("raw/upload", body, ct);
        return await DecodeAsync(response, root =>
        {
            if (root.GetProperty("public_id").GetString() != publicId || root.GetProperty("resource_type").GetString() != "raw"
                || root.GetProperty("type").GetString() != "private" || root.GetProperty("bytes").GetInt32() != pdf.Length
                || string.IsNullOrWhiteSpace(root.GetProperty("asset_id").GetString()))
                throw new InvoiceStorageException("Cloudinary no confirmó el guardado privado del documento.");
            return new CloudinaryInvoiceAsset(root.GetProperty("asset_id").GetString()!, publicId);
        }, ct);
    }

    public async Task<byte[]> ReadAsync(string cloudName, string assetId, CancellationToken ct)
    {
        options.RequireConfigured(cloudName);
        using var body = new FormUrlEncodedContent(Signed(new() { ["asset_id"] = assetId }));
        using var response = await SendAsync("asset/download", body, ct);
        if (response.Content.Headers.ContentLength > InvoiceService.MaxFileBytes) throw new InvoiceStorageException("El documento supera el tamaño permitido.");
        await using var stream = await response.Content.ReadAsStreamAsync(ct);
        using var buffer = new MemoryStream();
        var chunk = new byte[81920];
        int read;
        while ((read = await stream.ReadAsync(chunk, ct)) != 0)
        {
            if (buffer.Length + read > InvoiceService.MaxFileBytes) throw new InvoiceStorageException("El documento supera el tamaño permitido.");
            buffer.Write(chunk, 0, read);
        }
        var bytes = buffer.ToArray();
        if (bytes.Length < 5 || !bytes.AsSpan(0, 5).SequenceEqual("%PDF-"u8)) throw new InvoiceStorageException("Cloudinary no devolvió un PDF válido.");
        return bytes;
    }

    public async Task DeleteAsync(string cloudName, string publicId, CancellationToken ct)
    {
        options.RequireConfigured(cloudName);
        using var body = new FormUrlEncodedContent(Signed(new() { ["public_id"] = publicId, ["type"] = "private", ["invalidate"] = "true" }));
        using var response = await SendAsync("raw/destroy", body, ct);
        var status = await DecodeAsync(response, root => root.GetProperty("result").GetString(), ct);
        if (status is not ("ok" or "not found")) throw new InvoiceStorageException("No se pudo confirmar la eliminación del documento en Cloudinary.");
    }

    private static async Task<T> DecodeAsync<T>(HttpResponseMessage response, Func<JsonElement, T> read, CancellationToken ct)
    {
        try
        {
            using var result = await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync(ct), cancellationToken: ct);
            return read(result.RootElement);
        }
        catch (Exception ex) when (ex is JsonException or KeyNotFoundException or InvalidOperationException or FormatException)
        { throw new InvoiceStorageException("Cloudinary devolvió una respuesta incompleta. Intentá nuevamente.", ex); }
    }

    private Dictionary<string, string> Signed(Dictionary<string, string> fields)
    {
        fields["timestamp"] = clock.GetUtcNow().ToUnixTimeSeconds().ToString(System.Globalization.CultureInfo.InvariantCulture);
        var payload = string.Join('&', fields.OrderBy(x => x.Key, StringComparer.Ordinal).Select(x => $"{x.Key}={x.Value}")) + options.ApiSecret;
        fields["signature"] = Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(payload)));
        fields["api_key"] = options.ApiKey;
        return fields;
    }

    private async Task<HttpResponseMessage> SendAsync(string path, HttpContent body, CancellationToken ct)
    {
        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Post, $"https://api.cloudinary.com/v1_1/{options.CloudName}/{path}") { Content = body };
            var response = await http.SendAsync(request, HttpCompletionOption.ResponseContentRead, ct);
            if (response.IsSuccessStatusCode) return response;
            response.Dispose();
            throw new InvoiceStorageException("Cloudinary no pudo completar la operación. Revisá sus credenciales y permisos o intentá nuevamente.");
        }
        catch (HttpRequestException ex) { throw new InvoiceStorageException("No se pudo conectar con Cloudinary. Intentá nuevamente.", ex); }
        catch (OperationCanceledException ex) when (!ct.IsCancellationRequested) { throw new InvoiceStorageException("Cloudinary tardó demasiado en responder. Intentá nuevamente.", ex); }
    }
}
