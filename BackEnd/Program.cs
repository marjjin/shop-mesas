using GestionMesas.Api;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);
var configuredConnectionString = builder.Configuration.GetConnectionString("Restaurant")
    ?? throw new InvalidOperationException("La cadena de conexión 'Restaurant' es obligatoria.");
var connectionString = ToNpgsqlConnectionString(configuredConnectionString);
builder.Services.AddDbContext<RestaurantContext>(options => options.UseNpgsql(connectionString));
builder.Services.AddCors(options => options.AddDefaultPolicy(policy => policy.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod()));
builder.Services.AddHostedService<CoworkingBillingService>();

var app = builder.Build();
app.UseCors();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<RestaurantContext>();
    db.Database.EnsureCreated();
    db.Database.ExecuteSqlRaw("""ALTER TABLE "Tables" ADD COLUMN IF NOT EXISTS "CustomerName" character varying(80);""");
    if (!db.Users.Any())
    {
        var now = DateTime.UtcNow;
        db.Users.Add(new User { Username = "admin", Password = "admin", Name = "Administrador" });
        db.Categories.AddRange(new Category { Name = "Bebidas", Color = "#2f80ed" }, new Category { Name = "Cocina", Color = "#f2994a" }, new Category { Name = "Postres", Color = "#9b51e0" });
        db.SaveChanges();
        db.Products.AddRange(new Product { Name = "Café espresso", Price = 1800, CategoryId = 1 }, new Product { Name = "Limonada", Price = 2500, CategoryId = 1 }, new Product { Name = "Hamburguesa clásica", Price = 7800, CategoryId = 2 }, new Product { Name = "Papas rústicas", Price = 3200, CategoryId = 2 }, new Product { Name = "Brownie con helado", Price = 4200, CategoryId = 3 });
        db.Tables.AddRange(new RestaurantTable { Name = "Mesa 1", Seats = 2, X = 10, Y = 15 }, new RestaurantTable { Name = "Mesa 2", Seats = 4, X = 235, Y = 15, Status = "occupied", OpenedAt = now.AddMinutes(-42), LastConsumptionAt = now.AddMinutes(-12) }, new RestaurantTable { Name = "Mesa 3", Seats = 4, X = 460, Y = 15 }, new RestaurantTable { Name = "Mesa 4", Seats = 6, X = 120, Y = 185, Width = 150, Height = 106, Status = "occupied", OpenedAt = now.AddMinutes(-95), LastConsumptionAt = now.AddMinutes(-47) }, new RestaurantTable { Name = "Mesa 5", Seats = 2, X = 380, Y = 200 });
        db.SaveChanges();
        db.Orders.AddRange(new Order { TableId = 2, ProductId = 3, Quantity = 2, CreatedAt = now.AddMinutes(-12) }, new Order { TableId = 2, ProductId = 2, Quantity = 2, CreatedAt = now.AddMinutes(-12) }, new Order { TableId = 4, ProductId = 1, Quantity = 3, CreatedAt = now.AddMinutes(-47) });
        db.SaveChanges();
    }
}

