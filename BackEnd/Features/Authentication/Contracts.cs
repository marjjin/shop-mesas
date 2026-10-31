// Contratos HTTP: la forma exacta del JSON que entra por la ruta de login.
namespace GestionMesas.Api;

public record LoginRequest(string Username, string Password);
