using System.Globalization;
using System.Net;
using System.Net.Http.Json;
using GestionMesas.Api;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace GestionMesas.Api.Tests;

public sealed class CigaretteCashTests
{
    private static readonly DateOnly Date = new(2026, 10, 30);

    [Fact]
    public async Task CashAccumulatesOnlyReservationsMinusPurchasesByPaymentMethodDayAndShift()
    {
        await using var fixture = await Fixture.CreateAsync();
        var service = fixture.Service;
        await service.CreatePurchaseAsync(new(fixture.ProductId, 2, Date, "morning", 100.15m, "cash"), default);
        await service.CloseShiftAsync(new(Date, "morning", [new(fixture.ProductId, 10)], CigaretteReservedCash: 250.25m, CigaretteReservedMercadoPago: 200.50m), default);
        await service.CreatePurchaseAsync(new(fixture.ProductId, 1, Date, "afternoon", 50.25m, "mercadoPago"), default);
        await service.CloseShiftAsync(new(Date, "afternoon", [new(fixture.ProductId, 10)], CigaretteReservedCash: 100m, CigaretteReservedMercadoPago: 50m), default);
        await service.CloseShiftAsync(new(Date.AddDays(1), "morning", [new(fixture.ProductId, 9)], CigaretteReservedCash: 80m), default);

        var cash = await fixture.Cash.GetAsync(Date, 1, 12, default);
        Assert.Equal(400m, cash.Totals.Sales);
        Assert.Equal(150.40m, cash.Totals.Purchases);
        Assert.Equal(430.25m, cash.Totals.ReservedCash);
        Assert.Equal(250.50m, cash.Totals.ReservedMercadoPago);
        Assert.Equal(330.10m, cash.Totals.CashBalance);
        Assert.Equal(200.25m, cash.Totals.MercadoPagoBalance);
        Assert.Equal(530.35m, cash.Totals.Balance);
        Assert.Equal(450.35m, cash.SelectedDay.Amounts.Balance);
        Assert.Equal(350.60m, cash.SelectedDay.Shifts[0].Amounts.Balance);
        Assert.Equal(99.75m, cash.SelectedDay.Shifts[1].Amounts.Balance);
        Assert.Equal(Date.AddDays(1), cash.Days[0].BusinessDate);
        Assert.Equal(0, cash.Totals.MissingReservations);
        Assert.Equal(0, cash.Totals.MissingPurchaseAmounts);
    }

    [Fact]
    public async Task EmptyCashAndPurchaseOnlyDaysRemainVisibleIncludingNegativeBalances()
    {
        await using var fixture = await Fixture.CreateAsync();
        var empty = await fixture.Cash.GetAsync(Date, 1, 12, default);
        Assert.Empty(empty.Days);
        Assert.Equal(0, empty.Totals.Balance);
        Assert.Equal(2, empty.SelectedDay.Shifts.Count);
        await fixture.Service.CreatePurchaseAsync(new(fixture.ProductId, 1, Date, "afternoon", 123.45m, "mercadoPago"), default);
        var cash = await fixture.Cash.GetAsync(Date, 1, 12, default);
        Assert.Single(cash.Days);
        Assert.Equal(-123.45m, cash.Totals.Balance);
        Assert.Equal(-123.45m, cash.Totals.MercadoPagoBalance);
        Assert.Equal(0, cash.Totals.ClosedShifts);
    }

    [Fact]
    public async Task LegacyAmountsRemainUnknownAndCanBeCompletedWithoutInventingFunds()
    {
        await using var fixture = await Fixture.CreateAsync();
        var purchase = await fixture.Service.CreatePurchaseAsync(new(fixture.ProductId, 1, Date, "morning"), default);
        var close = await fixture.Service.CloseShiftAsync(new(Date, "morning", [new(fixture.ProductId, 10)]), default);
        var entity = await fixture.Db.CigaretteShiftCloses.FindAsync(close.Id);
        entity!.CigaretteReservedCash = null;
        entity.CigaretteReservedMercadoPago = null;
        await fixture.Db.SaveChangesAsync();
        var cash = await fixture.Cash.GetAsync(Date, 1, 12, default);
        Assert.Equal(100, cash.Totals.Sales);
        Assert.Equal(0, cash.Totals.Balance);
        Assert.Equal(1, cash.Totals.MissingPurchaseAmounts);
        Assert.Equal(1, cash.Totals.MissingReservations);

        await fixture.Service.UpdatePurchaseAsync(purchase.Id, new(1, 20, "cash"), default);
        await fixture.Service.UpdateCloseAsync(close.Id, new([new(fixture.ProductId, 10)], CigaretteReservedCash: 60, CigaretteReservedMercadoPago: 40), default);
        cash = await fixture.Cash.GetAsync(Date, 1, 12, default);
        Assert.Equal(80, cash.Totals.Balance);
        Assert.Equal(0, cash.Totals.MissingPurchaseAmounts);
        Assert.Equal(0, cash.Totals.MissingReservations);
    }

