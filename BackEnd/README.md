# Gestión de Mesas API

API ASP.NET Core Minimal API con Entity Framework Core y PostgreSQL. Las rutas de negocio requieren una sesión de servidor y el rol `Administrator`. En una base nueva se crean datos iniciales y el usuario `admin` con la contraseña privada definida en `Authentication__AdminPassword`; no existe una contraseña de fábrica utilizable.

## Autenticación y actualización de instalaciones existentes

Los comandos para cambiar el usuario y la contraseña, tanto en localhost como en futuras configuraciones de producción, están en [GUIA_ACCESO.md](../GUIA_ACCESO.md).

- Definí `Authentication__AdminPassword` en el entorno del backend, con una contraseña privada no vacía de hasta 1024 caracteres. No se exige una longitud mínima. Se rechazan `admin` y los valores de ejemplo `CHANGE_ME`. No la guardes en Git ni la envíes en el chat. Una base nueva o una instalación con el acceso heredado `admin/admin` no inicia sin esta configuración.
- Si se define esa variable, la contraseña de la cuenta administradora elegida queda sincronizada con ella en cada arranque. `Authentication__AdminUsername` permite cambiar también su nombre de ingreso. Se conserva el ID de la cuenta; cambiar realmente el usuario o la contraseña revoca sus sesiones anteriores. Sin un nombre configurado se conserva el que ya esté guardado. Se elige por defecto el administrador llamado `admin` o, si no existe, la única cuenta administradora; para elegir entre varias cuentas renombradas se exige `Authentication__AdminUserId`. Los otros usuarios existentes conservan sus credenciales y permisos operativos; sus contraseñas de texto se migran a hash. No se borran ventas, mesas, cierres ni saldos.
- `POST /api/login` recibe `username` y `password`, y devuelve `token`, `expiresAt` y `user`. El token es aleatorio, dura 12 horas y se envía como `Authorization: Bearer <token>`. En la base solo se guarda su hash, asociado al usuario y a la versión de su contraseña.
- `GET /api/session` valida la sesión y devuelve el usuario actual. `POST /api/logout` revoca la sesión utilizada; el mismo token ya no sirve después de salir. Las otras sesiones del usuario permanecen activas hasta su vencimiento o un cambio de contraseña.
- Toda ruta de negocio exige autenticación y rol `Administrator`, con una política global que protege también rutas nuevas. Los usuarios heredados conservan el rol administrativo que corresponde al acceso completo anterior; esta versión no agrega una pantalla de gestión de roles ni divide las tareas del personal. Un rol distinto no obtiene acceso por defecto.
- Solo login y el health check `/` permiten acceso anónimo. Las respuestas de API se marcan `no-store`. Login admite hasta 10 intentos por minuto por dirección de conexión del servidor; no se confía en un `X-Forwarded-For` enviado por el cliente. Detrás de un proxy varios operadores pueden compartir ese límite, y el límite es por instancia, no distribuido.
- El frontend guarda el token en `sessionStorage`, lo valida con `/api/session` al recargar y elimina la sesión local ante un 401. No confía en el objeto local heredado `mesa-user`. Un cierre de sesión sin conexión informa que no pudo revocarla y permite reintentar.

Al arrancar se agrega `Users.Role` y la tabla `UserSessions`, con índices y clave foránea, tanto en SQLite como en PostgreSQL. La columna existente `Users.Password` pasa a contener hashes de ASP.NET Core Identity con prefijo `identity:`; nunca se devuelve por HTTP. Hacé un respaldo antes de actualizar y desplegá backend y frontend compatibles en la misma ventana. La versión anterior del frontend no envía el token y recibirá 401 con el nuevo servidor. No vuelvas a ejecutar una versión del backend que compare contraseñas en texto después de migrarlas.

En producción el tráfico del navegador debe usar HTTPS. En este despliegue lo termina Render, con HTTP interno hacia el contenedor. No se usan cookies de autenticación, de modo que el navegador no adjunta la sesión automáticamente a pedidos de otros sitios. El token sigue siendo una credencial: una falla XSS o un dispositivo comprometido podría leerlo mientras esté activo. La corrección del acceso anónimo no certifica los otros riesgos documentados en `SECURITY_REVIEW.md`.

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

