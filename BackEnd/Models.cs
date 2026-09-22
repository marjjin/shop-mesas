using Microsoft.EntityFrameworkCore;

namespace GestionMesas.Api;

public class RestaurantContext(DbContextOptions<RestaurantContext> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();
    public DbSet<RestaurantTable> Tables => Set<RestaurantTable>();
    public DbSet<Category> Categories => Set<Category>();
    public DbSet<Product> Products => Set<Product>();
    public DbSet<Order> Orders => Set<Order>();
    public DbSet<PendingOrder> PendingOrders => Set<PendingOrder>();
    public DbSet<PendingOrderItem> PendingOrderItems => Set<PendingOrderItem>();
    public DbSet<ClosedTableHistory> ClosedTableHistories => Set<ClosedTableHistory>();
    public DbSet<ClosedTableHistoryItem> ClosedTableHistoryItems => Set<ClosedTableHistoryItem>();
    public DbSet<CigaretteProduct> CigaretteProducts => Set<CigaretteProduct>();
    public DbSet<CigarettePurchase> CigarettePurchases => Set<CigarettePurchase>();
    public DbSet<CigaretteShiftClose> CigaretteShiftCloses => Set<CigaretteShiftClose>();
    public DbSet<CigaretteShiftCloseItem> CigaretteShiftCloseItems => Set<CigaretteShiftCloseItem>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<PendingOrder>()
            .HasMany(order => order.Items)
            .WithOne()
            .HasForeignKey(item => item.PendingOrderId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<CigaretteProduct>().HasIndex(product => product.Name).IsUnique();
        modelBuilder.Entity<CigaretteProduct>().Property(product => product.Price).HasPrecision(12, 2);
        modelBuilder.Entity<CigarettePurchase>().Property(purchase => purchase.UnitCost).HasPrecision(12, 2);
        modelBuilder.Entity<CigaretteShiftClose>().HasIndex(close => new { close.BusinessDate, close.Shift }).IsUnique();
        modelBuilder.Entity<CigaretteShiftClose>()
            .HasMany(close => close.Items)
            .WithOne()
            .HasForeignKey(item => item.CigaretteShiftCloseId)
            .OnDelete(DeleteBehavior.Cascade);
        modelBuilder.Entity<CigaretteShiftCloseItem>().Property(item => item.UnitPrice).HasPrecision(12, 2);
        modelBuilder.Entity<CigaretteShiftCloseItem>().Property(item => item.SalesAmount).HasPrecision(12, 2);
    }
}

public class User { public int Id { get; set; } public string Username { get; set; } = ""; public string Password { get; set; } = ""; public string Name { get; set; } = ""; }
public class RestaurantTable { public int Id { get; set; } public string Name { get; set; } = ""; public string? CustomerName { get; set; } public int Seats { get; set; } = 4; public int X { get; set; } = 60; public int Y { get; set; } = 60; public int Width { get; set; } = 138; public int Height { get; set; } = 96; public string Status { get; set; } = "free"; public DateTime? OpenedAt { get; set; } public DateTime? LastConsumptionAt { get; set; } public bool CoworkingDisabled { get; set; } }
public class Category { public int Id { get; set; } public string Name { get; set; } = ""; public string Color { get; set; } = "#e56743"; }
public class Product { public int Id { get; set; } public string Name { get; set; } = ""; public decimal Price { get; set; } public int CategoryId { get; set; } }
public class Order { public int Id { get; set; } public int TableId { get; set; } public int ProductId { get; set; } public int Quantity { get; set; } = 1; public DateTime CreatedAt { get; set; } }
public class PendingOrder { public int Id { get; set; } public string CustomerName { get; set; } = ""; public DateTime CreatedAt { get; set; } public List<PendingOrderItem> Items { get; set; } = []; }
public class PendingOrderItem { public int Id { get; set; } public int PendingOrderId { get; set; } public int ProductId { get; set; } public int Quantity { get; set; } = 1; public DateTime CreatedAt { get; set; } }
public class ClosedTableHistory { public int Id { get; set; } public string TableName { get; set; } = ""; public DateTime OpenedAt { get; set; } public DateTime ClosedAt { get; set; } }
public class ClosedTableHistoryItem { public int Id { get; set; } public int ClosedTableHistoryId { get; set; } public string ProductName { get; set; } = ""; public int Quantity { get; set; } = 1; public DateTime CreatedAt { get; set; } }
public class CigaretteProduct { public int Id { get; set; } public string Name { get; set; } = ""; public decimal Price { get; set; } public int Stock { get; set; } public bool IsActive { get; set; } = true; public DateTime CreatedAt { get; set; } }
public class CigarettePurchase { public int Id { get; set; } public int CigaretteProductId { get; set; } public int Quantity { get; set; } public decimal UnitCost { get; set; } public DateOnly BusinessDate { get; set; } public string Shift { get; set; } = "morning"; public DateTime CreatedAt { get; set; } }
public class CigaretteShiftClose { public int Id { get; set; } public DateOnly BusinessDate { get; set; } public string Shift { get; set; } = "morning"; public DateTime ClosedAt { get; set; } public List<CigaretteShiftCloseItem> Items { get; set; } = []; }
public class CigaretteShiftCloseItem { public int Id { get; set; } public int CigaretteShiftCloseId { get; set; } public int CigaretteProductId { get; set; } public string ProductName { get; set; } = ""; public decimal UnitPrice { get; set; } public int InitialStock { get; set; } public int PurchasedQuantity { get; set; } public int FinalStock { get; set; } public int SoldQuantity { get; set; } public decimal SalesAmount { get; set; } }

