using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using GestionMesas.Api;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace GestionMesas.Api.Tests;

public sealed class AdminCredentialChangeTests
{
    [Theory]
    [InlineData("Testing")]
    [InlineData("Production")]
    public async Task InitialConfiguredUsernameUsesTheSeededAccount(string environment)
    {
        await using var host = await ApiTestHost.StartAsync(environment: environment, adminUsername: "shopfamily");
        Assert.Equal(HttpStatusCode.Unauthorized, (await host.Client.PostAsJsonAsync("/api/login", new { username = "admin", password = ApiTestHost.AdminPassword })).StatusCode);
        await host.SignInAsync(username: "shopfamily");
        Assert.Equal(HttpStatusCode.OK, (await host.Client.GetAsync("/api/bootstrap")).StatusCode);
        await using var scope = host.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<RestaurantContext>();
        var user = await db.Users.SingleAsync();
        Assert.Equal(1, user.Id);
        Assert.Equal("shopfamily", user.Username);
        Assert.Equal("Administrator", user.Role);
    }

    [Theory]
    [InlineData("Testing")]
    [InlineData("Production")]
    public async Task RenamingKeepsAccountPasswordAndBusinessDataAndRevokesOldSessions(string environment)
    {
        await using var host = await ApiTestHost.StartAsync(environment: environment);
        await host.SignInAsync();
        string originalHash;
        int userId;
        await using (var scope = host.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<RestaurantContext>();
            var user = await db.Users.SingleAsync();
            userId = user.Id;
            originalHash = user.Password;
            db.Suppliers.Add(new Supplier { Name = "Proveedor conservado", ReservedCashBalance = 500m, ReservedBalance = 500m });
            db.CafeteriaSales.Add(new CafeteriaSale { BusinessDate = new DateOnly(2026, 10, 28), Shift = "morning", CreatedAt = DateTime.UtcNow,
                Items = [new CafeteriaSaleItem { ProductName = "Café", UnitPrice = 2500m }] });
            db.CigaretteShiftCloses.Add(new CigaretteShiftClose { BusinessDate = new DateOnly(2026, 10, 27), Shift = "afternoon", ClosedAt = DateTime.UtcNow });
            await db.SaveChangesAsync();
            AuthenticationBootstrap.Initialize(db, Configuration(username: "  shopfamily  "));
            Assert.Equal(originalHash, user.Password);
            Assert.Equal(userId, user.Id);
            Assert.Equal("shopfamily", user.Username);
            Assert.Empty(await db.UserSessions.ToListAsync());
            Assert.Equal(5, await db.Tables.CountAsync());
            Assert.Equal(3, await db.Orders.CountAsync());
            Assert.Single(await db.CafeteriaSales.ToListAsync());
            Assert.Single(await db.CigaretteShiftCloses.ToListAsync());
            Assert.Equal(500m, (await db.Suppliers.SingleAsync()).ReservedBalance);
        }
        Assert.Equal(HttpStatusCode.Unauthorized, (await host.Client.GetAsync("/api/bootstrap")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await host.Client.PostAsJsonAsync("/api/login", new { username = "admin", password = ApiTestHost.AdminPassword })).StatusCode);
        await host.SignInAsync(username: "shopfamily");
        var session = await host.Client.GetFromJsonAsync<JsonElement>("/api/session");
        Assert.Equal(userId, session.GetProperty("user").GetProperty("id").GetInt32());
        Assert.Equal("shopfamily", session.GetProperty("user").GetProperty("username").GetString());

        // Repeated starts with the same settings must preserve both the account and its current session.
        await using (var scope = host.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<RestaurantContext>();
            AuthenticationBootstrap.Initialize(db, Configuration(username: "shopfamily", password: ApiTestHost.AdminPassword));
            AuthenticationBootstrap.Initialize(db, new ConfigurationBuilder().Build());
            var user = await db.Users.SingleAsync();
            Assert.Equal(userId, user.Id);
            Assert.Equal(originalHash, user.Password);
            Assert.Equal("shopfamily", user.Username);
            Assert.Single(await db.UserSessions.ToListAsync());
        }
        Assert.Equal(HttpStatusCode.OK, (await host.Client.GetAsync("/api/bootstrap")).StatusCode);
    }

