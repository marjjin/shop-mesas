using System.Globalization;
using Microsoft.AspNetCore.Http.Features;

namespace GestionMesas.Api;

public static class InvoiceEndpoints
{
    public static RouteGroupBuilder MapInvoiceEndpoints(this RouteGroupBuilder api)
    {
        var group = api.MapGroup("/invoices").WithTags("Facturas");
        group.MapGet("", async (string? search, int? supplierId, int? page, int? pageSize, InvoiceService service, CancellationToken ct) =>
        {
            try { return Results.Ok(await service.ListAsync(search, supplierId, page ?? 1, pageSize ?? 12, ct)); }
            catch (InvoiceValidationException ex) { return Invalid(ex.Message); }
        });
        group.MapGet("/suppliers", async (InvoiceService service, CancellationToken ct) => Results.Ok(await service.SuppliersAsync(ct)));
        group.MapPost("", UploadAsync);
        group.MapGet("/{id:int}/document", async (int id, IInvoiceFileStore files, CancellationToken ct) =>
        {
            try
            {
                var content = await files.ReadAsync(id, ct);
                return content is null ? Results.NotFound() : Results.File(content, "application/pdf", $"factura-{id}.pdf");
            }
            catch (InvoiceStorageException ex) { return Unavailable(ex.Message); }
        });
        group.MapPut("/{id:int}", async (int id, InvoiceMetadataRequest input, InvoiceService service, CancellationToken ct) =>
        {
            try { var result = await service.UpdateAsync(id, input, ct); return result is null ? Results.NotFound() : Results.Ok(result); }
            catch (InvoiceValidationException ex) { return Invalid(ex.Message); }
        });
        group.MapDelete("/{id:int}", async (int id, InvoiceService service, CancellationToken ct) =>
            await service.DeleteAsync(id, ct) ? Results.NoContent() : Results.NotFound());
        return group;
    }

    private static async Task<IResult> UploadAsync(HttpRequest request, InvoiceService service, CancellationToken ct)
    {
        const long maxBody = InvoiceService.MaxFileBytes + 65536;
        if (request.ContentLength > maxBody) return TooLarge();
        if (request.ContentType?.StartsWith("multipart/form-data", StringComparison.OrdinalIgnoreCase) != true)
            return Invalid("Enviá el documento escaneado junto con sus datos.");
        var limit = request.HttpContext.Features.Get<IHttpMaxRequestBodySizeFeature>();
        if (limit is { IsReadOnly: false }) limit.MaxRequestBodySize = maxBody;
        request.HttpContext.Features.Set<IFormFeature>(new FormFeature(request, new FormOptions
        {
            MultipartBodyLengthLimit = InvoiceService.MaxFileBytes,
            ValueLengthLimit = 2000,
            ValueCountLimit = 12,
            MultipartHeadersCountLimit = 16
        }));
        try
        {
            var form = await request.ReadFormAsync(ct);
            if (form.Files.Count != 1 || form.Files[0].Length > InvoiceService.MaxFileBytes) return Invalid("Adjuntá un PDF de hasta 8 MB.");
            var file = form.Files[0];
            if (!string.Equals(file.ContentType, "application/pdf", StringComparison.OrdinalIgnoreCase)) return Invalid("El escaneo debe estar en formato PDF.");
            if (!int.TryParse(form["supplierId"], out var supplierId)
                || !DateOnly.TryParseExact(form["issueDate"], "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var date)
                || !int.TryParse(form["pageCount"], out var pages)
                || !long.TryParse(form["originalBytes"], out var originalBytes)) return Invalid("Revisá los datos del documento.");
            using var buffer = new MemoryStream();
            await file.CopyToAsync(buffer, ct);
            var response = await service.CreateAsync(new(supplierId, date, form["reference"], form["note"]), buffer.ToArray(), pages, originalBytes, ct);
            return Results.Created($"/api/invoices/{response.Id}/document", response);
        }
        catch (InvoiceValidationException ex) { return Invalid(ex.Message); }
        catch (InvoiceStorageException ex) { return Unavailable(ex.Message); }
        catch (InvalidDataException) { return Invalid("El documento o sus datos superan los límites permitidos."); }
        catch (BadHttpRequestException ex) when (ex.StatusCode == StatusCodes.Status413PayloadTooLarge) { return TooLarge(); }
    }

    private static IResult Invalid(string message) => Results.Problem(message, statusCode: 400, title: "Revisá la factura");
    private static IResult TooLarge() => Results.Problem("El documento debe ocupar hasta 8 MB.", statusCode: 413);
    private static IResult Unavailable(string message) => Results.Problem(message, statusCode: 503, title: "Almacenamiento de facturas no disponible");
}
