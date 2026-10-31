// Formas del JSON del catálogo.
namespace GestionMesas.Api;

public record CategoryRequest(string Name, string? Color);

public record ProductRequest(string Name);
