# Gestión de Mesas API

API ASP.NET Core Minimal API con Entity Framework Core y PostgreSQL. En el primer arranque crea automáticamente las categorías, productos, mesas de muestra y el usuario `admin` / `admin`.

## Organización del código

- `Program.cs` compone y ejecuta la aplicación.
- `Hosting/` registra servicios, CORS, el puerto de Render y los módulos de rutas.
- `Infrastructure/Persistence/` contiene `RestaurantContext`, la selección de SQLite/PostgreSQL, las ampliaciones de esquema y los datos iniciales. `DatabaseInitializer` mantiene el orden de inicialización anterior.
- `Features/` agrupa autenticación, catálogo, mesas, pedidos, pedidos pendientes, historial, configuraciones, coworking, cafetería, cigarrillos, proveedores y tiradas. Cada módulo reúne sus entidades, contratos HTTP, endpoints y lógica cuando corresponde.
- `CigaretteInventory` administra productos y compras; `CigaretteQueries` construye las consultas y respuestas; `CigaretteService` coordina cierres y sus transacciones.
- `SupplierLedger` concentra las reglas de saldos y movimientos compartidas por proveedores y cierres. `SupplierService` conserva la coordinación y persistencia de las operaciones.
- `TableClosing` archiva consumos y libera la mesa dentro de una transacción. `OrderConsumption` comparte las consultas de último consumo y la identificación del servicio de coworking.

El namespace `GestionMesas.Api`, los nombres de entidades, las tablas y los contratos HTTP se conservan. Los módulos de persistencia contienen las mismas ampliaciones SQL existentes; esta reorganización no introduce una migración de datos. Los handlers CRUD simples usan directamente el contexto; no hay un repositorio genérico adicional.

## Comprobaciones

Desde la raíz del repositorio:

```powershell
dotnet test BackEnd.Tests/GestionMesas.Api.Tests.csproj -c Release
dotnet build BackEnd/GestionMesas.Api.csproj -c Release
```

Las pruebas de servicios usan SQLite aislado. Las pruebas HTTP usan la misma composición y registro de rutas que producción, con una base SQLite en memoria y un puerto local efímero; verifican autenticación, configuración del ticket, mesas/pedidos/historial, cajas/cierres/proveedores y CORS. El worker de coworking se excluye de ese host de prueba porque tiene pruebas específicas con tiempo controlado. También se comprueban el arranque repetido sin pérdida de datos y la conversión de las URLs de PostgreSQL de Render. La suite no se conecta a bases de producción ni necesita iniciar la API de desarrollo.

## Desarrollo local

Ejecutá `dotnet run --urls http://localhost:5000`. Sin configuración adicional, la API usa SQLite y crea `gestion-mesas.db` localmente. La API queda disponible en `http://localhost:5000` y el cliente Vite la consume mediante `http://localhost:5000/api`.

Si preferís PostgreSQL, definí la variable `ConnectionStrings__Restaurant` con su cadena de conexión antes de iniciar la API; esa variable reemplaza automáticamente la configuración local.

## Despliegue en Render

Para este monorepo, el Blueprint se encuentra en `BackEnd/render.yaml` y declara `rootDir: BackEnd`, `dockerfilePath: ./Dockerfile` y `dockerContext: .`. Si el servicio se administra manualmente, usá esos mismos valores en Build & Deploy. La base PostgreSQL se conecta con `ConnectionStrings__Restaurant`; debe estar configurada también en el servicio existente para conservar los ajustes entre despliegues.

Después de publicar, verificá `GET /api/settings/welcome-message`: debe responder 200 con el importe y los seis campos de texto. Un deploy anterior puede responder 200 en `/` y seguir devolviendo 404 en la nueva ruta. Publicá primero el backend y después el frontend.

Las consultas y el guardado de configuraciones usan `Cache-Control: no-store` para evitar versiones antiguas del mensaje en cachés intermedias.

La API usa el puerto de la variable `PORT` de Render; el contenedor usa 8080 cuando esa variable no está definida.

El archivo `render.yaml` crea un servicio Docker y una base PostgreSQL administrada. La variable `ConnectionStrings__Restaurant` se obtiene automáticamente de la base. Render expondrá el puerto asignado a través de `ASPNETCORE_URLS`.

Para el frontend desplegado, definí en Vercel la variable `VITE_API_URL` con la URL pública de Render seguida de `/api` (por ejemplo, `https://tu-servicio.onrender.com/api`) y generá nuevamente el build del frontend. Si no se define, el cliente usa el dominio histórico `https://shop-mesas.onrender.com/api`.

## CORS y configuraciones

El ticket de bienvenida también permite editar `businessName`, `greetingText`, `messageText`, `conditionsText`, `minimumLabel` y `footerText` en la misma ruta de configuraciones. El saludo reemplaza `{nombre}` por el cliente; los saltos de línea se conservan y los textos se imprimen como texto plano. Los mensajes, condiciones y despedida pueden quedar vacíos para ocultarlos. Una actualización que solo envía `amount` conserva los textos existentes.

Al iniciar la API, se agregan automáticamente las columnas de texto tanto en SQLite como en PostgreSQL, conservando el importe guardado. Esta ampliación requiere desplegar backend y frontend actualizados.

La política `Frontend` permite GET, POST, PUT, PATCH, DELETE y OPTIONS, incluyendo los encabezados enviados por el navegador. Sin una lista de orígenes, acepta tanto localhost como los dominios del frontend desplegado. Para limitar los orígenes, configurá `Cors__AllowedOrigins__0=https://tu-frontend.vercel.app`, `Cors__AllowedOrigins__1=http://localhost:5173`, etc. Usá el origen sin rutas como `/api`.

El importe de bienvenida se consulta con `GET /api/settings/welcome-message` y se guarda con `PUT` en la misma ruta. Se conserva en SQLite o PostgreSQL; la tabla se crea al arrancar la API actualizada. Para habilitar esta funcionalidad en producción, desplegá los cambios del backend y del frontend.

Si la ruta devuelve 404 en local, reiniciá la API con el código actualizado usando `dotnet run --urls http://localhost:5000` desde `BackEnd`. En producción, verificá que Render haya desplegado el commit con esta ruta y que `VITE_API_URL` apunte a ese servicio. CORS no agrega rutas a una versión anterior del servidor.
