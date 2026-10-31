// Convierte entidades de base de datos en objetos de respuesta HTTP.
namespace GestionMesas.Api;

internal static class CigaretteMapping
{
    public static CigaretteProductResponse ToResponse(CigaretteProduct product) => new(product.Id, product.Name, product.Price, product.Stock);

    public static CigarettePurchasePaymentResponse ToResponse(CigarettePurchasePayment payment) => new(payment.BusinessDate, payment.Shift, payment.TotalCost, payment.PaymentMethod);

    public static CigarettePurchaseResponse ToResponse(CigarettePurchase purchase, string productName) => new(purchase.Id, purchase.CigaretteProductId, productName, purchase.Quantity, purchase.BusinessDate, purchase.Shift, new DateTimeOffset(purchase.CreatedAt, TimeSpan.Zero), purchase.TotalCost, purchase.PaymentMethod);
}