Las pruebas de servicios usan SQLite aislado. Las pruebas HTTP usan la composición y rutas de producción, una base independiente y un puerto local efímero. Por defecto usan SQLite en memoria; con `SHOP_MESAS_TEST_POSTGRES` usan bases nuevas en un PostgreSQL local de pruebas. Se verifican autenticación, configuración del ticket, mesas/pedidos/historial, cajas/cierres/proveedores y CORS, con flujos en `Testing` y `Production`. El worker de coworking se excluye de ese host porque tiene pruebas específicas con tiempo controlado. También se comprueban el arranque repetido sin pérdida de datos, la conversión de URLs PostgreSQL y la migración del esquema anterior de usuarios y proveedores. La suite rechaza conexiones externas y no se conecta a producción. La [validación con PostgreSQL 18.6](../VALIDACION_POSTGRESQL.md) contiene los resultados y los comandos para repetirla.

## Desarrollo local

Para reiniciar una instancia antigua sin dejar el puerto 5000 ejecutando la versión anterior, corré desde la raíz:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\Start-Local.ps1
```

El script pide la contraseña sin mostrarla ni escribirla en un archivo, compila en una carpeta separada, verifica que el proceso del puerto 5000 pertenece al backend de este repositorio y lo reinicia. Antes de migrar, conserva un respaldo del SQLite local y sus archivos WAL en `BackEnd/bin/local-dev/backups/`. Usa exclusivamente `BackEnd/gestion-mesas.db`, sin conectarse a PostgreSQL ni cambiar producción. Conservá juntos los archivos de cada respaldo para una eventual restauración con la API detenida. El acceso usa el nombre guardado (`admin` en una base nueva) y la contraseña ingresada; al finalizar el script se retira de su entorno temporal. Para renombrar la misma cuenta, agregá `-Username "nuevo_usuario"` al comando; ingresá la contraseña actual si querés conservarla, o una nueva para cambiar ambos valores. Ver la [guía completa](../GUIA_ACCESO.md).

Desde la raíz, prepará el entorno sin escribir la contraseña en el historial de comandos:

```powershell
$env:ASPNETCORE_ENVIRONMENT = 'Development'
$env:Authentication__AdminPassword = [System.Net.NetworkCredential]::new('', (Read-Host 'Contraseña privada de admin' -AsSecureString)).Password
dotnet run --project BackEnd/GestionMesas.Api.csproj --urls http://localhost:5000
```

La API usa SQLite por defecto y crea `gestion-mesas.db` localmente. Queda disponible en `http://localhost:5000`; Vite la consume mediante `http://localhost:5000/api`. El entorno Development permite los orígenes locales de Vite y preview en los puertos 5173 y 4173. `.env.example` documenta las variables, pero ASP.NET Core no carga automáticamente un archivo `.env`.

Si preferís PostgreSQL, definí la variable `ConnectionStrings__Restaurant` con su cadena de conexión antes de iniciar la API; esa variable reemplaza automáticamente la configuración local.

## Despliegue en Render

Para este monorepo, el Blueprint se encuentra en `BackEnd/render.yaml` y declara `rootDir: BackEnd`, `dockerfilePath: ./Dockerfile` y `dockerContext: .`. Si el servicio se administra manualmente, usá esos mismos valores en Build & Deploy. La base PostgreSQL se conecta con `ConnectionStrings__Restaurant`; debe estar configurada también en el servicio existente para conservar los ajustes entre despliegues.

Antes de desplegar, configurá `Authentication__AdminPassword` en Environment de Render. El Blueprint la declara con `sync: false`, para cargarla como secreto, y fija `Cors__AllowedOrigins__0=https://gestion-mesas-shop.vercel.app`. Para un servicio existente, confirmá esas variables manualmente. El origen también está en `appsettings.json` como valor de producción.

