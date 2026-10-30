namespace GestionMesas.Api;

public sealed record InvoiceMetadataRequest(int SupplierId, DateOnly IssueDate, string? Reference = null, string? Note = null);
public sealed record InvoiceResponse(int Id, int SupplierId, string SupplierName, string Reference, string Note,
    DateOnly IssueDate, DateTime CreatedAt, int PageCount, int SizeBytes, long OriginalBytes);
public sealed record InvoiceSupplierResponse(int Id, string Name, bool IsActive);
public sealed record InvoiceArchiveSummary(int Count, int SupplierCount, long SizeBytes);
public sealed record InvoiceListResponse(IReadOnlyList<InvoiceResponse> Items, int TotalCount, int Page, int PageSize, InvoiceArchiveSummary Summary);
public sealed class InvoiceValidationException(string message) : Exception(message);
