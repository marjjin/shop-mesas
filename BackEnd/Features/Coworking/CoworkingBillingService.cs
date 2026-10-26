namespace GestionMesas.Api;

public sealed class CoworkingBillingService(IServiceScopeFactory scopeFactory, ILogger<CoworkingBillingService> logger, IConfiguration configuration) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var interval = TimeSpan.FromSeconds(configuration.GetValue("CoworkingBillingIntervalSeconds", 30));
        using var timer = new PeriodicTimer(interval);
        do
        {
            try
            {
                await using var scope = scopeFactory.CreateAsyncScope();
                var db = scope.ServiceProvider.GetRequiredService<RestaurantContext>();
                await CoworkingBilling.ProcessAsync(db, DateTime.UtcNow, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception exception)
            {
                logger.LogError(exception, "No se pudieron actualizar los servicios de coworking.");
            }
        }
        while (await timer.WaitForNextTickAsync(stoppingToken));
    }
}
