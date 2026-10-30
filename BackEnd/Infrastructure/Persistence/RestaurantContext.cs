using Microsoft.EntityFrameworkCore;

namespace GestionMesas.Api;

public class RestaurantContext(DbContextOptions<RestaurantContext> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();
    public DbSet<UserSession> UserSessions => Set<UserSession>();
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
    public DbSet<CashDrop> CashDrops => Set<CashDrop>();
    public DbSet<CafeteriaProduct> CafeteriaProducts => Set<CafeteriaProduct>();
    public DbSet<CafeteriaSale> CafeteriaSales => Set<CafeteriaSale>();
    public DbSet<CafeteriaSaleItem> CafeteriaSaleItems => Set<CafeteriaSaleItem>();
    public DbSet<Supplier> Suppliers => Set<Supplier>();
    public DbSet<SupplierTransaction> SupplierTransactions => Set<SupplierTransaction>();
    public DbSet<WelcomeMessageSetting> WelcomeMessageSettings => Set<WelcomeMessageSetting>();
    public DbSet<InvoiceRecord> Invoices => Set<InvoiceRecord>();
    public DbSet<InvoiceDocument> InvoiceDocuments => Set<InvoiceDocument>();
    public DbSet<InvoiceFileCleanup> InvoiceFileCleanups => Set<InvoiceFileCleanup>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        InvoiceModel.Configure(modelBuilder);
        modelBuilder.Entity<User>().Property(user => user.Role).HasDefaultValue("Administrator");
        modelBuilder.Entity<UserSession>().HasKey(session => session.TokenHash);
        modelBuilder.Entity<UserSession>().Property(session => session.TokenHash).HasMaxLength(64);
        modelBuilder.Entity<UserSession>().Property(session => session.CredentialStamp).HasMaxLength(64);
        modelBuilder.Entity<UserSession>().HasIndex(session => session.UserId);
        modelBuilder.Entity<UserSession>().HasIndex(session => session.ExpiresAt);
        modelBuilder.Entity<UserSession>().HasOne(session => session.User).WithMany()
            .HasForeignKey(session => session.UserId).OnDelete(DeleteBehavior.Cascade);
        modelBuilder.Entity<PendingOrder>()
            .HasMany(order => order.Items)
            .WithOne()
            .HasForeignKey(item => item.PendingOrderId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<CigaretteProduct>().HasIndex(product => product.Name).IsUnique();
        modelBuilder.Entity<CigaretteProduct>().Property(product => product.Price).HasPrecision(12, 2);
        modelBuilder.Entity<CigarettePurchase>().Property(purchase => purchase.UnitCost).HasPrecision(12, 2);
        modelBuilder.Entity<CigarettePurchase>().Property(purchase => purchase.TotalCost).HasPrecision(12, 2);
        modelBuilder.Entity<CigaretteShiftClose>().HasIndex(close => new { close.BusinessDate, close.Shift }).IsUnique();
        modelBuilder.Entity<CigaretteShiftClose>().Property(close => close.EndingCashBalance).HasPrecision(12, 2);
        modelBuilder.Entity<CigaretteShiftClose>().Property(close => close.EndingMercadoPagoBalance).HasPrecision(12, 2);
        modelBuilder.Entity<CigaretteShiftClose>().Property(close => close.NextShiftChangeCash).HasPrecision(12, 2);
        modelBuilder.Entity<CigaretteShiftClose>().Property(close => close.ReceivedChangeCash).HasPrecision(12, 2);
        modelBuilder.Entity<CigaretteShiftClose>().Property(close => close.PosnetTotal).HasPrecision(12, 2);
        modelBuilder.Entity<CigaretteShiftClose>().Property(close => close.CigaretteReservedCash).HasPrecision(12, 2);
        modelBuilder.Entity<CigaretteShiftClose>().Property(close => close.CigaretteReservedMercadoPago).HasPrecision(12, 2);
        modelBuilder.Entity<CigaretteShiftClose>()
            .HasMany(close => close.Items)
            .WithOne()
            .HasForeignKey(item => item.CigaretteShiftCloseId)
            .OnDelete(DeleteBehavior.Cascade);
        modelBuilder.Entity<CigaretteShiftCloseItem>().Property(item => item.UnitPrice).HasPrecision(12, 2);
        modelBuilder.Entity<CigaretteShiftCloseItem>().Property(item => item.SalesAmount).HasPrecision(12, 2);
        modelBuilder.Entity<CashDrop>().Property(drop => drop.Amount).HasPrecision(12, 2);
        modelBuilder.Entity<CashDrop>()
            .HasOne<CigaretteShiftClose>()
            .WithMany()
            .HasForeignKey(drop => drop.CigaretteShiftCloseId)
            .OnDelete(DeleteBehavior.SetNull);
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
        modelBuilder.Entity<Supplier>().Property(supplier => supplier.ReservedBalance).HasPrecision(12, 2);
        modelBuilder.Entity<Supplier>().Property(supplier => supplier.ReservedCashBalance).HasPrecision(12, 2);
        modelBuilder.Entity<Supplier>().Property(supplier => supplier.ReservedMercadoPagoBalance).HasPrecision(12, 2);
        modelBuilder.Entity<Supplier>().Property(supplier => supplier.CurrentAccountBalance).HasPrecision(12, 2);
        modelBuilder.Entity<SupplierTransaction>().Property(transaction => transaction.Amount).HasPrecision(12, 2);
        modelBuilder.Entity<SupplierTransaction>().Property(transaction => transaction.CashAmount).HasPrecision(12, 2);
        modelBuilder.Entity<SupplierTransaction>().Property(transaction => transaction.MercadoPagoAmount).HasPrecision(12, 2);
        modelBuilder.Entity<SupplierTransaction>().HasIndex(transaction => new { transaction.SupplierId, transaction.CigaretteShiftCloseId }).IsUnique();
        modelBuilder.Entity<WelcomeMessageSetting>().Property(setting => setting.Amount).HasPrecision(12, 2);
    }
}
