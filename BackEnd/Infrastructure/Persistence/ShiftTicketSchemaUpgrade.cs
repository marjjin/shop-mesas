using Microsoft.EntityFrameworkCore;

namespace GestionMesas.Api;

// Crea la tabla del diseño del ticket de cierre en bases ya existentes.
public static class ShiftTicketSchemaUpgrade
{
    public static void Apply(RestaurantContext db)
    {
        if (db.Database.IsSqlite())
            db.Database.ExecuteSqlRaw("""CREATE TABLE IF NOT EXISTS "ShiftTicketSettings" ("Id" INTEGER NOT NULL PRIMARY KEY, "Configuration" TEXT NOT NULL);""");
        else if (db.Database.IsNpgsql())
            db.Database.ExecuteSqlRaw("""CREATE TABLE IF NOT EXISTS "ShiftTicketSettings" ("Id" integer PRIMARY KEY, "Configuration" text NOT NULL);""");
    }
}
