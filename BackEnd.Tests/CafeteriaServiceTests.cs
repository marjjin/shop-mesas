using GestionMesas.Api;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace GestionMesas.Api.Tests;

public sealed class CafeteriaServiceTests
{
    [Fact]
    public async Task RegisterSaleAddsEveryActiveProductAndPreservesTheSoldPrice()
    {
        await using var fixture = await TestFixture.CreateAsync();
        var date = new DateOnly(2026, 10, 7);
        var cafe = await fixture.Service.CreateProductAsync(new CreateCafeteriaProductRequest("Café", 2500m), default);
        var medialuna = await fixture.Service.CreateProductAsync(new CreateCafeteriaProductRequest("Medialuna", 500m), default);

        var sale = await fixture.Service.RegisterSaleAsync(date, default);
        await fixture.Service.UpdateProductAsync(cafe.Id, new UpdateCafeteriaProductRequest("Café", 3000m), default);
        var summary = await fixture.Service.GetSummaryAsync(date, "morning", default);

        Assert.Equal(1, sale.Summary.SaleCount);
        Assert.Equal(3000m, sale.Summary.TotalSales);
        Assert.Equal(2, sale.Summary.Items.Sum(item => item.Quantity));
        Assert.Equal(3000m, summary.TotalSales);
        Assert.Contains(summary.Items, item => item.ProductName == "Café" && item.UnitPrice == 2500m && item.Quantity == 1);
        Assert.Contains(summary.Items, item => item.ProductName == "Medialuna" && item.UnitPrice == 500m && item.Quantity == 1);
        Assert.Equal(2, (await fixture.Db.CafeteriaSaleItems.CountAsync()));
        Assert.NotEqual(0, medialuna.Id);
    }

    [Fact]
    public async Task DashboardStartsFromTheLatestShiftClose()
    {
        await using var fixture = await TestFixture.CreateAsync();
        var date = new DateOnly(2026, 10, 7);
        var product = await fixture.Service.CreateProductAsync(new CreateCafeteriaProductRequest("Café", 2500m), default);
        var morningSale = new CafeteriaSale { BusinessDate = date, Shift = "morning", CreatedAt = date.ToDateTime(new TimeOnly(9, 0), DateTimeKind.Utc) };
        morningSale.Items.Add(new CafeteriaSaleItem { CafeteriaProductId = product.Id, ProductName = product.Name, UnitPrice = product.Price });
        fixture.Db.CafeteriaSales.Add(morningSale);
        fixture.Db.CigaretteShiftCloses.Add(new CigaretteShiftClose { BusinessDate = date, Shift = "morning", ClosedAt = date.ToDateTime(new TimeOnly(12, 0), DateTimeKind.Utc) });
        var afternoonSale = new CafeteriaSale { BusinessDate = date, Shift = "afternoon", CreatedAt = date.ToDateTime(new TimeOnly(14, 0), DateTimeKind.Utc) };
        afternoonSale.Items.Add(new CafeteriaSaleItem { CafeteriaProductId = product.Id, ProductName = product.Name, UnitPrice = product.Price });
        fixture.Db.CafeteriaSales.Add(afternoonSale);
        await fixture.Db.SaveChangesAsync();

        var dashboard = await fixture.Service.GetDashboardAsync(date, default);

        Assert.Equal(1, dashboard.Summary.SaleCount);
        Assert.Equal(2500m, dashboard.Summary.TotalSales);
        Assert.Equal(1, Assert.Single(dashboard.Summary.Items).Quantity);
    }

    [Fact]
    public async Task DashboardResetsOnlyAfterClosingTheShift()
    {
        await using var fixture = await TestFixture.CreateAsync();
        var date = new DateOnly(2026, 10, 7);
        await fixture.Service.CreateProductAsync(new CreateCafeteriaProductRequest("Café", 2500m), default);
        var cigarette = new CigaretteProduct { Name = "Marlboro Box", Price = 3500m, Stock = 10, CreatedAt = DateTime.UtcNow };
        fixture.Db.CigaretteProducts.Add(cigarette);
        await fixture.Db.SaveChangesAsync();
        await fixture.Service.RegisterSaleAsync(date, default);

        var cigaretteService = new CigaretteService(fixture.Db, fixture.Service);
        await cigaretteService.CloseShiftAsync(
            new CreateCigaretteShiftCloseRequest(date, "morning", [new CigaretteCloseItemRequest(cigarette.Id, 9)]), default);
        var dashboard = await fixture.Service.GetDashboardAsync(date, default);

        Assert.Equal(0, dashboard.Summary.SaleCount);
        Assert.Equal(0m, dashboard.Summary.TotalSales);
        Assert.Empty(dashboard.Summary.Items);
    }

