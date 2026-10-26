namespace GestionMesas.Api;

/// <summary>Artículo configurable para las ventas rápidas de cafetería.</summary>
public sealed record CreateCafeteriaProductRequest(string Name, decimal Price);

/// <summary>Datos editables de un artículo de cafetería.</summary>
public sealed record UpdateCafeteriaProductRequest(string Name, decimal Price);

/// <summary>Artículo de cafetería disponible para una venta rápida.</summary>
public sealed record CafeteriaProductResponse(int Id, string Name, decimal Price);

/// <summary>Resumen acumulado de artículos vendidos por la caja de cafetería.</summary>
public sealed record CafeteriaSalesSummaryResponse(int SaleCount, decimal TotalSales, IReadOnlyList<CafeteriaSalesSummaryItemResponse> Items);

/// <summary>Artículo vendido por la caja de cafetería.</summary>
public sealed record CafeteriaSalesSummaryItemResponse(string ProductName, int Quantity, decimal UnitPrice, decimal TotalSales);

/// <summary>Ventas acumuladas de cafetería para un período.</summary>
public sealed record CafeteriaPeriodSummaryResponse(int SaleCount, decimal TotalSales);

/// <summary>Ventas de cafetería agrupadas por fecha de trabajo y turno.</summary>
public sealed record CafeteriaShiftSalesHistoryResponse(DateOnly BusinessDate, string Shift, int SaleCount, decimal TotalSales);

/// <summary>Información de la caja de cafetería para una fecha de trabajo.</summary>
public sealed record CafeteriaDashboardResponse(DateOnly BusinessDate, string? ActiveShift, IReadOnlyList<CafeteriaProductResponse> Products, CafeteriaSalesSummaryResponse Summary, CafeteriaPeriodSummaryResponse DaySummary, CafeteriaPeriodSummaryResponse MonthSummary, IReadOnlyList<CafeteriaShiftSalesHistoryResponse> RecentShiftHistory);
