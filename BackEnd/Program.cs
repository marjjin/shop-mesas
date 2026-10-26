using GestionMesas.Api;

var builder = WebApplication.CreateBuilder(args);
builder.AddRestaurantServices();

var app = builder.Build();
app.InitializeRestaurant();
app.MapRestaurantEndpoints();
app.Run();
