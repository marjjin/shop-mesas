// Punto de entrada de la API. Se ejecuta de arriba hacia abajo una sola vez al arrancar el servidor.
// Las tres piezas reales viven en Hosting/: servicios, inicialización y rutas.
using GestionMesas.Api;

// 1. Prepara el contenedor de servicios (base de datos, autenticación, CORS, etc.).
var builder = WebApplication.CreateBuilder(args);
builder.AddRestaurantServices();

// 2. Construye la aplicación con lo registrado arriba.
var app = builder.Build();
// 3. Configura el pipeline HTTP y deja la base de datos lista para usar.
app.InitializeRestaurant();
// 4. Registra todas las rutas /api.
app.MapRestaurantEndpoints();
// 5. Empieza a escuchar pedidos HTTP. Esta llamada no termina hasta que se apaga el servidor.
app.Run();
