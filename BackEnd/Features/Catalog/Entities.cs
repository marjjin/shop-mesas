namespace GestionMesas.Api;

public class Category
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string Color { get; set; } = "#e56743";
}

public class Product
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public decimal Price { get; set; }
    public int CategoryId { get; set; }
}
