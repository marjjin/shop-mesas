// Tarea en segundo plano: dispara CoworkingBilling periódicamente, cada 30 segundos por defecto.
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
                // Cada vuelta crea su propio scope: un DbContext no debe vivir tanto tiempo.
                await using var scope = scopeFactory.CreateAsyncScope();
                var db = scope.ServiceProvider.GetRequiredService<RestaurantContext>();
                await CoworkingBilling.ProcessAsync(db, DateTime.UtcNow, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            // Un error se registra pero no detiene el ciclo: la próxima vuelta reintenta.
            catch (Exception exception)
            {
                logger.LogError(exception, "No se pudieron actualizar los servicios de coworking.");
            }
        }
        while (await timer.WaitForNextTickAsync(stoppingToken));
    }
}
