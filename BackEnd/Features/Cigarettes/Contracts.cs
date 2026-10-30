namespace GestionMesas.Api;

/// <summary>Datos para dar de alta una presentación de cigarrillos.</summary>
public sealed record CreateCigaretteProductRequest(string Name, decimal Price, int InitialStock);

/// <summary>Datos editables de una presentación de cigarrillos.</summary>
public sealed record UpdateCigaretteProductRequest(string Name, decimal Price, int Stock);

/// <summary>Datos de una compra o reposición de stock.</summary>
public sealed record CreateCigarettePurchaseRequest(int CigaretteProductId, int Quantity, DateOnly BusinessDate, string Shift, decimal? TotalCost = null, string PaymentMethod = "cash");

/// <summary>Datos editables de una compra de cigarrillos.</summary>
public sealed record UpdateCigarettePurchaseRequest(int Quantity, decimal? TotalCost = null, string? PaymentMethod = null);

/// <summary>Stock físico contado al finalizar un turno.</summary>
public sealed record CigaretteCloseItemRequest(int CigaretteProductId, int FinalStock);

public sealed record ConsolidateCigaretteCloseRequest(int? TargetCloseId, DateOnly? TargetDate = null, string? TargetShift = null);

/// <summary>Datos para cerrar un turno de cigarrillos.</summary>
public sealed record CreateCigaretteShiftCloseRequest(DateOnly BusinessDate, string Shift, IReadOnlyList<CigaretteCloseItemRequest> Items, IReadOnlyList<SupplierAllocationRequest>? SupplierAllocations = null, decimal EndingCashBalance = 0, decimal EndingMercadoPagoBalance = 0, decimal NextShiftChangeCash = 0, decimal ReceivedChangeCash = 0, decimal PosnetTotal = 0, decimal CigaretteReservedCash = 0, decimal CigaretteReservedMercadoPago = 0);

/// <summary>Stock físico corregido para los productos de un cierre existente.</summary>
public sealed record UpdateCigaretteShiftCloseRequest(IReadOnlyList<CigaretteCloseItemRequest> Items, IReadOnlyList<SupplierAllocationRequest>? SupplierAllocations = null, decimal? EndingCashBalance = null, decimal? EndingMercadoPagoBalance = null, decimal? NextShiftChangeCash = null, decimal? ReceivedChangeCash = null, decimal? PosnetTotal = null, DateOnly? BusinessDate = null, string? Shift = null, int? CafeteriaSaleCount = null, decimal? CigaretteReservedCash = null, decimal? CigaretteReservedMercadoPago = null);

/// <summary>Presentación de cigarrillos disponible para operar.</summary>
public sealed record CigaretteProductResponse(int Id, string Name, decimal Price, int Stock);

/// <summary>Compra de cigarrillos registrada.</summary>
public sealed record CigarettePurchaseResponse(int Id, int CigaretteProductId, string ProductName, int Quantity, DateOnly BusinessDate, string Shift, DateTimeOffset CreatedAt, decimal? TotalCost = null, string PaymentMethod = "cash");

/// <summary>Detalle de ventas calculado durante un cierre.</summary>
public sealed record CigaretteShiftCloseItemResponse(int CigaretteProductId, string ProductName, decimal UnitPrice, int InitialStock, int PurchasedQuantity, int FinalStock, int SoldQuantity, decimal SalesAmount);

public sealed record CigaretteShiftCloseResponse(int Id, DateOnly BusinessDate, string Shift, DateTimeOffset ClosedAt, int TotalSold, decimal TotalSales, IReadOnlyList<CigaretteShiftCloseItemResponse> Items, CafeteriaSalesSummaryResponse Cafeteria, IReadOnlyList<SupplierAllocationResponse> SupplierAllocations, decimal EndingCashBalance, decimal EndingMercadoPagoBalance, decimal NextShiftChangeCash, decimal ReceivedChangeCash, decimal PosnetTotal, IReadOnlyList<CashDropResponse> CashDrops, decimal CashDropsTotal, decimal? CigaretteReservedCash = null, decimal? CigaretteReservedMercadoPago = null);

/// <summary>Datos operativos e históricos de cigarrillos para una fecha.</summary>
public sealed record CigaretteDashboardResponse(DateOnly BusinessDate, IReadOnlyList<CigaretteProductResponse> Products, IReadOnlyList<CigarettePurchaseResponse> Purchases, IReadOnlyList<CigaretteShiftCloseResponse> Closes, IReadOnlyList<CashDropResponse> CashDrops);
