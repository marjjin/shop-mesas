// Lógica de los cargos automáticos de coworking.
// Regla: tras 1 hora sin consumir se carga 1 hora, y luego media hora por cada 30 minutos adicionales.
using Microsoft.EntityFrameworkCore;

namespace GestionMesas.Api;

// Los nombres de estos productos funcionan como identificadores: el sistema los busca por nombre.
public static class CoworkingBilling
{
    public const string CategoryName = "Servicios";
    public const string HalfHourProductName = "Servicio Coworking 30 minutos";
    public const string HourProductName = "Servicio Coworking 1 hora";

    // Revisa las mesas ocupadas y agrega los cargos vencidos hasta el momento indicado.
    public static async Task ProcessAsync(RestaurantContext db, DateTime now, CancellationToken cancellationToken = default)
    {
        var (halfHourProduct, hourProduct) = await EnsureServiceProductsAsync(db, cancellationToken);
        var serviceProductIds = new HashSet<int> { halfHourProduct.Id, hourProduct.Id };
        var tables = await db.Tables
            // CoworkingDisabled excluye las mesas donde se quitó un cargo a mano.
            .Where(table => table.Status == "occupied" && table.OpenedAt != null && !table.CoworkingDisabled)
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

            // Corrección de datos: un cargo de 30 minutos ubicado justo 1 hora después de un consumo debía ser de 1 hora.
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

            // Decide cuándo corresponde el próximo cargo según qué fue lo último que pasó en la mesa.
            DateTime nextCharge;
            var nextProductId = halfHourProduct.Id;
            // Hubo un consumo real después del último cargo: el ciclo reinicia con 1 hora de gracia.
            if (lastRealConsumption.HasValue && (!lastService.HasValue || lastRealConsumption > lastService))
            {
                nextCharge = lastRealConsumption.Value.AddHours(1);
                nextProductId = hourProduct.Id;
            }
            // Ya venían corriendo cargos: el siguiente llega 30 minutos después.
            else if (lastService.HasValue)
                nextCharge = lastService.Value.AddMinutes(30);
            // Mesa abierta sin consumos: primer cargo a los 30 minutos de abrir.
            else
                nextCharge = openedAt.AddMinutes(30);

            // El while recupera todos los cargos atrasados, por ejemplo si el servidor estuvo apagado.
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

    // Crea la categoría y los productos de servicio si no existen.
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
