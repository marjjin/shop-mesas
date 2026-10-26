using Microsoft.EntityFrameworkCore;

namespace GestionMesas.Api;

public static class CatalogEndpoints
{
    public static RouteGroupBuilder MapCatalogEndpoints(this RouteGroupBuilder api)
    {
        api.MapPost("/categories", CreateCategoryAsync);
        api.MapDelete("/categories/{id:int}", DeleteCategoryAsync);
        api.MapPost("/products", CreateProductAsync);
        api.MapDelete("/products", DeleteProductsAsync);
        api.MapDelete("/products/{id:int}", DeleteProductAsync);
        return api;
    }

    private static async Task<IResult> CreateCategoryAsync(CategoryRequest request, RestaurantContext db)
    {
        var category = new Category {
            Name = request.Name, Color = request.Color ?? "#e56743"
        };
        db.Categories.Add(category);
        await db.SaveChangesAsync();
        return Results.Created($"/api/categories/{category.Id}", category);
    }

    private static async Task<IResult> DeleteCategoryAsync(int id, RestaurantContext db)
    {
        var category = await db.Categories.FindAsync(id);
        if (category is null) return Results.NotFound();
        if (category.Name == CoworkingBilling.CategoryName) return Results.Conflict();
        var productIds = await db.Products.Where(product => product.CategoryId == id).Select(product => product.Id).ToListAsync();
        db.Orders.RemoveRange(db.Orders.Where(order => productIds.Contains(order.ProductId)));
        db.PendingOrderItems.RemoveRange(db.PendingOrderItems.Where(item => productIds.Contains(item.ProductId)));
        db.Products.RemoveRange(db.Products.Where(product => product.CategoryId == id));
        db.Categories.Remove(category);
        await db.SaveChangesAsync();
        return Results.NoContent();
    }

    private static async Task<IResult> CreateProductAsync(ProductRequest request, RestaurantContext db)
    {
        if (string.IsNullOrWhiteSpace(request.Name) || request.Name is CoworkingBilling.HalfHourProductName or CoworkingBilling.HourProductName) return Results.BadRequest();
        var category = await db.Categories.FirstOrDefaultAsync(item => item.Name == "Artículos");
        if (category is null) {
            category = new Category {
                Name = "Artículos", Color = "#e56743"
            };
            db.Categories.Add(category);
            await db.SaveChangesAsync();
        }
        var product = new Product {
            Name = request.Name.Trim(), Price = 0, CategoryId = category.Id
        };
        db.Products.Add(product);
        await db.SaveChangesAsync();
        return Results.Created($"/api/products/{product.Id}", product);
    }

    private static async Task<IResult> DeleteProductsAsync(RestaurantContext db)
    {
        var productIds = await db.Products.Where(product => product.Name != CoworkingBilling.HalfHourProductName && product.Name != CoworkingBilling.HourProductName).Select(product => product.Id).ToListAsync();
        db.Orders.RemoveRange(db.Orders.Where(order => productIds.Contains(order.ProductId)));
        db.PendingOrderItems.RemoveRange(db.PendingOrderItems.Where(item => productIds.Contains(item.ProductId)));
        db.Products.RemoveRange(db.Products.Where(product => productIds.Contains(product.Id)));
        await db.SaveChangesAsync();
        return Results.NoContent();
    }

    private static async Task<IResult> DeleteProductAsync(int id, RestaurantContext db)
    {
        var product = await db.Products.FindAsync(id);
        if (product is null) return Results.NotFound();
        if (product.Name is CoworkingBilling.HalfHourProductName or CoworkingBilling.HourProductName) return Results.Conflict();
        db.Orders.RemoveRange(db.Orders.Where(order => order.ProductId == id));
        db.PendingOrderItems.RemoveRange(db.PendingOrderItems.Where(item => item.ProductId == id));
        db.Products.Remove(product);
        await db.SaveChangesAsync();
        return Results.NoContent();
    }
}
