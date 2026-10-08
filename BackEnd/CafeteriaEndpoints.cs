namespace GestionMesas.Api;

public static class CafeteriaEndpoints
{
    public static RouteGroupBuilder MapCafeteriaEndpoints(this RouteGroupBuilder api)
    {
        var group = api.MapGroup("/cafeteria").WithTags("Caja Cafetería");
        group.MapGet("/dashboard", GetDashboardAsync).WithSummary("Obtiene los artículos y la caja de cafetería de una fecha");
        group.MapPost("/sales", RegisterSaleAsync).WithSummary("Registra una venta rápida con todos los artículos activos de cafetería");
        group.MapPost("/products", CreateProductAsync).WithSummary("Crea un artículo de cafetería sin control de stock");
        group.MapPut("/products/{id:int}", UpdateProductAsync).WithSummary("Actualiza un artículo de cafetería");
        group.MapDelete("/products/{id:int}", DeleteProductAsync).WithSummary("Desactiva un artículo de cafetería conservando sus ventas");
        return group;
    }

    private static async Task<IResult> GetDashboardAsync(DateOnly? date, ICafeteriaService service, CancellationToken cancellationToken) =>
        Results.Ok(await service.GetDashboardAsync(date ?? DateOnly.FromDateTime(DateTime.Today), cancellationToken));

    private static async Task<IResult> RegisterSaleAsync(DateOnly? date, ICafeteriaService service, CancellationToken cancellationToken)
    {
        try
        {
            var dashboard = await service.RegisterSaleAsync(date ?? DateOnly.FromDateTime(DateTime.Today), cancellationToken);
            return Results.Created("/api/cafeteria/sales", dashboard);
        }
        catch (CafeteriaValidationException exception) { return ValidationProblem(exception.Message); }
    }

    private static async Task<IResult> CreateProductAsync(CreateCafeteriaProductRequest request, ICafeteriaService service, CancellationToken cancellationToken)
    {
        try
        {
            var product = await service.CreateProductAsync(request, cancellationToken);
            return Results.Created($"/api/cafeteria/products/{product.Id}", product);
        }
        catch (CafeteriaValidationException exception) { return ValidationProblem(exception.Message); }
    }

    private static async Task<IResult> UpdateProductAsync(int id, UpdateCafeteriaProductRequest request, ICafeteriaService service, CancellationToken cancellationToken)
    {
        try
        {
            var product = await service.UpdateProductAsync(id, request, cancellationToken);
            return product is null ? Results.NotFound() : Results.Ok(product);
        }
        catch (CafeteriaValidationException exception) { return ValidationProblem(exception.Message); }
    }

    private static async Task<IResult> DeleteProductAsync(int id, ICafeteriaService service, CancellationToken cancellationToken) =>
        await service.DeleteProductAsync(id, cancellationToken) ? Results.NoContent() : Results.NotFound();

    private static IResult ValidationProblem(string message) => Results.Problem(statusCode: StatusCodes.Status400BadRequest, title: "Datos de cafetería inválidos", detail: message);
}