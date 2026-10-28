using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.RegularExpressions;
using GestionMesas.Api;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http.Metadata;
using Microsoft.AspNetCore.Routing;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace GestionMesas.Api.Tests;

public sealed class AuthenticationSecurityTests
{
    [Fact]
    public async Task EveryBusinessEndpointRejectsAnonymousRequestsBeforeExecuting()
    {
        await using var host = await ApiTestHost.StartAsync();
        var endpoints = host.Endpoints.OfType<RouteEndpoint>()
            .Where(endpoint => endpoint.RoutePattern.RawText!.StartsWith("/api")
                && endpoint.Metadata.GetMetadata<IAllowAnonymous>() is null).ToList();
        Assert.True(endpoints.Count > 40);
        foreach (var endpoint in endpoints)
        {
            var path = Regex.Replace(endpoint.RoutePattern.RawText!, @"\{[^}]+\}", "1");
            foreach (var method in endpoint.Metadata.GetMetadata<IHttpMethodMetadata>()!.HttpMethods)
            {
                using var request = new HttpRequestMessage(new HttpMethod(method), path);
                if (method is "POST" or "PUT" or "PATCH") request.Content = JsonContent.Create(new { });
                using var response = await host.Client.SendAsync(request);
                Assert.True(response.StatusCode == HttpStatusCode.Unauthorized, $"{method} {path} returned {response.StatusCode}");
                Assert.True(response.Headers.CacheControl?.NoStore);
            }
        }
        Assert.Equal(HttpStatusCode.Unauthorized, (await host.Client.GetAsync("/future-route")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await host.Client.GetAsync("/")).StatusCode);
        await host.SignInAsync();
        var state = await host.Client.GetFromJsonAsync<JsonElement>("/api/bootstrap");
        Assert.NotEmpty(state.GetProperty("products").EnumerateArray());
        Assert.NotEmpty(state.GetProperty("orders").EnumerateArray());
    }

    [Theory]
    [InlineData("demo-admin-token")]
    [InlineData("invalid")]
    [InlineData("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA")]
    [InlineData("eyJhbGciOiJub25lIn0.eyJyb2xlIjoiQWRtaW5pc3RyYXRvciJ9.")]
    public async Task ForgedTokensAndIdentityHeadersCannotGrantAccess(string token)
    {
        await using var host = await ApiTestHost.StartAsync();
        host.Client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        host.Client.DefaultRequestHeaders.Add("X-User", "admin");
        host.Client.DefaultRequestHeaders.Add("X-Role", "Administrator");
        Assert.Equal(HttpStatusCode.Unauthorized, (await host.Client.GetAsync("/api/bootstrap")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await host.Client.DeleteAsync("/api/products")).StatusCode);
    }

    [Fact]
    public async Task LoginIssuesUniqueExpiringTokensAndLogoutRevokesOnlyItsSession()
    {
        var clock = new TestClock();
        await using var host = await ApiTestHost.StartAsync(clock: clock);
        Assert.Equal(HttpStatusCode.Unauthorized, (await host.Client.PostAsJsonAsync("/api/login", new { username = "admin", password = "admin" })).StatusCode);
        var first = await host.SignInAsync();
        var second = await host.SignInAsync();
        Assert.NotEqual(first, second);
        await using (var scope = host.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<RestaurantContext>();
            var sessions = await db.UserSessions.ToListAsync();
            Assert.Equal(2, sessions.Count);
            Assert.DoesNotContain(sessions, session => session.TokenHash == first || session.TokenHash == second);
            Assert.All(sessions, session => Assert.Equal(clock.GetUtcNow().UtcDateTime.AddHours(12), session.ExpiresAt));
            Assert.True(UserPasswords.IsHashed((await db.Users.SingleAsync()).Password));
        }
        var current = await host.Client.GetFromJsonAsync<JsonElement>("/api/session");
        Assert.Equal("admin", current.GetProperty("user").GetProperty("username").GetString());
        Assert.False(current.GetProperty("user").TryGetProperty("password", out _));
        Assert.Equal(HttpStatusCode.NoContent, (await host.Client.PostAsync("/api/logout", null)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await host.Client.GetAsync("/api/bootstrap")).StatusCode);
        host.Client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", first);
        Assert.Equal(HttpStatusCode.OK, (await host.Client.GetAsync("/api/bootstrap")).StatusCode);
        clock.Advance(TimeSpan.FromHours(12));
        Assert.Equal(HttpStatusCode.Unauthorized, (await host.Client.GetAsync("/api/bootstrap")).StatusCode);
        await host.SignInAsync();
        await using var cleanup = host.Services.CreateAsyncScope();
        Assert.Single(await cleanup.ServiceProvider.GetRequiredService<RestaurantContext>().UserSessions.ToListAsync());
    }

