using Microsoft.EntityFrameworkCore;

namespace GestionMesas.Api;

public static class AuthenticationSchemaUpgrade
{
    public static void Apply(RestaurantContext db)
    {
        if (db.Database.IsSqlite())
        {
            var connection = db.Database.GetDbConnection();
            var wasClosed = connection.State != System.Data.ConnectionState.Open;
            if (wasClosed) connection.Open();
            var hasRole = false;
            try
            {
                using var command = connection.CreateCommand();
                command.CommandText = """PRAGMA table_info("Users");""";
                using var reader = command.ExecuteReader();
                while (reader.Read()) hasRole |= reader.GetString(1) == "Role";
            }
            finally { if (wasClosed) connection.Close(); }
            if (!hasRole)
                db.Database.ExecuteSqlRaw("""ALTER TABLE "Users" ADD COLUMN "Role" TEXT NOT NULL DEFAULT 'Administrator';""");
            db.Database.ExecuteSqlRaw("""
                CREATE TABLE IF NOT EXISTS "UserSessions" (
                    "TokenHash" TEXT NOT NULL PRIMARY KEY,
                    "UserId" INTEGER NOT NULL,
                    "CredentialStamp" TEXT NOT NULL,
                    "ExpiresAt" TEXT NOT NULL,
                    FOREIGN KEY ("UserId") REFERENCES "Users" ("Id") ON DELETE CASCADE
                );
                """);
        }
        else if (db.Database.IsNpgsql())
        {
            db.Database.ExecuteSqlRaw("""ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS "Role" text NOT NULL DEFAULT 'Administrator';""");
            db.Database.ExecuteSqlRaw("""
                CREATE TABLE IF NOT EXISTS "UserSessions" (
                    "TokenHash" character varying(64) NOT NULL PRIMARY KEY,
                    "UserId" integer NOT NULL REFERENCES "Users" ("Id") ON DELETE CASCADE,
                    "CredentialStamp" character varying(64) NOT NULL,
                    "ExpiresAt" timestamp with time zone NOT NULL
                );
                """);
        }
        else return;
        db.Database.ExecuteSqlRaw("""CREATE INDEX IF NOT EXISTS "IX_UserSessions_UserId" ON "UserSessions" ("UserId");""");
        db.Database.ExecuteSqlRaw("""CREATE INDEX IF NOT EXISTS "IX_UserSessions_ExpiresAt" ON "UserSessions" ("ExpiresAt");""");
    }
}