    [Fact]
    public async Task DashboardKeepsSalesAcrossDatesUntilTheShiftIsClosed()
    {
        await using var fixture = await TestFixture.CreateAsync();
        var date = new DateOnly(2026, 10, 7);
        var followingDate = date.AddDays(1);
        await fixture.Service.CreateProductAsync(new CreateCafeteriaProductRequest("Café", 2500m), default);
        var cigarette = new CigaretteProduct { Name = "Marlboro Box", Price = 3500m, Stock = 10, CreatedAt = DateTime.UtcNow };
        fixture.Db.CigaretteProducts.Add(cigarette);
        await fixture.Db.SaveChangesAsync();
        var cigarettes = new CigaretteService(fixture.Db, fixture.Service);

        await fixture.Service.RegisterSaleAsync(date, default);
        await cigarettes.CloseShiftAsync(
            new CreateCigaretteShiftCloseRequest(date, "morning", [new CigaretteCloseItemRequest(cigarette.Id, 9)]), default);
        await fixture.Service.RegisterSaleAsync(followingDate, default);

        var dashboardBeforeClose = await fixture.Service.GetDashboardAsync(followingDate, default);
        var afternoonClose = await cigarettes.CloseShiftAsync(
            new CreateCigaretteShiftCloseRequest(followingDate, "afternoon", [new CigaretteCloseItemRequest(cigarette.Id, 8)]), default);
        var dashboardAfterClose = await fixture.Service.GetDashboardAsync(followingDate, default);

        Assert.Equal(1, dashboardBeforeClose.Summary.SaleCount);
        Assert.Equal("afternoon", dashboardBeforeClose.ActiveShift);
        Assert.Equal(1, afternoonClose.Cafeteria.SaleCount);
        Assert.Equal(0, dashboardAfterClose.Summary.SaleCount);
    }

    [Fact]
    public async Task DashboardIncludesDailyAndMonthlySalesTotals()
    {
        await using var fixture = await TestFixture.CreateAsync();
        var date = new DateOnly(2026, 10, 7);
        await fixture.Service.CreateProductAsync(new CreateCafeteriaProductRequest("Café", 2500m), default);

        await fixture.Service.RegisterSaleAsync(date.AddMonths(-1), default);
        await fixture.Service.RegisterSaleAsync(date.AddDays(-1), default);
        await fixture.Service.RegisterSaleAsync(date, default);
        await fixture.Service.RegisterSaleAsync(date, default);

        var dashboard = await fixture.Service.GetDashboardAsync(date, default);

        Assert.Equal(2, dashboard.DaySummary.SaleCount);
        Assert.Equal(5000m, dashboard.DaySummary.TotalSales);
        Assert.Equal(3, dashboard.MonthSummary.SaleCount);
        Assert.Equal(7500m, dashboard.MonthSummary.TotalSales);
        Assert.Equal(2, dashboard.RecentShiftHistory.Count);
        Assert.Contains(dashboard.RecentShiftHistory, item => item.BusinessDate == date && item.SaleCount == 2 && item.TotalSales == 5000m);
        Assert.Contains(dashboard.RecentShiftHistory, item => item.BusinessDate == date.AddDays(-1) && item.SaleCount == 1 && item.TotalSales == 2500m);

        var selectedDayHistory = await fixture.Service.GetShiftHistoryAsync(date, default);
        var selectedDay = Assert.Single(selectedDayHistory);
        Assert.Equal(2, selectedDay.SaleCount);
        Assert.Equal(5000m, selectedDay.TotalSales);
    }

