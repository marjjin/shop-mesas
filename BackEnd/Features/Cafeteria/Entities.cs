// Tablas de Caja Cafetería.
namespace GestionMesas.Api;

public class CafeteriaProduct
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public decimal Price { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; }
}

// Una venta rápida: incluye una unidad de cada artículo activo.
public class CafeteriaSale
{
    public int Id { get; set; }
    public DateOnly BusinessDate { get; set; }
    public string Shift { get; set; } = "morning";
    public DateTime CreatedAt { get; set; }
    public List<CafeteriaSaleItem> Items { get; set; } = [];
}

// Copia nombre y precio: cambiarlos no altera las ventas registradas.
public class CafeteriaSaleItem
{
    public int Id { get; set; }
    public int CafeteriaSaleId { get; set; }
    public int CafeteriaProductId { get; set; }
    public string ProductName { get; set; } = "";
    public decimal UnitPrice { get; set; }
}
