# Gestión de Mesas API

API ASP.NET Core Minimal API con Entity Framework Core y PostgreSQL. En el primer arranque crea automáticamente las categorías, productos, mesas de muestra y el usuario `admin` / `admin`.

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
