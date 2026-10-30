using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using GestionMesas.Api;
using Xunit;
using Microsoft.Extensions.DependencyInjection;

namespace GestionMesas.Api.Tests;

public sealed class InvoiceEndpointTests
{
    [Fact]
    public async Task AuthenticatedScanUploadListReadReassignAndDeletePreserveTheHttpContract()
    {
        await using var host = await ApiTestHost.StartAsync(configureServices: services => services.AddScoped<IInvoiceFileStore, DatabaseInvoiceFileStore>());
        var client = host.Client;
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/invoices")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/invoices/1/document")).StatusCode);
        await host.SignInAsync();
        var supplierResponse = await client.PostAsJsonAsync("/api/suppliers", new CreateSupplierRequest("Proveedor factura"));
        var supplier = (await supplierResponse.Content.ReadFromJsonAsync<SupplierResponse>())!;
        using var form = Upload(supplier.Id);
        var response = await client.PostAsync("/api/invoices", form);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var invoice = (await response.Content.ReadFromJsonAsync<InvoiceResponse>())!;
        Assert.Equal(supplier.Id, invoice.SupplierId);
        var archive = await client.GetFromJsonAsync<InvoiceListResponse>("/api/invoices?search=Prueba&page=1&pageSize=12");
        Assert.Single(archive!.Items);
        Assert.Equal(1, archive.Summary.Count);
        var pdf = await client.GetAsync($"/api/invoices/{invoice.Id}/document");
        Assert.Equal("application/pdf", pdf.Content.Headers.ContentType!.MediaType);
        Assert.Equal("attachment", pdf.Content.Headers.ContentDisposition!.DispositionType);
        Assert.True(pdf.Headers.CacheControl?.NoStore);
        Assert.Equal(InvoiceServiceTests.Pdf, await pdf.Content.ReadAsByteArrayAsync());
        var correction = await client.PutAsJsonAsync($"/api/invoices/{invoice.Id}", new InvoiceMetadataRequest(supplier.Id, new(2026, 10, 29), "Corregida"));
        Assert.Equal(HttpStatusCode.OK, correction.StatusCode);
        Assert.Equal("Corregida", (await correction.Content.ReadFromJsonAsync<InvoiceResponse>())!.Reference);
        Assert.Equal(HttpStatusCode.NoContent, (await client.DeleteAsync($"/api/invoices/{invoice.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync($"/api/invoices/{invoice.Id}/document")).StatusCode);
    }

    [Fact]
    public async Task UploadsRejectWrongContentTypeInvalidFieldsAndExcessiveBodies()
    {
        await using var host = await ApiTestHost.StartAsync(); await host.SignInAsync();
        Assert.Equal(HttpStatusCode.BadRequest, (await host.Client.PostAsJsonAsync("/api/invoices", new { })).StatusCode);
        using var invalid = Upload(9999);
        Assert.Equal(HttpStatusCode.BadRequest, (await host.Client.PostAsync("/api/invoices", invalid)).StatusCode);
        using var oversized = new ByteArrayContent(new byte[InvoiceService.MaxFileBytes + 65537]);
        oversized.Headers.ContentType = new("multipart/form-data");
        Assert.Equal(HttpStatusCode.RequestEntityTooLarge, (await host.Client.PostAsync("/api/invoices", oversized)).StatusCode);
    }

    private static MultipartFormDataContent Upload(int supplierId)
    {
        var form = new MultipartFormDataContent();
        var file = new ByteArrayContent(InvoiceServiceTests.Pdf); file.Headers.ContentType = new MediaTypeHeaderValue("application/pdf");
        form.Add(file, "document", "factura.pdf");
        foreach (var field in new Dictionary<string, string> { ["supplierId"] = supplierId.ToString(), ["issueDate"] = "2026-10-30", ["pageCount"] = "1", ["originalBytes"] = "100000", ["reference"] = "Prueba" })
            form.Add(new StringContent(field.Value), field.Key);
        return form;
    }
}