    [Fact]
    public async Task CorrectingMovingAndDeletingClosesRecalculatesFundsWithoutDoubleCounting()
    {
        await using var fixture = await Fixture.CreateAsync();
        var purchase = await fixture.Service.CreatePurchaseAsync(new(fixture.ProductId, 2, Date, "morning", 30, "cash"), default);
        var close = await fixture.Service.CloseShiftAsync(new(Date, "morning", [new(fixture.ProductId, 10)], CigaretteReservedCash: 100, CigaretteReservedMercadoPago: 80), default);
        await fixture.Service.UpdateCloseAsync(close.Id, new([new(fixture.ProductId, 10)], CigaretteReservedCash: 120, CigaretteReservedMercadoPago: 40), default);
        await fixture.Service.UpdatePurchaseAsync(purchase.Id, new(2, 25, "mercadoPago"), default);
        var cash = await fixture.Cash.GetAsync(Date, 1, 12, default);
        Assert.Equal(135, cash.Totals.Balance);
        Assert.Equal(120, cash.Totals.CashBalance);
        Assert.Equal(15, cash.Totals.MercadoPagoBalance);

        var targetDate = Date.AddDays(-1);
        await fixture.Service.UpdateCloseAsync(close.Id, new([new(fixture.ProductId, 10)], BusinessDate: targetDate, Shift: "afternoon"), default);
        cash = await fixture.Cash.GetAsync(targetDate, 1, 12, default);
        Assert.Equal(135, cash.Totals.Balance);
        Assert.Equal(135, cash.SelectedDay.Shifts[1].Amounts.Balance);
        Assert.Single(cash.Days);
        await fixture.Service.DeleteCloseAsync(close.Id, default);
        cash = await fixture.Cash.GetAsync(targetDate, 1, 12, default);
        Assert.Equal(-25, cash.Totals.Balance);
        Assert.Equal(0, cash.Totals.Sales);
        await fixture.Service.DeletePurchaseAsync(purchase.Id, default);
        Assert.Equal(0, (await fixture.Cash.GetAsync(targetDate, 1, 12, default)).Totals.Balance);
    }

    [Fact]
    public async Task CorrectingStockWithoutReservationFieldsPreservesExistingReservation()
    {
        await using var fixture = await Fixture.CreateAsync();
        var close = await fixture.Service.CloseShiftAsync(new(Date, "morning", [new(fixture.ProductId, 9)], CigaretteReservedCash: 50, CigaretteReservedMercadoPago: 25), default);
        var corrected = await fixture.Service.UpdateCloseAsync(close.Id, new([new(fixture.ProductId, 8)]), default);
        Assert.Equal(200, corrected!.TotalSales);
        Assert.Equal(50, corrected.CigaretteReservedCash);
        Assert.Equal(25, corrected.CigaretteReservedMercadoPago);
        Assert.Equal(75, (await fixture.Cash.GetAsync(Date, 1, 12, default)).Totals.Balance);
    }

    [Fact]
    public async Task ConsolidatingIntoExistingCloseRejectsSourceWithCigaretteFunds()
    {
        await using var fixture = await Fixture.CreateAsync();
        var source = await fixture.Service.CloseShiftAsync(new(Date, "morning", [new(fixture.ProductId, 9)], CigaretteReservedCash: 10), default);
        var target = await fixture.Service.CloseShiftAsync(new(Date, "afternoon", [new(fixture.ProductId, 9)]), default);
        await Assert.ThrowsAsync<CigaretteValidationException>(() => fixture.Service.ConsolidateCloseAsync(source.Id, target.Id, default, Date, "afternoon"));
        Assert.Equal(10, (await fixture.Cash.GetAsync(Date, 1, 12, default)).Totals.Balance);
        Assert.Equal(2, await fixture.Db.CigaretteShiftCloses.CountAsync());
    }

    [Fact]
    public async Task RepairingToOpenSlotMovesCigaretteReservationWithTheClose()
    {
        await using var fixture = await Fixture.CreateAsync();
        var source = await fixture.Service.CloseShiftAsync(new(Date, "morning", [new(fixture.ProductId, 9)], CigaretteReservedMercadoPago: 80), default);
        await fixture.Service.ConsolidateCloseAsync(source.Id, null, default, Date.AddDays(-1), "afternoon");
        var cash = await fixture.Cash.GetAsync(Date.AddDays(-1), 1, 12, default);
        Assert.Equal(80, cash.SelectedDay.Shifts[1].Amounts.MercadoPagoBalance);
        Assert.Equal(80, cash.Totals.Balance);
        Assert.Single(cash.Days);
    }