    [Fact]
    public async Task AValidTokenInAQueryStringDoesNotAuthenticateTheRequest()
    {
        await using var host = await ApiTestHost.StartAsync();
        var token = await host.SignInAsync();
        host.Client.DefaultRequestHeaders.Authorization = null;
        Assert.Equal(HttpStatusCode.Unauthorized, (await host.Client.GetAsync($"/api/bootstrap?token={token}")).StatusCode);
        host.Client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        Assert.Equal(HttpStatusCode.OK, (await host.Client.GetAsync("/api/bootstrap")).StatusCode);
    }

    [Fact]
    public async Task ChangingPasswordOrDeletingUserInvalidatesExistingSessions()
    {
        await using var host = await ApiTestHost.StartAsync();
        await host.SignInAsync();
        await using (var scope = host.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<RestaurantContext>();
            var user = await db.Users.SingleAsync();
            user.Password = UserPasswords.Hash(user, "Another fictitious test password!");
            await db.SaveChangesAsync();
        }
        Assert.Equal(HttpStatusCode.Unauthorized, (await host.Client.GetAsync("/api/bootstrap")).StatusCode);
        await host.SignInAsync(password: "Another fictitious test password!");
        await using (var scope = host.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<RestaurantContext>();
            db.Users.Remove(await db.Users.SingleAsync());
            await db.SaveChangesAsync();
        }
        Assert.Equal(HttpStatusCode.Unauthorized, (await host.Client.GetAsync("/api/bootstrap")).StatusCode);
    }

    [Fact]
    public async Task AuthenticatedUserWithoutRequiredRoleCannotReadOrWriteBusinessData()
    {
        await using var host = await ApiTestHost.StartAsync();
        await host.SignInAsync();
        await using (var scope = host.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<RestaurantContext>();
            var user = await db.Users.SingleAsync();
            user.Role = "Viewer";
            await db.SaveChangesAsync();
        }
        Assert.Equal(HttpStatusCode.Forbidden, (await host.Client.GetAsync("/api/bootstrap")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await host.Client.DeleteAsync("/api/products")).StatusCode);
    }

