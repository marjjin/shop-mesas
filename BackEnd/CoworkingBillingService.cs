using Microsoft.EntityFrameworkCore;

namespace GestionMesas.Api;

public static class CoworkingBilling
{
    public const string CategoryName = "Servicios";
    public const string HalfHourProductName = "Servicio Coworking 30 minutos";
    public const string HourProductName = "Servicio Coworking 1 hora";

    public static async Task ProcessAsync(RestaurantContext db, DateTime now, CancellationToken cancellationToken = default)
    {
        var (halfHourProduct, hourProduct) = await EnsureServiceProductsAsync(db, cancellationToken);
        var serviceProductIds = new HashSet<int> { halfHourProduct.Id, hourProduct.Id };
        var tables = await db.Tables
            .Where(table => table.Status == "occupied" && table.OpenedAt != null)
            .ToListAsync(cancellationToken);

        foreach (var table in tables)
        {
            var openedAt = table.OpenedAt!.Value;
            var orders = await db.Orders
                .Where(order => order.TableId == table.Id && order.CreatedAt >= openedAt)
                .ToListAsync(cancellationToken);
            var realConsumptions = orders
                .Where(order => !serviceProductIds.Contains(order.ProductId))
                .OrderBy(order => order.CreatedAt)
                .ToList();

            foreach (var service in orders.Where(order => order.ProductId == halfHourProduct.Id))
            {
                var previousConsumption = realConsumptions.LastOrDefault(order => order.CreatedAt <= service.CreatedAt);
                if (previousConsumption is not null && service.CreatedAt == previousConsumption.CreatedAt.AddHours(1))
                    service.ProductId = hourProduct.Id;
            }

            var lastRealConsumption = orders
                .Where(order => !serviceProductIds.Contains(order.ProductId))
                .Select(order => (DateTime?)order.CreatedAt)
                .Max();
            var lastService = orders
                .Where(order => serviceProductIds.Contains(order.ProductId))
                .Select(order => (DateTime?)order.CreatedAt)
                .Max();

            DateTime nextCharge;
            var nextProductId = halfHourProduct.Id;
            if (lastRealConsumption.HasValue && (!lastService.HasValue || lastRealConsumption > lastService))
            {
                nextCharge = lastRealConsumption.Value.AddHours(1);
                nextProductId = hourProduct.Id;
            }
            else if (lastService.HasValue)
                nextCharge = lastService.Value.AddMinutes(30);
            else
                nextCharge = openedAt.AddMinutes(30);

            while (nextCharge <= now)
            {
                db.Orders.Add(new Order
                {
                    TableId = table.Id,
                    ProductId = nextProductId,
                    Quantity = 1,
                    CreatedAt = nextCharge
                });
                nextCharge = nextCharge.AddMinutes(30);
                nextProductId = halfHourProduct.Id;
            }
        }

        await db.SaveChangesAsync(cancellationToken);
    }

    private static async Task<(Product HalfHour, Product Hour)> EnsureServiceProductsAsync(RestaurantContext db, CancellationToken cancellationToken)
    {
        var category = await db.Categories.FirstOrDefaultAsync(item => item.Name == CategoryName, cancellationToken);
        if (category is null)
        {
            category = new Category { Name = CategoryName, Color = "#59636f" };
            db.Categories.Add(category);
            await db.SaveChangesAsync(cancellationToken);
        }

        var halfHour = await db.Products.FirstOrDefaultAsync(item => item.Name == HalfHourProductName, cancellationToken);
        var hour = await db.Products.FirstOrDefaultAsync(item => item.Name == HourProductName, cancellationToken);
        if (halfHour is null)
        {
            halfHour = new Product { Name = HalfHourProductName, Price = 0, CategoryId = category.Id };
            db.Products.Add(halfHour);
        }
        if (hour is null)
        {
            hour = new Product { Name = HourProductName, Price = 0, CategoryId = category.Id };
            db.Products.Add(hour);
        }
        await db.SaveChangesAsync(cancellationToken);
        return (halfHour, hour);
    }
}

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