Para un nombre de ingreso distinto del inicial, configurá opcionalmente `Authentication__AdminUsername` en ese servicio. No es necesario definirlo si querés conservar el usuario que ya está guardado. La [guía de acceso](../GUIA_ACCESO.md) describe los cambios independientes de usuario y contraseña y la selección por ID cuando hay varios administradores.

La migración y los flujos principales ya se validaron contra PostgreSQL 18.6 aislado; ver [resultado y alcance](../VALIDACION_POSTGRESQL.md). Antes de publicar, conservá un respaldo y comprobá la configuración y permisos del servicio real, que no fueron modificados ni inspeccionados por esa prueba. Mantené `ConnectionStrings__Restaurant` apuntando a la base existente de Render y `VITE_API_URL` a la API HTTPS correcta. `Start-Local.ps1` es exclusivo de desarrollo: no se ejecuta en Render ni reemplaza su conexión de base de datos. El backend seguro no es compatible con las pestañas que sigan ejecutando el frontend anterior; deben recargarse e iniciar sesión con el frontend actualizado.

Después de publicar, `/` debe seguir respondiendo 200 sin sesión. `GET /api/settings/welcome-message` sin token debe responder 401; después de iniciar sesión debe responder 200 con el importe y los seis campos de texto. Desplegá backend y frontend actualizados en la misma ventana y volvé a ingresar con la contraseña configurada.

Las consultas y el guardado de configuraciones usan `Cache-Control: no-store` para evitar versiones antiguas del mensaje en cachés intermedias.

La API usa el puerto de la variable `PORT` de Render; el contenedor usa 8080 cuando esa variable no está definida.

El archivo `render.yaml` crea un servicio Docker y una base PostgreSQL administrada. La variable `ConnectionStrings__Restaurant` se obtiene automáticamente de la base. Render expondrá el puerto asignado a través de `ASPNETCORE_URLS`.

Para el frontend desplegado, definí en Vercel la variable `VITE_API_URL` con la URL pública de Render seguida de `/api` (por ejemplo, `https://tu-servicio.onrender.com/api`) y generá nuevamente el build del frontend. Si no se define, el cliente usa el dominio histórico `https://shop-mesas.onrender.com/api`.

## CORS y configuraciones

El ticket de bienvenida también permite editar `businessName`, `greetingText`, `messageText`, `conditionsText`, `minimumLabel` y `footerText` en la misma ruta de configuraciones. El saludo reemplaza `{nombre}` por el cliente; los saltos de línea se conservan y los textos se imprimen como texto plano. Los mensajes, condiciones y despedida pueden quedar vacíos para ocultarlos. Una actualización que solo envía `amount` conserva los textos existentes.

Al iniciar la API, se agregan automáticamente las columnas de texto tanto en SQLite como en PostgreSQL, conservando el importe guardado. Esta ampliación requiere desplegar backend y frontend actualizados.

La política `Frontend` permite GET, POST, PUT, PATCH, DELETE y OPTIONS, incluidos `Authorization` y `Content-Type`, únicamente para los orígenes configurados. Producción permite `https://gestion-mesas-shop.vercel.app`; Development agrega la configuración local descrita arriba. Para otros despliegues, configurá `Cors__AllowedOrigins__0=https://tu-frontend.vercel.app`, etc., con el origen exacto sin rutas, credenciales, comodines ni parámetros. Una configuración vacía fuera de desarrollo/pruebas impide iniciar. CORS controla al navegador; la sesión se exige también a llamadas directas a la API.

El importe de bienvenida se consulta con `GET /api/settings/welcome-message` y se guarda con `PUT` en la misma ruta. Se conserva en SQLite o PostgreSQL; la tabla se crea al arrancar la API actualizada. Para habilitar esta funcionalidad en producción, desplegá los cambios del backend y del frontend.

Si la ruta devuelve 404 en local, reiniciá la API con el código actualizado usando `dotnet run --urls http://localhost:5000` desde `BackEnd`. En producción, verificá que Render haya desplegado el commit con esta ruta y que `VITE_API_URL` apunte a ese servicio. CORS no agrega rutas a una versión anterior del servidor.
