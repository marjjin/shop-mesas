namespace GestionMesas.Api;

public static class CigaretteEndpoints
{
    public static RouteGroupBuilder MapCigaretteEndpoints(this RouteGroupBuilder api)
    {
        var group = api.MapGroup("/cigarettes").WithTags("Cigarrillos");

        group.MapGet("", GetDashboardAsync)
            .WithSummary("Obtiene productos, compras y cierres de una fecha");
        group.MapGet("/closes", GetClosesAsync)
            .WithSummary("Busca cierres dentro de un rango de fechas");
        group.MapPost("/products", CreateProductAsync)
            .WithSummary("Crea un cigarrillo con precio y stock inicial");
        group.MapPut("/products/{id:int}", UpdateProductAsync)
            .WithSummary("Actualiza el nombre y precio de un cigarrillo");
        group.MapDelete("/products/{id:int}", DeleteProductAsync)
            .WithSummary("Desactiva un cigarrillo conservando su historial");
        group.MapPost("/purchases", CreatePurchaseAsync)
            .WithSummary("Registra una compra y aumenta el stock");
        group.MapPost("/closes", CloseShiftAsync)
            .WithSummary("Cierra un turno y calcula sus ventas");

        return group;
    }

    private static async Task<IResult> GetDashboardAsync(DateOnly? date, ICigaretteService service, CancellationToken cancellationToken)
    {
        var selectedDate = date ?? DateOnly.FromDateTime(DateTime.Today);
        return Results.Ok(await service.GetDashboardAsync(selectedDate, cancellationToken));
    }

    private static async Task<IResult> GetClosesAsync(DateOnly from, DateOnly to, ICigaretteService service, CancellationToken cancellationToken)
    {
        try { return Results.Ok(await service.GetClosesAsync(from, to, cancellationToken)); }
        catch (CigaretteValidationException exception) { return ValidationProblem(exception.Message); }
    }

    private static async Task<IResult> CreateProductAsync(CreateCigaretteProductRequest request, ICigaretteService service, CancellationToken cancellationToken)
    {
        try
        {
            var product = await service.CreateProductAsync(request, cancellationToken);
            return Results.Created($"/api/cigarettes/products/{product.Id}", product);
        }
        catch (CigaretteValidationException exception) { return ValidationProblem(exception.Message); }
    }

    private static async Task<IResult> UpdateProductAsync(int id, UpdateCigaretteProductRequest request, ICigaretteService service, CancellationToken cancellationToken)
    {
        try
        {
            var product = await service.UpdateProductAsync(id, request, cancellationToken);
            return product is null ? Results.NotFound() : Results.Ok(product);
        }
        catch (CigaretteValidationException exception) { return ValidationProblem(exception.Message); }
    }

    private static async Task<IResult> DeleteProductAsync(int id, ICigaretteService service, CancellationToken cancellationToken) =>
        await service.DeleteProductAsync(id, cancellationToken) ? Results.NoContent() : Results.NotFound();

    private static async Task<IResult> CreatePurchaseAsync(CreateCigarettePurchaseRequest request, ICigaretteService service, CancellationToken cancellationToken)
    {
        try
        {
            var purchase = await service.CreatePurchaseAsync(request, cancellationToken);
            return Results.Created($"/api/cigarettes/purchases/{purchase.Id}", purchase);
        }
        catch (CigaretteNotFoundException) { return Results.NotFound(); }
        catch (CigaretteValidationException exception) { return ValidationProblem(exception.Message); }
    }

    private static async Task<IResult> CloseShiftAsync(CreateCigaretteShiftCloseRequest request, ICigaretteService service, CancellationToken cancellationToken)
    {
        try
        {
            var close = await service.CloseShiftAsync(request, cancellationToken);
            return Results.Created($"/api/cigarettes/closes/{close.Id}", close);
        }
        catch (CigaretteNotFoundException) { return Results.NotFound(); }
        catch (CigaretteValidationException exception) { return ValidationProblem(exception.Message); }
    }

    private static IResult ValidationProblem(string message) => Results.Problem(
        statusCode: StatusCodes.Status400BadRequest,
        title: "Datos de cigarrillos inválidos",
        detail: message);
}