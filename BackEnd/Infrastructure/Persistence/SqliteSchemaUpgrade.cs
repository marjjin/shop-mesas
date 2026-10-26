using Microsoft.EntityFrameworkCore;

namespace GestionMesas.Api;

public static class SqliteSchemaUpgrade
{
    public static void Apply(RestaurantContext db)
    {
        db.Database.ExecuteSqlRaw("""
            CREATE TABLE IF NOT EXISTS "CafeteriaProducts" ("Id" INTEGER PRIMARY KEY AUTOINCREMENT, "Name" TEXT NOT NULL, "Price" TEXT NOT NULL, "IsActive" INTEGER NOT NULL, "CreatedAt" TEXT NOT NULL);
            CREATE UNIQUE INDEX IF NOT EXISTS "IX_CafeteriaProducts_Name" ON "CafeteriaProducts" ("Name");
            CREATE TABLE IF NOT EXISTS "CafeteriaSales" ("Id" INTEGER PRIMARY KEY AUTOINCREMENT, "BusinessDate" TEXT NOT NULL, "Shift" TEXT NOT NULL, "CreatedAt" TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS "CafeteriaSaleItems" ("Id" INTEGER PRIMARY KEY AUTOINCREMENT, "CafeteriaSaleId" INTEGER NOT NULL REFERENCES "CafeteriaSales" ("Id") ON DELETE CASCADE, "CafeteriaProductId" INTEGER NOT NULL, "ProductName" TEXT NOT NULL, "UnitPrice" TEXT NOT NULL);
            """);
        if (!SqliteColumnExists(db, "CafeteriaSales", "BusinessDate"))
            db.Database.ExecuteSqlRaw("""ALTER TABLE "CafeteriaSales" ADD COLUMN "BusinessDate" TEXT NOT NULL DEFAULT '0001-01-01';""");
        if (!SqliteColumnExists(db, "CafeteriaSales", "Shift"))
            db.Database.ExecuteSqlRaw("""ALTER TABLE "CafeteriaSales" ADD COLUMN "Shift" TEXT NOT NULL DEFAULT 'morning';""");
        db.Database.ExecuteSqlRaw("""
            UPDATE "CafeteriaSales"
            SET "Shift" = COALESCE(
                (SELECT shiftClose."Shift" FROM "CigaretteShiftCloses" AS shiftClose
                 WHERE shiftClose."BusinessDate" = date("CafeteriaSales"."CreatedAt")
                   AND "CafeteriaSales"."CreatedAt" <= shiftClose."ClosedAt"
                 ORDER BY shiftClose."ClosedAt" LIMIT 1),
                CASE WHEN EXISTS (
                    SELECT 1 FROM "CigaretteShiftCloses" AS shiftClose
                    WHERE shiftClose."BusinessDate" = date("CafeteriaSales"."CreatedAt")
                      AND shiftClose."Shift" = 'morning'
                      AND shiftClose."ClosedAt" < "CafeteriaSales"."CreatedAt"
                ) THEN 'afternoon' ELSE 'morning' END)
            WHERE "BusinessDate" = '0001-01-01';
            """);
        db.Database.ExecuteSqlRaw("""UPDATE "CafeteriaSales" SET "BusinessDate" = date("CreatedAt") WHERE "BusinessDate" = '0001-01-01';""");
        db.Database.ExecuteSqlRaw("""CREATE INDEX IF NOT EXISTS "IX_CafeteriaSales_BusinessDate_Shift" ON "CafeteriaSales" ("BusinessDate", "Shift");""");
        db.Database.ExecuteSqlRaw("""
            CREATE TABLE IF NOT EXISTS "Suppliers" ("Id" INTEGER PRIMARY KEY AUTOINCREMENT, "Name" TEXT NOT NULL, "ReservedBalance" TEXT NOT NULL DEFAULT '0', "ReservedCashBalance" TEXT NOT NULL DEFAULT '0', "ReservedMercadoPagoBalance" TEXT NOT NULL DEFAULT '0', "CurrentAccountBalance" TEXT NOT NULL DEFAULT '0', "IsSeparateCashBox" INTEGER NOT NULL DEFAULT 0, "IsActive" INTEGER NOT NULL DEFAULT 1, "CreatedAt" TEXT NOT NULL);
            CREATE UNIQUE INDEX IF NOT EXISTS "IX_Suppliers_Name" ON "Suppliers" ("Name");
            CREATE TABLE IF NOT EXISTS "SupplierTransactions" ("Id" INTEGER PRIMARY KEY AUTOINCREMENT, "SupplierId" INTEGER NOT NULL REFERENCES "Suppliers" ("Id"), "CigaretteShiftCloseId" INTEGER NULL REFERENCES "CigaretteShiftCloses" ("Id") ON DELETE CASCADE, "Type" TEXT NOT NULL, "Amount" TEXT NOT NULL, "CashAmount" TEXT NOT NULL DEFAULT '0', "MercadoPagoAmount" TEXT NOT NULL DEFAULT '0', "BusinessDate" TEXT NOT NULL, "Note" TEXT NULL, "CreatedAt" TEXT NOT NULL);
            CREATE UNIQUE INDEX IF NOT EXISTS "IX_SupplierTransactions_SupplierId_CigaretteShiftCloseId" ON "SupplierTransactions" ("SupplierId", "CigaretteShiftCloseId");
            CREATE TABLE IF NOT EXISTS "CashDrops" ("Id" INTEGER PRIMARY KEY AUTOINCREMENT, "Amount" TEXT NOT NULL, "BusinessDate" TEXT NOT NULL, "Shift" TEXT NOT NULL, "CreatedAt" TEXT NOT NULL, "CigaretteShiftCloseId" INTEGER NULL REFERENCES "CigaretteShiftCloses" ("Id") ON DELETE SET NULL);
            CREATE INDEX IF NOT EXISTS "IX_CashDrops_BusinessDate_Shift" ON "CashDrops" ("BusinessDate", "Shift");
            """);
        if (!SqliteColumnExists(db, "Suppliers", "ReservedBalance"))
        {
            db.Database.ExecuteSqlRaw("""ALTER TABLE "Suppliers" ADD COLUMN "ReservedBalance" TEXT NOT NULL DEFAULT '0';""");
            db.Database.ExecuteSqlRaw("""UPDATE "Suppliers" SET "ReservedBalance" = "Balance";""");
        }
        if (!SqliteColumnExists(db, "Suppliers", "CurrentAccountBalance"))
            db.Database.ExecuteSqlRaw("""ALTER TABLE "Suppliers" ADD COLUMN "CurrentAccountBalance" TEXT NOT NULL DEFAULT '0';""");
        if (!SqliteColumnExists(db, "Suppliers", "ReservedCashBalance"))
        {
            db.Database.ExecuteSqlRaw("""ALTER TABLE "Suppliers" ADD COLUMN "ReservedCashBalance" TEXT NOT NULL DEFAULT '0';""");
            db.Database.ExecuteSqlRaw("""UPDATE "Suppliers" SET "ReservedCashBalance" = "ReservedBalance";""");
        }
        if (!SqliteColumnExists(db, "Suppliers", "ReservedMercadoPagoBalance"))
            db.Database.ExecuteSqlRaw("""ALTER TABLE "Suppliers" ADD COLUMN "ReservedMercadoPagoBalance" TEXT NOT NULL DEFAULT '0';""");
        if (!SqliteColumnExists(db, "Suppliers", "IsSeparateCashBox"))
            db.Database.ExecuteSqlRaw("""ALTER TABLE "Suppliers" ADD COLUMN "IsSeparateCashBox" INTEGER NOT NULL DEFAULT 0;""");
        if (!SqliteColumnExists(db, "SupplierTransactions", "CashAmount"))
        {
            db.Database.ExecuteSqlRaw("""ALTER TABLE "SupplierTransactions" ADD COLUMN "CashAmount" TEXT NOT NULL DEFAULT '0';""");
            db.Database.ExecuteSqlRaw("""UPDATE "SupplierTransactions" SET "CashAmount" = "Amount" WHERE "Type" IN ('allocation', 'cash_purchase', 'reserved_purchase', 'payment', 'reserved_transfer_in', 'reserved_transfer_out', 'reserved_adjustment');""");
        }
        if (!SqliteColumnExists(db, "SupplierTransactions", "MercadoPagoAmount"))
            db.Database.ExecuteSqlRaw("""ALTER TABLE "SupplierTransactions" ADD COLUMN "MercadoPagoAmount" TEXT NOT NULL DEFAULT '0';""");
        if (!SqliteColumnExists(db, "CigaretteShiftCloses", "EndingCashBalance"))
            db.Database.ExecuteSqlRaw("""ALTER TABLE "CigaretteShiftCloses" ADD COLUMN "EndingCashBalance" TEXT NOT NULL DEFAULT '0';""");
        if (!SqliteColumnExists(db, "CigaretteShiftCloses", "EndingMercadoPagoBalance"))
            db.Database.ExecuteSqlRaw("""ALTER TABLE "CigaretteShiftCloses" ADD COLUMN "EndingMercadoPagoBalance" TEXT NOT NULL DEFAULT '0';""");
        if (!SqliteColumnExists(db, "CigaretteShiftCloses", "NextShiftChangeCash"))
            db.Database.ExecuteSqlRaw("""ALTER TABLE "CigaretteShiftCloses" ADD COLUMN "NextShiftChangeCash" TEXT NOT NULL DEFAULT '0';""");
        if (!SqliteColumnExists(db, "CigaretteShiftCloses", "ReceivedChangeCash"))
            db.Database.ExecuteSqlRaw("""ALTER TABLE "CigaretteShiftCloses" ADD COLUMN "ReceivedChangeCash" TEXT NOT NULL DEFAULT '0';""");
        if (!SqliteColumnExists(db, "CigaretteShiftCloses", "PosnetTotal"))
            db.Database.ExecuteSqlRaw("""ALTER TABLE "CigaretteShiftCloses" ADD COLUMN "PosnetTotal" TEXT NOT NULL DEFAULT '0';""");
    }

    private static bool SqliteColumnExists(RestaurantContext db, string table, string column)
    {
        var connection = db.Database.GetDbConnection();
        var wasOpen = connection.State == System.Data.ConnectionState.Open;
        if (!wasOpen) connection.Open();
        try
        {
            using var command = connection.CreateCommand();
            command.CommandText = $"PRAGMA table_info(\"{table}\")";
            using var reader = command.ExecuteReader();
            while (reader.Read())
                if (string.Equals(reader.GetString(1), column, StringComparison.OrdinalIgnoreCase))
                    return true;
            return false;
        }
        finally
        {
            if (!wasOpen) connection.Close();
        }
    }

}
