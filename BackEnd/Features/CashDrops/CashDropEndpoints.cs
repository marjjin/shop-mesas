namespace GestionMesas.Api;

public static class CashDropEndpoints
{
    public static RouteGroupBuilder MapCashDropEndpoints(this RouteGroupBuilder api)
    {
        var group = api.MapGroup("/cash-drops").WithTags("Tiradas de efectivo");
        group.MapGet("/open", GetOpenAsync);
        group.MapGet("", GetAsync);
        group.MapPost("", CreateAsync);
        group.MapPut("/{id:int}", UpdateAsync);
        group.MapDelete("/{id:int}", DeleteAsync);
        return group;
    }

    private static async Task<IResult> GetOpenAsync(DateOnly? date, ICashDropService service, CancellationToken cancellationToken) =>
        Results.Ok(await service.GetOpenAsync(date ?? DateOnly.FromDateTime(DateTime.Today), cancellationToken));

    private static async Task<IResult> GetAsync(DateOnly date, string shift, ICashDropService service, CancellationToken cancellationToken)
    {
        try { return Results.Ok(await service.GetAsync(date, shift, cancellationToken)); }
        catch (CigaretteValidationException exception) { return ValidationProblem(exception.Message); }
    }

    private static async Task<IResult> CreateAsync(CreateCashDropRequest request, ICashDropService service, CancellationToken cancellationToken)
    {
        try { return Results.Created("/api/cash-drops", await service.CreateAsync(request, cancellationToken)); }
        catch (CigaretteValidationException exception) { return ValidationProblem(exception.Message); }
    }

    private static async Task<IResult> UpdateAsync(int id, UpdateCashDropRequest request, ICashDropService service, CancellationToken cancellationToken)
    {
        try
        {
            var drop = await service.UpdateAsync(id, request, cancellationToken);
            return drop is null ? Results.NotFound() : Results.Ok(drop);
        }
        catch (CigaretteValidationException exception) { return ValidationProblem(exception.Message); }
    }

    private static async Task<IResult> DeleteAsync(int id, ICashDropService service, CancellationToken cancellationToken)
    {
        try { return await service.DeleteAsync(id, cancellationToken) ? Results.NoContent() : Results.NotFound(); }
        catch (CigaretteValidationException exception) { return ValidationProblem(exception.Message); }
    }

    private static IResult ValidationProblem(string message) => Results.Problem(
        statusCode: StatusCodes.Status400BadRequest,
        title: "Datos de tirada inválidos",
        detail: message);
}
