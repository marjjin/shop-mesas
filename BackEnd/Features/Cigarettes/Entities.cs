// Tablas del módulo de cigarrillos.
namespace GestionMesas.Api;

public class CigaretteProduct
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public decimal Price { get; set; }
    public int Stock { get; set; }
    // Baja lógica: false oculta el producto sin perder su historial.
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; }
}

public class CigarettePurchase
{
    public int Id { get; set; }
    public int CigaretteProductId { get; set; }
    public int Quantity { get; set; }
    public decimal UnitCost { get; set; }
    // Null en compras antiguas, previas a la Caja de cigarrillos.
    public decimal? TotalCost { get; set; }
    public string PaymentMethod { get; set; } = "cash";
    // Fecha de trabajo elegida por el operador. No siempre coincide con el calendario.
    public DateOnly BusinessDate { get; set; }
    public string Shift { get; set; } = "morning";
    public DateTime CreatedAt { get; set; }
}

// Cierre de turno: foto del arqueo y del stock al terminar mañana o tarde.
public class CigaretteShiftClose
{
    public int Id { get; set; }
    public DateOnly BusinessDate { get; set; }
    public string Shift { get; set; } = "morning";
    // Saldos contados al cerrar.
    public decimal EndingCashBalance { get; set; }
    public decimal EndingMercadoPagoBalance { get; set; }
    // Cambio que queda preparado para el turno siguiente.
    public decimal NextShiftChangeCash { get; set; }
    // Cambio recibido del turno anterior.
    public decimal ReceivedChangeCash { get; set; }
    public decimal PosnetTotal { get; set; }
    // Null en cierres antiguos, previos a la Caja de cigarrillos.
    public decimal? CigaretteReservedCash { get; set; }
    public decimal? CigaretteReservedMercadoPago { get; set; }
    public DateTime ClosedAt { get; set; }
    public List<CigaretteShiftCloseItem> Items { get; set; } = [];
}

// Una fila por producto. Copia nombre y precio para que corregirlos después no altere cierres pasados.
public class CigaretteShiftCloseItem
{
    public int Id { get; set; }
    public int CigaretteShiftCloseId { get; set; }
    public int CigaretteProductId { get; set; }
    public string ProductName { get; set; } = "";
    public decimal UnitPrice { get; set; }
    public int InitialStock { get; set; }
    public int PurchasedQuantity { get; set; }
    public int FinalStock { get; set; }
    public int SoldQuantity { get; set; }
    public decimal SalesAmount { get; set; }
}
