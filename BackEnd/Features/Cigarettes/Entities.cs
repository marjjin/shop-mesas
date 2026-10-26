namespace GestionMesas.Api;

public class CigaretteProduct
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public decimal Price { get; set; }
    public int Stock { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; }
}

public class CigarettePurchase
{
    public int Id { get; set; }
    public int CigaretteProductId { get; set; }
    public int Quantity { get; set; }
    public decimal UnitCost { get; set; }
    public DateOnly BusinessDate { get; set; }
    public string Shift { get; set; } = "morning";
    public DateTime CreatedAt { get; set; }
}

public class CigaretteShiftClose
{
    public int Id { get; set; }
    public DateOnly BusinessDate { get; set; }
    public string Shift { get; set; } = "morning";
    public decimal EndingCashBalance { get; set; }
    public decimal EndingMercadoPagoBalance { get; set; }
    public decimal NextShiftChangeCash { get; set; }
    public decimal ReceivedChangeCash { get; set; }
    public decimal PosnetTotal { get; set; }
    public DateTime ClosedAt { get; set; }
    public List<CigaretteShiftCloseItem> Items { get; set; } = [];
}

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