    [Fact]
    public async Task LoginIsRateLimitedAndDoesNotAcceptNullOrOversizedCredentials()
    {
        await using var host = await ApiTestHost.StartAsync();
        for (var attempt = 0; attempt < 10; attempt++)
        {
            using var response = await host.Client.PostAsJsonAsync("/api/login", new { username = (string?)null, password = new string('a', 1025) });
            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }
        Assert.Equal(HttpStatusCode.TooManyRequests, (await host.Client.PostAsJsonAsync("/api/login", new { username = "admin", password = ApiTestHost.AdminPassword })).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await host.Client.GetAsync("/")).StatusCode);
    }

    [Fact]
    public async Task DeployedFrontendCanPreflightAuthenticatedRequestsAndOtherOriginsCannot()
    {
        const string frontend = "https://gestion-mesas-shop.vercel.app";
        await using var host = await ApiTestHost.StartAsync(frontend, environment: "Production");
        foreach (var origin in new[] { frontend, "https://untrusted.example" })
        {
            using var request = new HttpRequestMessage(HttpMethod.Options, "/api/settings/welcome-message");
            request.Headers.Add("Origin", origin);
            request.Headers.Add("Access-Control-Request-Method", "PUT");
            request.Headers.Add("Access-Control-Request-Headers", "content-type,authorization");
            using var response = await host.Client.SendAsync(request);
            Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
            if (origin == frontend)
            {
                Assert.Equal(frontend, Assert.Single(response.Headers.GetValues("Access-Control-Allow-Origin")));
                Assert.Contains("authorization", string.Join(',', response.Headers.GetValues("Access-Control-Allow-Headers")), StringComparison.OrdinalIgnoreCase);
            }
            else Assert.False(response.Headers.Contains("Access-Control-Allow-Origin"));
        }
        await host.SignInAsync();
        using var get = new HttpRequestMessage(HttpMethod.Get, "/api/bootstrap");
        get.Headers.Add("Origin", frontend);
        using var data = await host.Client.SendAsync(get);
        Assert.Equal(HttpStatusCode.OK, data.StatusCode);
        Assert.Equal(frontend, Assert.Single(data.Headers.GetValues("Access-Control-Allow-Origin")));
    }

    [Fact]
    public async Task ExistingSqliteSchemaUpgradesPasswordsAndSessionsWithoutLosingBusinessData()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        var options = new DbContextOptionsBuilder<RestaurantContext>().UseSqlite(connection).Options;
        await using var db = new RestaurantContext(options);
        await db.Database.EnsureCreatedAsync();
        // Recreate the legacy Users table without Role, with the original plaintext password.
        await db.Database.ExecuteSqlRawAsync("""
            DROP TABLE "UserSessions";
            DROP TABLE "Users";
            CREATE TABLE "Users" ("Id" INTEGER PRIMARY KEY, "Username" TEXT NOT NULL, "Password" TEXT NOT NULL, "Name" TEXT NOT NULL);
            INSERT INTO "Users" VALUES (1, 'admin', 'admin', 'Administrador');
            """);
        db.Tables.Add(new RestaurantTable { Name = "Mesa existente" });
        await db.SaveChangesAsync();
        DatabaseInitializer.Initialize(db);
        var missing = new ConfigurationBuilder().Build();
        Assert.Throws<InvalidOperationException>(() => AuthenticationBootstrap.Initialize(db, missing));
        var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> { ["Authentication:AdminPassword"] = ApiTestHost.AdminPassword }).Build();
        AuthenticationBootstrap.Initialize(db, config);
        var user = await db.Users.SingleAsync();
        var hash = user.Password;
        Assert.True(UserPasswords.IsHashed(hash));
        Assert.Equal(Microsoft.AspNetCore.Identity.PasswordVerificationResult.Success, UserPasswords.Verify(user, ApiTestHost.AdminPassword));
        Assert.Equal("Administrator", user.Role);
        DatabaseInitializer.Initialize(db);
        AuthenticationBootstrap.Initialize(db, config);
        Assert.Equal(hash, user.Password);
        Assert.Equal("Mesa existente", (await db.Tables.SingleAsync()).Name);
        Assert.Empty(await db.UserSessions.ToListAsync());
    }

    [Fact]
    public async Task LegacyCustomPasswordIsHashedWithoutChangingCredentials()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        await using var db = new RestaurantContext(new DbContextOptionsBuilder<RestaurantContext>().UseSqlite(connection).Options);
        await db.Database.EnsureCreatedAsync();
        db.Users.Add(new User { Username = "operator", Password = "Existing private credential", Name = "Operador existente" });
        await db.SaveChangesAsync();
        AuthenticationBootstrap.Initialize(db, new ConfigurationBuilder().Build());
        Assert.Equal(Microsoft.AspNetCore.Identity.PasswordVerificationResult.Success,
            UserPasswords.Verify(await db.Users.SingleAsync(), "Existing private credential"));
    }

    [Theory]
    [InlineData("x")]
    [InlineData("clave8")]
    public async Task AdminCanSignInWithAPasswordShorterThanFourteenCharacters(string password)
    {
        await using var host = await ApiTestHost.StartAsync(adminPassword: password);
        await host.SignInAsync(password: password);
        Assert.Equal(HttpStatusCode.OK, (await host.Client.GetAsync("/api/bootstrap")).StatusCode);
        await using var scope = host.Services.CreateAsyncScope();
        var user = await scope.ServiceProvider.GetRequiredService<RestaurantContext>().Users.SingleAsync();
        Assert.True(UserPasswords.IsHashed(user.Password));
        Assert.NotEqual(password, user.Password);
    }

    [Theory]
    [InlineData("")]
    [InlineData("admin")]
    [InlineData("              ")]
    [InlineData("CHANGE_ME_TO_A_PRIVATE_PASSWORD")]
    public async Task BootstrapRejectsUnsafeAdminConfiguration(string password)
    {
        await using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        await using var db = new RestaurantContext(new DbContextOptionsBuilder<RestaurantContext>().UseSqlite(connection).Options);
        await db.Database.EnsureCreatedAsync();
        var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> { ["Authentication:AdminPassword"] = password }).Build();
        Assert.Throws<InvalidOperationException>(() => AuthenticationBootstrap.Initialize(db, config));
    }

    private sealed class TestClock : TimeProvider
    {
        private DateTimeOffset now = new(2026, 10, 27, 12, 0, 0, TimeSpan.Zero);
        public override DateTimeOffset GetUtcNow() => now;
        public void Advance(TimeSpan duration) => now += duration;
    }
}
