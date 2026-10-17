namespace GestionMesas.Api;

public static class SupplierEndpoints
{
    public static RouteGroupBuilder MapSupplierEndpoints(this RouteGroupBuilder api)
    {
        var group = api.MapGroup("/suppliers").WithTags("Proveedores");
        group.MapGet("", async (ISupplierService service, CancellationToken ct) => Results.Ok(await service.GetAllAsync(ct)));
        group.MapPost("", CreateAsync);
        group.MapPut("/{id:int}", UpdateAsync);
        group.MapPatch("/{id:int}/balances", UpdateBalancesAsync);
        group.MapDelete("/{id:int}", DeleteAsync);
        group.MapPost("/transfers", TransferReservedFundsAsync);
        group.MapPost("/{id:int}/exchanges", ExchangeReservedFundsAsync);
        group.MapPost("/{id:int}/purchases", PurchaseAsync);
        group.MapPost("/{id:int}/payments", PaymentAsync);
        group.MapPatch("/{id:int}/transactions/{transactionId:int}", UpdateTransactionAsync);
        group.MapDelete("/{id:int}/transactions/{transactionId:int}", DeleteTransactionAsync);
        return group;
    }

    private static async Task<IResult> CreateAsync(CreateSupplierRequest request, ISupplierService service, CancellationToken ct)
    {
        try { var supplier = await service.CreateAsync(request, ct); return Results.Created($"/api/suppliers/{supplier.Id}", supplier); }
        catch (SupplierValidationException exception) { return Invalid(exception.Message); }
    }
    private static async Task<IResult> UpdateAsync(int id, UpdateSupplierRequest request, ISupplierService service, CancellationToken ct)
    {
        try { var supplier = await service.UpdateAsync(id, request, ct); return supplier is null ? Results.NotFound() : Results.Ok(supplier); }
        catch (SupplierValidationException exception) { return Invalid(exception.Message); }
    }
    private static async Task<IResult> UpdateBalancesAsync(int id, UpdateSupplierBalancesRequest request, ISupplierService service, CancellationToken ct)
    {
        try { var supplier = await service.UpdateBalancesAsync(id, request, ct); return supplier is null ? Results.NotFound() : Results.Ok(supplier); }
        catch (SupplierValidationException exception) { return Invalid(exception.Message); }
    }
    private static async Task<IResult> DeleteAsync(int id, ISupplierService service, CancellationToken ct) =>
        await service.DeactivateAsync(id, ct) ? Results.NoContent() : Results.NotFound();
    private static async Task<IResult> PaymentAsync(int id, CreateSupplierPaymentRequest request, ISupplierService service, CancellationToken ct)
    {
        try { return Results.Ok(await service.RecordPaymentAsync(id, request, ct)); }
        catch (KeyNotFoundException) { return Results.NotFound(); }
        catch (SupplierValidationException exception) { return Invalid(exception.Message); }
    }
    private static async Task<IResult> PurchaseAsync(int id, CreateSupplierPurchaseRequest request, ISupplierService service, CancellationToken ct)
    {
        try { return Results.Ok(await service.RecordPurchaseAsync(id, request, ct)); }
        catch (KeyNotFoundException) { return Results.NotFound(); }
        catch (SupplierValidationException exception) { return Invalid(exception.Message); }
    }
    private static async Task<IResult> UpdateTransactionAsync(int id, int transactionId, UpdateSupplierTransactionRequest request, ISupplierService service, CancellationToken ct)
    {
        try { var supplier = await service.UpdateTransactionAsync(id, transactionId, request, ct); return supplier is null ? Results.NotFound() : Results.Ok(supplier); }
        catch (SupplierValidationException exception) { return Invalid(exception.Message); }
    }
    private static async Task<IResult> DeleteTransactionAsync(int id, int transactionId, ISupplierService service, CancellationToken ct)
    {
        try { var supplier = await service.DeleteTransactionAsync(id, transactionId, ct); return supplier is null ? Results.NotFound() : Results.Ok(supplier); }
        catch (SupplierValidationException exception) { return Invalid(exception.Message); }
    }
    private static async Task<IResult> TransferReservedFundsAsync(CreateSupplierReservedFundsTransferRequest request, ISupplierService service, CancellationToken ct)
    {
        try { await service.TransferReservedFundsAsync(request, ct); return Results.NoContent(); }
        catch (KeyNotFoundException) { return Results.NotFound(); }
        catch (SupplierValidationException exception) { return Invalid(exception.Message); }
    }
    private static async Task<IResult> ExchangeReservedFundsAsync(int id, CreateSupplierReservedFundsExchangeRequest request, ISupplierService service, CancellationToken ct)
    {
        try { return Results.Ok(await service.ExchangeReservedFundsAsync(id, request, ct)); }
        catch (KeyNotFoundException) { return Results.NotFound(); }
        catch (SupplierValidationException exception) { return Invalid(exception.Message); }
    }
    private static IResult Invalid(string detail) => Results.Problem(statusCode: StatusCodes.Status400BadRequest, title: "Datos de proveedor inválidos", detail: detail);
}
