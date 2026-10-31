// Secuencia de arranque de la base. El proyecto no usa migraciones de EF: actualiza el esquema con SQL propio.
using Microsoft.EntityFrameworkCore;

namespace GestionMesas.Api;

public static class DatabaseInitializer
{
    // Se ejecuta en cada arranque, por eso cada paso debe poder repetirse sin dañar datos (idempotente).
    public static void Initialize(RestaurantContext db)
    {
        // Si la base no existe, la crea completa a partir del modelo actual.
        db.Database.EnsureCreated();
        // Los pasos siguientes agregan lo que le falte a una base creada con una versión anterior.
        WelcomeMessageConfiguration.EnsureSchema(db);
        if (db.Database.IsSqlite()) SqliteSchemaUpgrade.Apply(db);
        if (db.Database.IsNpgsql()) PostgresSchemaUpgrade.Apply(db);
        CigaretteCashSchemaUpgrade.Apply(db);
        InvoiceSchemaUpgrade.Apply(db);
        AuthenticationSchemaUpgrade.Apply(db);
        ShiftTicketSchemaUpgrade.Apply(db);
        // Último paso: solo carga datos de ejemplo si no hay usuarios.
        DemoDataSeeder.Seed(db);
    }
}