    [Theory]
    [InlineData("-0.01")]
    [InlineData("0.001")]
    [InlineData("10000000000")]
    public async Task InvalidPurchaseOrReservationAmountsDoNotChangeStockOrCreateRecords(string input)
    {
        await using var fixture = await Fixture.CreateAsync();
        var invalid = decimal.Parse(input, CultureInfo.InvariantCulture);
        await Assert.ThrowsAsync<CigaretteValidationException>(() => fixture.Service.CreatePurchaseAsync(new(fixture.ProductId, 1, Date, "morning", invalid), default));
        await Assert.ThrowsAsync<CigaretteValidationException>(() => fixture.Service.CloseShiftAsync(new(Date, "morning", [new(fixture.ProductId, 9)], CigaretteReservedCash: invalid), default));
        await Assert.ThrowsAsync<CigaretteValidationException>(() => fixture.Service.CloseShiftAsync(new(Date, "morning", [new(fixture.ProductId, 9)], CigaretteReservedMercadoPago: invalid), default));
        Assert.Equal(10, (await fixture.Db.CigaretteProducts.FindAsync(fixture.ProductId))!.Stock);
        Assert.Empty(await fixture.Db.CigarettePurchases.ToListAsync());
        Assert.Empty(await fixture.Db.CigaretteShiftCloses.ToListAsync());
    }

    [Fact]
    public async Task CashPaginationDoesNotLimitAccumulatedTotalsOrSelectedDay()
    {
        await using var fixture = await Fixture.CreateAsync();
        for (var day = 0; day < 3; day++)
            await fixture.Service.CreatePurchaseAsync(new(fixture.ProductId, 1, Date.AddDays(day), "morning", 10), default);
        var cash = await fixture.Cash.GetAsync(Date.AddDays(2), 3, 1, default);
        Assert.Equal(-30, cash.Totals.Balance);
        Assert.Equal(-10, cash.SelectedDay.Amounts.Balance);
        Assert.Equal(Date, Assert.Single(cash.Days).BusinessDate);
        Assert.Equal(3, cash.TotalDays);
        Assert.Equal(3, (await fixture.Cash.GetAsync(Date, 99999, 1, default)).Page);
        await Assert.ThrowsAsync<CigaretteValidationException>(() => fixture.Cash.GetAsync(Date, int.MaxValue, 50, default));
    }

    [Fact]
    public async Task CashEndpointRequiresAuthenticationAndPersistsMoneyThroughHttp()
    {
        await using var host = await ApiTestHost.StartAsync();
        Assert.Equal(HttpStatusCode.Unauthorized, (await host.Client.GetAsync("/api/cigarettes/cash")).StatusCode);
        await host.SignInAsync();
        var productResponse = await host.Client.PostAsJsonAsync("/api/cigarettes/products", new CreateCigaretteProductRequest("Prueba caja", 100, 10));
        productResponse.EnsureSuccessStatusCode();
        var product = (await productResponse.Content.ReadFromJsonAsync<CigaretteProductResponse>())!;
        var closeResponse = await host.Client.PostAsJsonAsync("/api/cigarettes/closes", new CreateCigaretteShiftCloseRequest(Date, "morning", [new(product.Id, 9)], CigaretteReservedCash: 75.15m, CigaretteReservedMercadoPago: 24.85m));
        closeResponse.EnsureSuccessStatusCode();
        var cash = await host.Client.GetFromJsonAsync<CigaretteCashResponse>("/api/cigarettes/cash?date=2026-10-30");
        Assert.Equal(100, cash!.Totals.Balance);
        Assert.Equal(75.15m, cash.Totals.CashBalance);
        Assert.True((await host.Client.GetAsync("/api/cigarettes/cash")).Headers.CacheControl?.NoStore);
        Assert.Equal(HttpStatusCode.BadRequest, (await host.Client.GetAsync("/api/cigarettes/cash?page=0")).StatusCode);
    }

    private sealed class Fixture(SqliteConnection connection, RestaurantContext db, int productId) : IAsyncDisposable
    {
        public RestaurantContext Db { get; } = db;
        public CigaretteService Service { get; } = new(db);
        public CigaretteCashService Cash { get; } = new(db);
        public int ProductId { get; } = productId;

        public static async Task<Fixture> CreateAsync()
        {
            var connection = new SqliteConnection("Data Source=:memory:");
            await connection.OpenAsync();
            var db = new RestaurantContext(new DbContextOptionsBuilder<RestaurantContext>().UseSqlite(connection).Options);
            await db.Database.EnsureCreatedAsync();
            var product = new CigaretteProduct { Name = "Prueba", Price = 100, Stock = 10, CreatedAt = DateTime.UtcNow };
            db.CigaretteProducts.Add(product);
            await db.SaveChangesAsync();
            return new(connection, db, product.Id);
        }

        public async ValueTask DisposeAsync()
        {
            await Db.DisposeAsync();
            await connection.DisposeAsync();
        }
    }
}