var api = app.MapGroup("/api");
api.MapPost("/login", async (LoginRequest request, RestaurantContext db) =>
{
    var user = await db.Users.FirstOrDefaultAsync(item => item.Username == request.Username && item.Password == request.Password);
    return user is null ? Results.Unauthorized() : Results.Ok(new { token = "demo-admin-token", user = new { user.Id, user.Name, user.Username } });
});
api.MapGet("/bootstrap", async (RestaurantContext db) => Results.Ok(new { tables = await db.Tables.ToListAsync(), products = await db.Products.ToListAsync(), categories = await db.Categories.ToListAsync(), orders = await db.Orders.ToListAsync() }));
api.MapGet("/history", async (RestaurantContext db) =>
{
    var histories = await db.ClosedTableHistories.OrderByDescending(item => item.ClosedAt).ToListAsync();
    var historyIds = histories.Select(item => item.Id).ToList();
    var items = await db.ClosedTableHistoryItems.Where(item => historyIds.Contains(item.ClosedTableHistoryId)).OrderBy(item => item.CreatedAt).ToListAsync();
    return Results.Ok(histories.Select(history => new
    {
        history.Id,
        history.TableName,
        history.OpenedAt,
        history.ClosedAt,
        items = items.Where(item => item.ClosedTableHistoryId == history.Id).Select(item => new { item.Id, item.ProductName, item.Quantity, item.CreatedAt })
    }));
});
api.MapPost("/tables", async (TableRequest request, RestaurantContext db) => { var table = new RestaurantTable { Name = string.IsNullOrWhiteSpace(request.Name) ? $"Mesa {await db.Tables.CountAsync() + 1}" : request.Name, Seats = request.Seats.GetValueOrDefault(4) }; db.Tables.Add(table); await db.SaveChangesAsync(); return Results.Created($"/api/tables/{table.Id}", table); });
api.MapDelete("/tables", async (RestaurantContext db) => { db.Orders.RemoveRange(db.Orders); db.Tables.RemoveRange(db.Tables); await db.SaveChangesAsync(); return Results.NoContent(); });
api.MapPatch("/tables/{id:int}", async (int id, TablePatch patch, RestaurantContext db) =>
{
    var table = await db.Tables.FindAsync(id);
    if (table is null) return Results.NotFound();

    if (patch.OpenedAt.HasValue)
    {
        if (table.Status != "occupied") return Results.BadRequest();
        var openedAt = patch.OpenedAt.Value.UtcDateTime;
        var firstOrderAt = await db.Orders.Where(order => order.TableId == id)
            .Select(order => (DateTime?)order.CreatedAt).MinAsync();
        if (openedAt > DateTime.UtcNow || firstOrderAt.HasValue && openedAt > firstOrderAt.Value)
            return Results.BadRequest();

        table.OpenedAt = openedAt;
        if (!firstOrderAt.HasValue) table.LastConsumptionAt = openedAt;
    }

    table.Name = patch.Name ?? table.Name;
    table.Seats = patch.Seats ?? table.Seats;
    table.X = patch.X ?? table.X;
    table.Y = patch.Y ?? table.Y;
    table.Width = patch.Width ?? table.Width;
    table.Height = patch.Height ?? table.Height;
    await db.SaveChangesAsync();
    return Results.Ok(table);
});
api.MapPost("/tables/{id:int}/open", async (int id, OpenTableRequest request, RestaurantContext db) => { var customerName = request.CustomerName.Trim(); if (string.IsNullOrWhiteSpace(customerName) || customerName.Length > 80) return Results.BadRequest(); var table = await db.Tables.FindAsync(id); if (table is null) return Results.NotFound(); table.CustomerName = customerName; table.Status = "occupied"; table.OpenedAt = table.LastConsumptionAt = DateTime.UtcNow; await db.SaveChangesAsync(); return Results.Ok(table); });
api.MapPost("/tables/{id:int}/close", async (int id, RestaurantContext db) =>
{
    var table = await db.Tables.FindAsync(id);
    if (table is null) return Results.NotFound();
    if (table.Status != "occupied" || table.OpenedAt is null) return Results.BadRequest();

    await using var transaction = await db.Database.BeginTransactionAsync();
    var closedAt = DateTime.UtcNow;
    var orders = await db.Orders.Where(order => order.TableId == id).OrderBy(order => order.CreatedAt).ToListAsync();
    var productIds = orders.Select(order => order.ProductId).Distinct().ToList();
    var products = await db.Products.Where(product => productIds.Contains(product.Id)).ToDictionaryAsync(product => product.Id);
    var history = new ClosedTableHistory { TableName = table.Name, OpenedAt = table.OpenedAt.Value, ClosedAt = closedAt };
    db.ClosedTableHistories.Add(history);
    await db.SaveChangesAsync();

    db.ClosedTableHistoryItems.AddRange(orders.Select(order => new ClosedTableHistoryItem
    {
        ClosedTableHistoryId = history.Id,
        ProductName = products.TryGetValue(order.ProductId, out var product) ? product.Name : "Artículo eliminado",
        Quantity = order.Quantity,
        CreatedAt = order.CreatedAt
    }));
    table.Status = "free";
    table.CustomerName = null;
    table.OpenedAt = table.LastConsumptionAt = null;
    db.Orders.RemoveRange(orders);
    await db.SaveChangesAsync();
    await transaction.CommitAsync();
    return Results.Ok(new
    {
        table,
        historyId = history.Id,
        history = new
        {
            history.Id,
            history.TableName,
            history.OpenedAt,
            history.ClosedAt,
            items = orders.Select(order => new
            {
                order.Id,
                ProductName = products.TryGetValue(order.ProductId, out var product) ? product.Name : "Artículo eliminado",
                order.Quantity,
                order.CreatedAt
            })
        }
    });
});
api.MapPost("/categories", async (CategoryRequest request, RestaurantContext db) => { var category = new Category { Name = request.Name, Color = request.Color ?? "#e56743" }; db.Categories.Add(category); await db.SaveChangesAsync(); return Results.Created($"/api/categories/{category.Id}", category); });
api.MapDelete("/categories/{id:int}", async (int id, RestaurantContext db) => { var category = await db.Categories.FindAsync(id); if (category is null) return Results.NotFound(); if (category.Name == CoworkingBilling.CategoryName) return Results.Conflict(); var productIds = await db.Products.Where(product => product.CategoryId == id).Select(product => product.Id).ToListAsync(); db.Orders.RemoveRange(db.Orders.Where(order => productIds.Contains(order.ProductId))); db.Products.RemoveRange(db.Products.Where(product => product.CategoryId == id)); db.Categories.Remove(category); await db.SaveChangesAsync(); return Results.NoContent(); });
api.MapPost("/products", async (ProductRequest request, RestaurantContext db) => { if (string.IsNullOrWhiteSpace(request.Name) || request.Name is CoworkingBilling.HalfHourProductName or CoworkingBilling.HourProductName) return Results.BadRequest(); var category = await db.Categories.FirstOrDefaultAsync(item => item.Name == "Artículos"); if (category is null) { category = new Category { Name = "Artículos", Color = "#e56743" }; db.Categories.Add(category); await db.SaveChangesAsync(); } var product = new Product { Name = request.Name.Trim(), Price = 0, CategoryId = category.Id }; db.Products.Add(product); await db.SaveChangesAsync(); return Results.Created($"/api/products/{product.Id}", product); });
api.MapDelete("/products", async (RestaurantContext db) => { var productIds = await db.Products.Where(product => product.Name != CoworkingBilling.HalfHourProductName && product.Name != CoworkingBilling.HourProductName).Select(product => product.Id).ToListAsync(); db.Orders.RemoveRange(db.Orders.Where(order => productIds.Contains(order.ProductId))); db.Products.RemoveRange(db.Products.Where(product => productIds.Contains(product.Id))); await db.SaveChangesAsync(); return Results.NoContent(); });
api.MapDelete("/products/{id:int}", async (int id, RestaurantContext db) => { var product = await db.Products.FindAsync(id); if (product is null) return Results.NotFound(); if (product.Name is CoworkingBilling.HalfHourProductName or CoworkingBilling.HourProductName) return Results.Conflict(); db.Orders.RemoveRange(db.Orders.Where(order => order.ProductId == id)); db.Products.Remove(product); await db.SaveChangesAsync(); return Results.NoContent(); });
api.MapPost("/orders", async (OrderRequest request, RestaurantContext db) => { var table = await db.Tables.FindAsync(request.TableId); if (table is null || !await db.Products.AnyAsync(product => product.Id == request.ProductId)) return Results.BadRequest(); var now = DateTime.UtcNow; if (table.Status != "occupied") { table.Status = "occupied"; table.OpenedAt = now; } table.LastConsumptionAt = now; var order = new Order { TableId = request.TableId, ProductId = request.ProductId, Quantity = Math.Max(1, request.Quantity), CreatedAt = now }; db.Orders.Add(order); await db.SaveChangesAsync(); return Results.Created($"/api/orders/{order.Id}", new { order, table }); });
api.MapDelete("/orders/{id:int}", async (int id, RestaurantContext db) =>
{
    var order = await db.Orders.FindAsync(id);
    if (order is null) return Results.NotFound();
    var isCoworkingCharge = await db.Products.AnyAsync(product => product.Id == order.ProductId
        && (product.Name == CoworkingBilling.HalfHourProductName || product.Name == CoworkingBilling.HourProductName));
    if (isCoworkingCharge) return Results.Conflict();

    var table = await db.Tables.FindAsync(order.TableId);
    db.Orders.Remove(order);
    if (table is not null)
    {
        var lastRemainingOrderAt = await db.Orders
            .Where(item => item.TableId == order.TableId && item.Id != id)
            .Select(item => (DateTime?)item.CreatedAt)
            .MaxAsync();
        table.LastConsumptionAt = lastRemainingOrderAt ?? table.OpenedAt;
    }

    await db.SaveChangesAsync();
    return Results.NoContent();
});

