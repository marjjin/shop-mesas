namespace GestionMesas.Api;

public static class DemoDataSeeder
{
    public static void Seed(RestaurantContext db)
    {
        if (!db.Users.Any())
        {
            var now = DateTime.UtcNow;
            db.Users.Add(new User { Username = "admin", Password = "admin", Name = "Administrador" });
            db.Categories.AddRange(new Category { Name = "Bebidas", Color = "#2f80ed" }, new Category { Name = "Cocina", Color = "#f2994a" }, new Category { Name = "Postres", Color = "#9b51e0" });
            db.SaveChanges();
            db.Products.AddRange(new Product { Name = "Café espresso", Price = 1800, CategoryId = 1 }, new Product { Name = "Limonada", Price = 2500, CategoryId = 1 }, new Product { Name = "Hamburguesa clásica", Price = 7800, CategoryId = 2 }, new Product { Name = "Papas rústicas", Price = 3200, CategoryId = 2 }, new Product { Name = "Brownie con helado", Price = 4200, CategoryId = 3 });
            db.Tables.AddRange(new RestaurantTable { Name = "Mesa 1", Seats = 2, X = 10, Y = 15 }, new RestaurantTable { Name = "Mesa 2", Seats = 4, X = 235, Y = 15, Status = "occupied", OpenedAt = now.AddMinutes(-42), LastConsumptionAt = now.AddMinutes(-12) }, new RestaurantTable { Name = "Mesa 3", Seats = 4, X = 460, Y = 15 }, new RestaurantTable { Name = "Mesa 4", Seats = 6, X = 120, Y = 185, Width = 150, Height = 106, Status = "occupied", OpenedAt = now.AddMinutes(-95), LastConsumptionAt = now.AddMinutes(-47) }, new RestaurantTable { Name = "Mesa 5", Seats = 2, X = 380, Y = 200 });
            db.SaveChanges();
            db.Orders.AddRange(new Order { TableId = 2, ProductId = 3, Quantity = 2, CreatedAt = now.AddMinutes(-12) }, new Order { TableId = 2, ProductId = 2, Quantity = 2, CreatedAt = now.AddMinutes(-12) }, new Order { TableId = 4, ProductId = 1, Quantity = 3, CreatedAt = now.AddMinutes(-47) });
            db.SaveChanges();
        }
    }
}