    [Fact]
    public async Task PasswordCanBeRotatedAfterRenamingWithoutResettingTheUsername()
    {
        await using var host = await ApiTestHost.StartAsync(adminUsername: "shopfamily");
        await host.SignInAsync(username: "shopfamily");
        await using (var scope = host.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<RestaurantContext>();
            AuthenticationBootstrap.Initialize(db, Configuration(password: "nueva"));
            Assert.Equal("shopfamily", (await db.Users.SingleAsync()).Username);
            Assert.Empty(await db.UserSessions.ToListAsync());
        }
        Assert.Equal(HttpStatusCode.Unauthorized, (await host.Client.GetAsync("/api/bootstrap")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await host.Client.PostAsJsonAsync("/api/login", new { username = "shopfamily", password = ApiTestHost.AdminPassword })).StatusCode);
        await host.SignInAsync(username: "shopfamily", password: "nueva");
        Assert.Equal(HttpStatusCode.OK, (await host.Client.GetAsync("/api/bootstrap")).StatusCode);
    }

    [Fact]
    public async Task AUsernameOwnedByAnotherAccountIsRejectedWithoutChangingCredentialsOrSessions()
    {
        await using var host = await ApiTestHost.StartAsync();
        await host.SignInAsync();
        await using (var scope = host.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<RestaurantContext>();
            var admin = await db.Users.SingleAsync();
            var hash = admin.Password;
            db.Users.Add(new User { Username = "otro", Name = "Otra cuenta", Role = "Viewer", Password = "legacy fixture" });
            await db.SaveChangesAsync();
            Assert.Throws<InvalidOperationException>(() => AuthenticationBootstrap.Initialize(db, Configuration(username: "OTRO", password: "nueva")));
            Assert.Equal("admin", admin.Username);
            Assert.Equal(hash, admin.Password);
            Assert.Single(await db.UserSessions.ToListAsync());
            db.ChangeTracker.Clear();
            Assert.Equal("admin", (await db.Users.SingleAsync(user => user.Id == admin.Id)).Username);
        }
        Assert.Equal(HttpStatusCode.OK, (await host.Client.GetAsync("/api/bootstrap")).StatusCode);
    }

    [Fact]
    public async Task MultipleRenamedAdministratorsRequireAnExplicitAccountId()
    {
        await using var host = await ApiTestHost.StartAsync(adminUsername: "primero");
        await using var scope = host.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<RestaurantContext>();
        var first = await db.Users.SingleAsync();
        var second = new User { Username = "segundo", Name = "Segundo administrador" };
        second.Password = UserPasswords.Hash(second, "fixture");
        db.Users.Add(second);
        await db.SaveChangesAsync();
        var firstHash = first.Password;
        var secondHash = second.Password;
        Assert.Throws<InvalidOperationException>(() => AuthenticationBootstrap.Initialize(db, Configuration(username: "nuevo")));
        Assert.Equal("primero", first.Username);
        Assert.Equal("segundo", second.Username);
        AuthenticationBootstrap.Initialize(db, Configuration(username: "nuevo", userId: second.Id));
        Assert.Equal("primero", first.Username);
        Assert.Equal(firstHash, first.Password);
        Assert.Equal("nuevo", second.Username);
        Assert.Equal(secondHash, second.Password);
        Assert.Equal(2, await db.Users.CountAsync());
    }

    [Fact]
    public async Task InvalidUsernamesAndAccountIdsCannotChangeTheAdministrator()
    {
        await using var host = await ApiTestHost.StartAsync();
        await using var scope = host.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<RestaurantContext>();
        foreach (var username in new[] { "", "   ", "bad\nname", new string('x', 101) })
            Assert.Throws<InvalidOperationException>(() => AuthenticationBootstrap.Initialize(db, Configuration(username: username)));
        foreach (var userId in new[] { 0, -1, 99999 })
            Assert.Throws<InvalidOperationException>(() => AuthenticationBootstrap.Initialize(db, Configuration(username: "nuevo", userId: userId)));
        Assert.Equal("admin", (await db.Users.SingleAsync()).Username);
    }

    private static IConfiguration Configuration(string? username = null, string? password = null, int? userId = null) =>
        new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["Authentication:AdminUsername"] = username,
            ["Authentication:AdminPassword"] = password,
            ["Authentication:AdminUserId"] = userId?.ToString(System.Globalization.CultureInfo.InvariantCulture)
        }).Build();
}