app.MapGet("/", () => Results.Ok(new { name = "Gestion Mesas API", status = "online" }));
app.Run();

static string ToNpgsqlConnectionString(string configuredConnectionString)
{
    if (!Uri.TryCreate(configuredConnectionString, UriKind.Absolute, out var databaseUrl)
        || databaseUrl.Scheme is not ("postgres" or "postgresql"))
    {
        return configuredConnectionString;
    }

    var credentials = databaseUrl.UserInfo.Split(':', 2);
    var connectionString = new Npgsql.NpgsqlConnectionStringBuilder
    {
        Host = databaseUrl.Host,
        Port = databaseUrl.IsDefaultPort ? 5432 : databaseUrl.Port,
        Database = databaseUrl.AbsolutePath.Trim('/'),
        Username = Uri.UnescapeDataString(credentials[0]),
        Password = credentials.Length > 1 ? Uri.UnescapeDataString(credentials[1]) : string.Empty
    };

    foreach (var parameter in databaseUrl.Query.TrimStart('?').Split('&', StringSplitOptions.RemoveEmptyEntries))
    {
        var parts = parameter.Split('=', 2);
        if (parts.Length == 2 && string.Equals(parts[0], "sslmode", StringComparison.OrdinalIgnoreCase))
        {
            connectionString.SslMode = Enum.Parse<Npgsql.SslMode>(Uri.UnescapeDataString(parts[1]), ignoreCase: true);
        }
    }

    return connectionString.ConnectionString;
}