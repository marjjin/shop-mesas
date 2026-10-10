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
    public DbSet<CafeteriaProduct> CafeteriaProducts => Set<CafeteriaProduct>();
    public DbSet<CafeteriaSale> CafeteriaSales => Set<CafeteriaSale>();
    public DbSet<CafeteriaSaleItem> CafeteriaSaleItems => Set<CafeteriaSaleItem>();
    public DbSet<Supplier> Suppliers => Set<Supplier>();
    public DbSet<SupplierTransaction> SupplierTransactions => Set<SupplierTransaction>();

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
        modelBuilder.Entity<CafeteriaProduct>().HasIndex(product => product.Name).IsUnique();
        modelBuilder.Entity<CafeteriaProduct>().Property(product => product.Price).HasPrecision(12, 2);
        modelBuilder.Entity<CafeteriaSale>()
            .HasMany(sale => sale.Items)
            .WithOne()
            .HasForeignKey(item => item.CafeteriaSaleId)
            .OnDelete(DeleteBehavior.Cascade);
        modelBuilder.Entity<CafeteriaSale>().HasIndex(sale => new { sale.BusinessDate, sale.Shift });
        modelBuilder.Entity<CafeteriaSaleItem>().Property(item => item.UnitPrice).HasPrecision(12, 2);
        modelBuilder.Entity<Supplier>().HasIndex(supplier => supplier.Name).IsUnique();
        modelBuilder.Entity<Supplier>().Property(supplier => supplier.Balance).HasPrecision(12, 2);
        modelBuilder.Entity<SupplierTransaction>().Property(transaction => transaction.Amount).HasPrecision(12, 2);
        modelBuilder.Entity<SupplierTransaction>().HasIndex(transaction => new { transaction.SupplierId, transaction.CigaretteShiftCloseId }).IsUnique();
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
public class CafeteriaProduct { public int Id { get; set; } public string Name { get; set; } = ""; public decimal Price { get; set; } public bool IsActive { get; set; } = true; public DateTime CreatedAt { get; set; } }
public class CafeteriaSale { public int Id { get; set; } public DateOnly BusinessDate { get; set; } public string Shift { get; set; } = "morning"; public DateTime CreatedAt { get; set; } public List<CafeteriaSaleItem> Items { get; set; } = []; }
public class CafeteriaSaleItem { public int Id { get; set; } public int CafeteriaSaleId { get; set; } public int CafeteriaProductId { get; set; } public string ProductName { get; set; } = ""; public decimal UnitPrice { get; set; } }
public class Supplier { public int Id { get; set; } public string Name { get; set; } = ""; public decimal Balance { get; set; } public bool IsActive { get; set; } = true; public DateTime CreatedAt { get; set; } }
public class SupplierTransaction { public int Id { get; set; } public int SupplierId { get; set; } public int? CigaretteShiftCloseId { get; set; } public string Type { get; set; } = ""; public decimal Amount { get; set; } public DateOnly BusinessDate { get; set; } public string? Note { get; set; } public DateTime CreatedAt { get; set; } }

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
public sealed record UpdateCigaretteProductRequest(string Name, decimal Price, int Stock);
/// <summary>Datos de una compra o reposición de stock.</summary>
public sealed record CreateCigarettePurchaseRequest(int CigaretteProductId, int Quantity, DateOnly BusinessDate, string Shift);
/// <summary>Datos editables de una compra de cigarrillos.</summary>
public sealed record UpdateCigarettePurchaseRequest(int Quantity);
/// <summary>Stock físico contado al finalizar un turno.</summary>
public sealed record CigaretteCloseItemRequest(int CigaretteProductId, int FinalStock);
/// <summary>Datos para cerrar un turno de cigarrillos.</summary>
public sealed record CreateCigaretteShiftCloseRequest(DateOnly BusinessDate, string Shift, IReadOnlyList<CigaretteCloseItemRequest> Items, IReadOnlyList<SupplierAllocationRequest>? SupplierAllocations = null);
/// <summary>Stock físico corregido para los productos de un cierre existente.</summary>
public sealed record UpdateCigaretteShiftCloseRequest(IReadOnlyList<CigaretteCloseItemRequest> Items, IReadOnlyList<SupplierAllocationRequest>? SupplierAllocations = null);
/// <summary>Presentación de cigarrillos disponible para operar.</summary>
public sealed record CigaretteProductResponse(int Id, string Name, decimal Price, int Stock);
/// <summary>Compra de cigarrillos registrada.</summary>
public sealed record CigarettePurchaseResponse(int Id, int CigaretteProductId, string ProductName, int Quantity, DateOnly BusinessDate, string Shift, DateTimeOffset CreatedAt);
/// <summary>Detalle de ventas calculado durante un cierre.</summary>
public sealed record CigaretteShiftCloseItemResponse(int CigaretteProductId, string ProductName, decimal UnitPrice, int InitialStock, int PurchasedQuantity, int FinalStock, int SoldQuantity, decimal SalesAmount);
/// <summary>Cierre completo de un turno.</summary>
public sealed record CigaretteShiftCloseResponse(int Id, DateOnly BusinessDate, string Shift, DateTimeOffset ClosedAt, int TotalSold, decimal TotalSales, IReadOnlyList<CigaretteShiftCloseItemResponse> Items, CafeteriaSalesSummaryResponse Cafeteria, IReadOnlyList<SupplierAllocationResponse> SupplierAllocations);
/// <summary>Datos operativos e históricos de cigarrillos para una fecha.</summary>
public sealed record CigaretteDashboardResponse(DateOnly BusinessDate, IReadOnlyList<CigaretteProductResponse> Products, IReadOnlyList<CigarettePurchaseResponse> Purchases, IReadOnlyList<CigaretteShiftCloseResponse> Closes);
/// <summary>Artículo configurable para las ventas rápidas de cafetería.</summary>
public sealed record CreateCafeteriaProductRequest(string Name, decimal Price);
/// <summary>Datos editables de un artículo de cafetería.</summary>
public sealed record UpdateCafeteriaProductRequest(string Name, decimal Price);
/// <summary>Artículo de cafetería disponible para una venta rápida.</summary>
public sealed record CafeteriaProductResponse(int Id, string Name, decimal Price);
/// <summary>Resumen acumulado de artículos vendidos por la caja de cafetería.</summary>
public sealed record CafeteriaSalesSummaryResponse(int SaleCount, decimal TotalSales, IReadOnlyList<CafeteriaSalesSummaryItemResponse> Items);
/// <summary>Artículo vendido por la caja de cafetería.</summary>
public sealed record CafeteriaSalesSummaryItemResponse(string ProductName, int Quantity, decimal UnitPrice, decimal TotalSales);
/// <summary>Información de la caja de cafetería para una fecha de trabajo.</summary>
public sealed record CafeteriaDashboardResponse(DateOnly BusinessDate, string? ActiveShift, IReadOnlyList<CafeteriaProductResponse> Products, CafeteriaSalesSummaryResponse Summary);
/// <summary>Datos para crear un proveedor.</summary>
public sealed record CreateSupplierRequest(string Name);
/// <summary>Datos para actualizar un proveedor.</summary>
public sealed record UpdateSupplierRequest(string Name);
/// <summary>Importe reservado para un proveedor al cerrar un turno.</summary>
public sealed record SupplierAllocationRequest(int SupplierId, decimal Amount);
/// <summary>Pago registrado para descontar el saldo de un proveedor.</summary>
public sealed record CreateSupplierPaymentRequest(decimal Amount, string? Note);
/// <summary>Movimiento de saldo de un proveedor.</summary>
public sealed record SupplierTransactionResponse(int Id, string Type, decimal Amount, decimal BalanceAfter, DateOnly BusinessDate, string? Shift, string? Note, DateTimeOffset CreatedAt);
/// <summary>Proveedor y sus movimientos de saldo.</summary>
public sealed record SupplierResponse(int Id, string Name, decimal Balance, bool IsActive, IReadOnlyList<SupplierTransactionResponse> Transactions);
/// <summary>Asignación reservada para un proveedor en un cierre.</summary>
public sealed record SupplierAllocationResponse(int SupplierId, string SupplierName, decimal Amount, decimal Balance);