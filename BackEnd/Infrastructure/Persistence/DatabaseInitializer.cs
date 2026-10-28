using Microsoft.EntityFrameworkCore;

namespace GestionMesas.Api;

public static class DatabaseInitializer
{
    public static void Initialize(RestaurantContext db)
    {
        db.Database.EnsureCreated();
        WelcomeMessageConfiguration.EnsureSchema(db);
        if (db.Database.IsSqlite()) SqliteSchemaUpgrade.Apply(db);
        if (db.Database.IsNpgsql()) PostgresSchemaUpgrade.Apply(db);
        AuthenticationSchemaUpgrade.Apply(db);
        DemoDataSeeder.Seed(db);
    }
}
