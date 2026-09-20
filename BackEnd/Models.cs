using Microsoft.EntityFrameworkCore;

namespace GestionMesas.Api;

public class RestaurantContext(DbContextOptions<RestaurantContext> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();
    public DbSet<RestaurantTable> Tables => Set<RestaurantTable>();
    public DbSet<Category> Categories => Set<Category>();
    public DbSet<Product> Products => Set<Product>();
    public DbSet<Order> Orders => Set<Order>();
    public DbSet<ClosedTableHistory> ClosedTableHistories => Set<ClosedTableHistory>();
    public DbSet<ClosedTableHistoryItem> ClosedTableHistoryItems => Set<ClosedTableHistoryItem>();
}

public class User { public int Id { get; set; } public string Username { get; set; } = ""; public string Password { get; set; } = ""; public string Name { get; set; } = ""; }
public class RestaurantTable { public int Id { get; set; } public string Name { get; set; } = ""; public string? CustomerName { get; set; } public int Seats { get; set; } = 4; public int X { get; set; } = 60; public int Y { get; set; } = 60; public int Width { get; set; } = 138; public int Height { get; set; } = 96; public string Status { get; set; } = "free"; public DateTime? OpenedAt { get; set; } public DateTime? LastConsumptionAt { get; set; } public bool CoworkingDisabled { get; set; } }
public class Category { public int Id { get; set; } public string Name { get; set; } = ""; public string Color { get; set; } = "#e56743"; }
public class Product { public int Id { get; set; } public string Name { get; set; } = ""; public decimal Price { get; set; } public int CategoryId { get; set; } }
public class Order { public int Id { get; set; } public int TableId { get; set; } public int ProductId { get; set; } public int Quantity { get; set; } = 1; public DateTime CreatedAt { get; set; } }
public class ClosedTableHistory { public int Id { get; set; } public string TableName { get; set; } = ""; public DateTime OpenedAt { get; set; } public DateTime ClosedAt { get; set; } }
public class ClosedTableHistoryItem { public int Id { get; set; } public int ClosedTableHistoryId { get; set; } public string ProductName { get; set; } = ""; public int Quantity { get; set; } = 1; public DateTime CreatedAt { get; set; } }

public record LoginRequest(string Username, string Password);
public record TableRequest(string? Name, int? Seats);
public record TablePatch(string? Name, int? Seats, int? X, int? Y, int? Width, int? Height, DateTimeOffset? OpenedAt);
public record OpenTableRequest(string CustomerName);
public record CategoryRequest(string Name, string? Color);
public record ProductRequest(string Name);
public record OrderRequest(int TableId, int ProductId, int Quantity);
/// <summary>Datos permitidos para modificar un consumo.</summary>
public sealed record UpdateOrderRequest(DateTimeOffset CreatedAt);