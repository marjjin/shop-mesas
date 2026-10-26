namespace GestionMesas.Api;

internal static class CigaretteMapping
{
    public static CigaretteProductResponse ToResponse(CigaretteProduct product) => new(product.Id, product.Name, product.Price, product.Stock);

    public static CigarettePurchaseResponse ToResponse(CigarettePurchase purchase, string productName) => new(purchase.Id, purchase.CigaretteProductId, productName, purchase.Quantity, purchase.BusinessDate, purchase.Shift, new DateTimeOffset(purchase.CreatedAt, TimeSpan.Zero));
}