    [Theory]
    [InlineData("morning", "morning")]
    [InlineData("morning", "afternoon")]
    [InlineData("afternoon", "afternoon")]
    [InlineData("afternoon", "morning")]
    public async Task ClosingShiftIncludesAllPendingCoffeesAcrossDatesAndShifts(string shift, string pendingShift)
    {
        await using var fixture = await TestFixture.CreateAsync();
        var date = new DateOnly(2026, 10, 7);
        var previousShift = shift == "morning" ? "afternoon" : "morning";
        var previousDate = shift == "morning" ? date.AddDays(-1) : date;
        var product = await fixture.Service.CreateProductAsync(new CreateCafeteriaProductRequest("Café", 2500m), default);
        var cigarette = new CigaretteProduct { Name = "Marlboro Box", Price = 3500m, Stock = 10, CreatedAt = DateTime.UtcNow };
        fixture.Db.CigaretteProducts.Add(cigarette);
        fixture.Db.CigaretteShiftCloses.Add(new CigaretteShiftClose
        {
            BusinessDate = previousDate, Shift = previousShift, ClosedAt = DateTime.UtcNow.AddHours(-8)
        });
        AddSales(2, previousDate, previousShift);
        AddSales(20, date, shift);
        AddSales(5, date.AddDays(1), pendingShift);
        await fixture.Db.SaveChangesAsync();
        var cigarettes = new CigaretteService(fixture.Db, fixture.Service);
        var beforeClose = await fixture.Service.GetDashboardAsync(date, default);

        var close = await cigarettes.CloseShiftAsync(
            new CreateCigaretteShiftCloseRequest(date, shift, [new CigaretteCloseItemRequest(cigarette.Id, 9)]), default);
        fixture.Db.ChangeTracker.Clear();
        var afterClose = await fixture.Service.GetDashboardAsync(date.AddDays(1), default);
        var reloadedClose = Assert.Single(await cigarettes.GetClosesAsync(date, date, default), item => item.Id == close.Id);
        var previousSummary = await fixture.Service.GetSummaryAsync(previousDate, previousShift, default);
        var history = Assert.Single(await fixture.Service.GetShiftHistoryAsync(date, default), item => item.Shift == shift);

        Assert.Equal(25, beforeClose.Summary.SaleCount);
        Assert.Equal(25, close.Cafeteria.SaleCount);
        Assert.Equal(62500m, close.Cafeteria.TotalSales);
        Assert.Equal(25, Assert.Single(close.Cafeteria.Items).Quantity);
        Assert.Equal(25, reloadedClose.Cafeteria.SaleCount);
        Assert.Equal(25, history.SaleCount);
        Assert.Equal(2, previousSummary.SaleCount);
        Assert.Equal(27, await fixture.Db.CafeteriaSales.CountAsync());
        Assert.Equal(0, afterClose.Summary.SaleCount);
        Assert.Equal(0m, afterClose.Summary.TotalSales);
        Assert.Empty(afterClose.Summary.Items);

        var nextSale = await fixture.Service.RegisterSaleAsync(date.AddDays(1), default);
        Assert.Equal(1, nextSale.Summary.SaleCount);
        Assert.Equal(previousShift, nextSale.ActiveShift);
        Assert.Equal(25, (await fixture.Service.GetSummaryAsync(date, shift, default)).SaleCount);

        void AddSales(int count, DateOnly businessDate, string saleShift)
        {
            for (var index = 0; index < count; index++)
            {
                var sale = new CafeteriaSale { BusinessDate = businessDate, Shift = saleShift, CreatedAt = DateTime.UtcNow };
                sale.Items.Add(new CafeteriaSaleItem { CafeteriaProductId = product.Id, ProductName = product.Name, UnitPrice = product.Price });
                fixture.Db.CafeteriaSales.Add(sale);
            }
        }
    }

    [Fact]
    public async Task CoffeeSoldAfterAfternoonCloseStartsTheNextDayWithoutChangingTheClosedMorning()
    {
        await using var fixture = await TestFixture.CreateAsync();
        var date = new DateOnly(2026, 10, 7);
        await fixture.Service.CreateProductAsync(new CreateCafeteriaProductRequest("Café", 2500m), default);
        var cigarette = new CigaretteProduct { Name = "Marlboro Box", Price = 3500m, Stock = 10, CreatedAt = DateTime.UtcNow };
        fixture.Db.CigaretteProducts.Add(cigarette);
        await fixture.Db.SaveChangesAsync();
        var cigarettes = new CigaretteService(fixture.Db, fixture.Service);
        await fixture.Service.RegisterSaleAsync(date, default);
        await cigarettes.CloseShiftAsync(new CreateCigaretteShiftCloseRequest(date, "morning", [new CigaretteCloseItemRequest(cigarette.Id, 9)]), default);
        await fixture.Service.RegisterSaleAsync(date, default);
        await cigarettes.CloseShiftAsync(new CreateCigaretteShiftCloseRequest(date, "afternoon", [new CigaretteCloseItemRequest(cigarette.Id, 8)]), default);

        var nextSale = await fixture.Service.RegisterSaleAsync(date, default);
        var nextMorningClose = await cigarettes.CloseShiftAsync(
            new CreateCigaretteShiftCloseRequest(date.AddDays(1), "morning", [new CigaretteCloseItemRequest(cigarette.Id, 7)]), default);

        Assert.Equal("morning", nextSale.ActiveShift);
        Assert.Equal(1, nextSale.Summary.SaleCount);
        Assert.Equal(1, nextMorningClose.Cafeteria.SaleCount);
        Assert.Equal(1, (await fixture.Service.GetSummaryAsync(date, "morning", default)).SaleCount);
        Assert.Equal(1, (await fixture.Service.GetSummaryAsync(date, "afternoon", default)).SaleCount);
        Assert.Equal(0, (await fixture.Service.GetDashboardAsync(date.AddDays(1), default)).Summary.SaleCount);
    }

    private sealed class TestFixture : IAsyncDisposable
    {
        private readonly SqliteConnection connection;

        private TestFixture(SqliteConnection connection, RestaurantContext db)
        {
            this.connection = connection;
            Db = db;
            Service = new CafeteriaService(db);
        }

        public RestaurantContext Db { get; }
        public CafeteriaService Service { get; }

        public static async Task<TestFixture> CreateAsync()
        {
            var connection = new SqliteConnection("Data Source=:memory:");
            await connection.OpenAsync();
            var options = new DbContextOptionsBuilder<RestaurantContext>().UseSqlite(connection).Options;
            var db = new RestaurantContext(options);
            await db.Database.EnsureCreatedAsync();
            return new TestFixture(connection, db);
        }

        public async ValueTask DisposeAsync()
        {
            await Db.DisposeAsync();
            await connection.DisposeAsync();
        }
    }
}