public record LoginRequest(string Username, string Password);
public record TableRequest(string? Name, int? Seats);
public record TablePatch(string? Name, int? Seats, int? X, int? Y, int? Width, int? Height, DateTimeOffset? OpenedAt);
public record OpenTableRequest(string CustomerName);
public record CategoryRequest(string Name, string? Color);
public record ProductRequest(string Name);
public record OrderRequest(int TableId, int ProductId, int Quantity);
public sealed record CreatePendingOrderRequest(string CustomerName);
public sealed record AddPendingOrderItemRequest(int ProductId, int Quantity);
public sealed record AssignPendingOrderRequest(int TableId);
/// <summary>Datos permitidos para modificar un consumo.</summary>
public sealed record UpdateOrderRequest(DateTimeOffset CreatedAt);

/// <summary>Datos para dar de alta una presentación de cigarrillos.</summary>
public sealed record CreateCigaretteProductRequest(string Name, decimal Price, int InitialStock);
/// <summary>Datos editables de una presentación de cigarrillos.</summary>
public sealed record UpdateCigaretteProductRequest(string Name, decimal Price);
/// <summary>Datos de una compra o reposición de stock.</summary>
public sealed record CreateCigarettePurchaseRequest(int CigaretteProductId, int Quantity, DateOnly BusinessDate, string Shift);
/// <summary>Stock físico contado al finalizar un turno.</summary>
public sealed record CigaretteCloseItemRequest(int CigaretteProductId, int FinalStock);
/// <summary>Datos para cerrar un turno de cigarrillos.</summary>
public sealed record CreateCigaretteShiftCloseRequest(DateOnly BusinessDate, string Shift, IReadOnlyList<CigaretteCloseItemRequest> Items);
/// <summary>Presentación de cigarrillos disponible para operar.</summary>
public sealed record CigaretteProductResponse(int Id, string Name, decimal Price, int Stock);
/// <summary>Compra de cigarrillos registrada.</summary>
public sealed record CigarettePurchaseResponse(int Id, int CigaretteProductId, string ProductName, int Quantity, DateOnly BusinessDate, string Shift, DateTimeOffset CreatedAt);
/// <summary>Detalle de ventas calculado durante un cierre.</summary>
public sealed record CigaretteShiftCloseItemResponse(int CigaretteProductId, string ProductName, decimal UnitPrice, int InitialStock, int PurchasedQuantity, int FinalStock, int SoldQuantity, decimal SalesAmount);
/// <summary>Cierre completo de un turno.</summary>
public sealed record CigaretteShiftCloseResponse(int Id, DateOnly BusinessDate, string Shift, DateTimeOffset ClosedAt, int TotalSold, decimal TotalSales, IReadOnlyList<CigaretteShiftCloseItemResponse> Items);
/// <summary>Datos operativos e históricos de cigarrillos para una fecha.</summary>
public sealed record CigaretteDashboardResponse(DateOnly BusinessDate, IReadOnlyList<CigaretteProductResponse> Products, IReadOnlyList<CigarettePurchaseResponse> Purchases, IReadOnlyList<CigaretteShiftCloseResponse> Closes);