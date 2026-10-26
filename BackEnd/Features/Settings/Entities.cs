namespace GestionMesas.Api;

public class WelcomeMessageSetting
{
    public int Id { get; set; } = 1;
    public decimal Amount { get; set; } = 3000;
    public string BusinessName { get; set; } = "SHOP FAMILY";
    public string GreetingText { get; set; } = "Hola {nombre}, bienvenido/a a Shop Family.";
    public string MessageText { get; set; } = "Ya registramos tu pedido.";
    public string ConditionsText { get; set; } = "Tu tiempo de mesa es de 1 hora.\n\nPasado ese tiempo podrás renovar tu pedido o solo abonar el servicio de mesa sin consumición.";
    public string MinimumLabel { get; set; } = "Costo mínimo de consumo";
    public string FooterText { get; set; } = "¡Gracias por elegirnos!";
}
