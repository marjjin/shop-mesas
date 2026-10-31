# Guía del sistema

Explica cómo está construido Shop Family por dentro, para aprender a leerlo y modificarlo. Complementa a [ARCHITECTURE.md](ARCHITECTURE.md), que resume la organización, y a [BackEnd/README.md](BackEnd/README.md), que explica la operación y el despliegue.

**Cómo usarla:** leé las secciones 1 a 4 para entender la idea general. Después usá la sección 5 como referencia del módulo que estés tocando. El código tiene comentarios en español que siguen esta misma explicación.

## Contenido

1. [Qué hace el sistema](#1-qué-hace-el-sistema)
2. [Tecnologías](#2-tecnologías)
3. [Cómo se conectan las piezas](#3-cómo-se-conectan-las-piezas)
4. [El recorrido de un pedido](#4-el-recorrido-de-un-pedido)
5. [Los módulos, uno por uno](#5-los-módulos-uno-por-uno)
6. [Base de datos](#6-base-de-datos)
7. [Seguridad](#7-seguridad)
8. [Patrones del frontend](#8-patrones-del-frontend)
9. [Pruebas](#9-pruebas)
10. [Despliegue](#10-despliegue)
11. [Cómo agregar una funcionalidad](#11-cómo-agregar-una-funcionalidad)
12. [Orden sugerido de lectura](#12-orden-sugerido-de-lectura)
13. [Problemas detectados](#13-problemas-detectados)
14. [Glosario](#14-glosario)

## 1. Qué hace el sistema

Es una aplicación web para administrar un local gastronómico que también vende cigarrillos y ofrece espacio de coworking. Lo usa el personal desde una computadora o un celular.

| Sección | Para qué sirve |
| --- | --- |
| Plano de mesas | Ver el salón, abrir y cerrar mesas, cargar consumos |
| Pedidos | Tomar pedidos de clientes que todavía no tienen mesa |
| Artículos | Administrar lo que se puede cargar en una mesa |
| Caja Cafetería | Definir qué incluye una venta rápida de café y ver sus totales |
| Cigarrillos | Controlar stock, precios, compras y la caja de cigarrillos |
| Proveedores | Llevar fondos reservados, deuda, pagos y transferencias |
| Facturas | Escanear comprobantes y archivarlos en PDF |
| Tiradas | Registrar el efectivo retirado de la caja durante el turno |
| Cierre de turno | Hacer el arqueo y calcular las ventas |
| Historial de mesas | Consultar mesas cerradas y reimprimir tickets |
| Configuraciones | Elegir el tema y editar el ticket de bienvenida |

Dos ideas ordenan casi todo:

- **Fecha de trabajo y turno.** Cada día tiene dos turnos, `morning` y `afternoon`. Compras, tiradas, ventas de cafetería y cierres pertenecen a una combinación de fecha y turno.
- **El cierre de turno es el evento central.** Junta stock, cafetería, tiradas y proveedores en un único registro.

El salón registra **qué se consumió**, no cuánto cuesta. Los artículos se crean con precio 0 y el ticket de mesa no muestra importes. El dinero se controla en el cierre de turno.

## 2. Tecnologías

| Capa | Tecnología | Función |
| --- | --- | --- |
| Backend | ASP.NET Core Minimal API (.NET 10) | Recibe pedidos HTTP y aplica las reglas |
| Acceso a datos | Entity Framework Core 10 | Traduce consultas de C# a SQL |
| Base de datos | PostgreSQL en producción, SQLite en local | Guarda la información |
| Frontend | React 19 con Vite 8 | Interfaz en el navegador |
| Plano de mesas | react-moveable | Arrastrar y redimensionar mesas |
| Escaneo | OpenCV.js y jscanify | Detectar bordes y corregir la perspectiva |
| PDF | jsPDF | Generar documentos en el navegador |
| Archivos | Cloudinary | Guardar los PDF de las facturas |
| Alojamiento | Vercel y Render | Publicar el frontend y la API |

## 3. Cómo se conectan las piezas

```text
 Navegador                        Render                          Servicios
┌───────────────────┐   HTTPS   ┌────────────────────┐   SQL    ┌────────────┐
│ React (Vercel)    │ ────────► │ API ASP.NET Core   │ ───────► │ PostgreSQL │
│                   │   JSON +  │                    │          └────────────┘
│ Pantallas y hooks │   token   │ Endpoints          │  HTTPS   ┌────────────┐
│ Escáner (Worker)  │ ◄──────── │ Servicios          │ ───────► │ Cloudinary │
│ Tickets (ventana) │           │ Tareas en 2.º plano│          └────────────┘
└───────────────────┘           └────────────────────┘
```

El frontend nunca habla directamente con la base ni con Cloudinary: todo pasa por la API. Eso permite que las credenciales queden en el servidor y que cada acceso pase por la validación de sesión.

### Estructura de carpetas

```text
BackEnd/
├── Program.cs                 Arranque
├── Hosting/                   Servicios, pipeline HTTP y registro de rutas
├── Features/                  Un módulo por dominio de negocio
│   └── <Modulo>/
│       ├── *Endpoints.cs      Rutas HTTP
│       ├── *Service.cs        Reglas de negocio
│       ├── Entities.cs        Tablas
│       └── Contracts.cs       Formato del JSON
└── Infrastructure/Persistence Contexto de EF y actualización del esquema

BackEnd.Tests/                 Pruebas con xUnit

FrontEnd/gestion-mesas-shop/src/
├── App.jsx                    Componente raíz
├── app/                       Datos compartidos
├── features/                  Un módulo por pantalla
│   └── <modulo>/
│       ├── Pantalla.jsx       Vista principal
│       ├── components/        Partes de la vista
│       ├── hooks/             Estado y llamadas a la API
│       └── domain/            Cálculos puros, sin React
├── shared/                    Código común
└── styles/                    Estilos base y temas
```

Las dos partes se organizan **por funcionalidad y no por tipo de archivo**. Lo relacionado con proveedores está junto, en lugar de repartido entre una carpeta de controladores y otra de modelos.

### Capas del backend

```text
Endpoint  →  Servicio  →  RestaurantContext  →  Base de datos
HTTP         Reglas        EF Core
```

- El **endpoint** recibe el pedido y elige el código de respuesta.
- El **servicio** aplica las reglas y lanza excepciones si algo no es válido.
- El **contexto** lee y escribe en la base.

Las operaciones simples, como las de mesas, usan el contexto directamente desde el endpoint. Se creó un servicio solo donde hay reglas que lo justifican.

### Arranque de la API

`Program.cs` tiene cinco pasos:

1. `AddRestaurantServices` registra los servicios y define el motor de base de datos.
2. `Build` crea la aplicación.
3. `InitializeRestaurant` arma el pipeline HTTP y actualiza la base.
4. `MapRestaurantEndpoints` registra las rutas.
5. `Run` empieza a recibir pedidos.

Si la configuración de acceso o de CORS es insegura, la API **falla al arrancar**. Es preferible que no inicie antes de que quede publicada con un error de seguridad.

## 4. El recorrido de un pedido

Seguir un caso completo es la mejor forma de entender el sistema. Este es el recorrido de **agregar un consumo a una mesa**:

**En el navegador**

1. En `TableMenu.jsx`, el clic ejecuta `addConsumption`.
2. Esa función llama a `api('/orders', { method: 'POST', ... })`.
3. `createApiClient.js` agrega la cabecera `Authorization: Bearer <token>` y envía el pedido.

**En el servidor**

4. El pedido atraviesa el pipeline, en este orden:

   ```text
   Routing → cabeceras no-store → CORS → límite de intentos → Autenticación → Autorización → Endpoint
   ```

5. `SessionAuthentication` calcula el hash del token, busca la sesión y comprueba que siga vigente.
6. La autorización confirma que hay sesión y rol `Administrator`.
7. ASP.NET Core convierte el JSON en un `OrderRequest` e inyecta el `RestaurantContext`.
8. `OrdersEndpoints.CreateAsync` valida los datos, abre la mesa si estaba libre, crea el `Order` y actualiza `LastConsumptionAt`.
9. `SaveChangesAsync` envía el SQL a la base.
10. La API responde `201 Created`.

**De vuelta en el navegador**

11. `TableMenu` llama a `load()`, que pide `GET /api/bootstrap`.
12. `setData` guarda el resultado y React redibuja lo que cambió.

Si hay un error, `createApiClient` lo convierte en una excepción con un mensaje listo para mostrar. Si es un 401, además avisa que la sesión venció y la app vuelve al login.

## 5. Los módulos, uno por uno

### Autenticación

Archivos: `Features/Authentication/`, `features/auth/`.

El sistema usa **sesiones con token**, sin cookies ni JWT:

1. `POST /api/login` verifica la contraseña.
2. Genera un token aleatorio de 32 bytes, que dura 12 horas.
3. Guarda en `UserSessions` el **hash** del token, nunca el token.
4. El frontend lo conserva en `sessionStorage` y lo envía en cada pedido.

Cada sesión guarda también `CredentialStamp`, un hash de la contraseña vigente. Si la contraseña cambia, ese valor deja de coincidir y todas las sesiones anteriores caducan solas.

Al arrancar, `AuthenticationBootstrap` sincroniza la cuenta administradora con la variable `Authentication__AdminPassword`.

### Mesas y consumos

Archivos: `Features/Tables/`, `Features/Orders/`, `features/salon/`.

```text
         abrir / agregar consumo / asignar pedido
  free ─────────────────────────────────────────► occupied
   ▲                                                  │
   └──────────────── cerrar mesa ─────────────────────┘
```

Una mesa tiene dos relojes:

- `OpenedAt`: cuánto tiempo lleva abierta.
- `LastConsumptionAt`: cuánto hace que no consume.

Al cerrar, `TableClosing` hace todo dentro de una transacción: crea el `ClosedTableHistory`, copia los consumos, libera la mesa y borra los `Order`. Los nombres de los productos se **copian como texto**, para que el historial siga intacto aunque el artículo se elimine después.

### Coworking automático

Archivos: `Features/Coworking/`.

`CoworkingBillingService` es una tarea en segundo plano que corre cada 30 segundos. Llama a `CoworkingBilling.ProcessAsync`, que revisa las mesas ocupadas y agrega cargos.

| Situación | Próximo cargo |
| --- | --- |
| Hubo un consumo real después del último cargo | **1 hora** después de ese consumo |
| Ya hay cargos automáticos | **30 minutos** después del último cargo |
| Mesa sin consumos ni cargos | **30 minutos** después de abrir |

Ejemplo: una mesa consume a las 10:10. A las 11:10 se carga «Servicio Coworking 1 hora»; a las 11:40 y a las 12:10, «30 minutos». Si consume a las 12:20, el ciclo se reinicia y el próximo cargo llega a las 13:20.

El bucle `while` recupera los cargos atrasados, por ejemplo si el servidor estuvo apagado. Si alguien quita un cargo a mano, `CoworkingDisabled` pausa los siguientes hasta la próxima apertura.

Los productos de servicio se reconocen **por su nombre**. Por eso el catálogo impide crearlos o borrarlos.

### Pedidos pendientes

Archivos: `Features/PendingOrders/`, `features/pending-orders/`.

Permiten anotar un pedido antes de que haya mesa. `PendingOrderWorkflow.AssignAsync` lo convierte en una mesa ocupada.

Ese método resuelve un problema de concurrencia. Si dos personas eligen la misma mesa a la vez, comprobar primero y escribir después podría dejar pasar a ambas. Por eso la escritura incluye la condición:

```csharp
db.Tables.Where(table => table.Id == tableId && table.Status == "free")
    .ExecuteUpdateAsync(...)
```

La base aplica esa operación de forma atómica: solo una gana. La otra actualiza 0 filas y recibe un `409 Conflict`.

### Catálogo

Archivos: `Features/Catalog/`, `features/catalog/`.

Administra artículos y categorías. Eliminar un artículo también lo quita de las mesas y pedidos en curso, pero no del historial, que guarda su nombre como texto.

### Cigarrillos: stock y compras

Archivos: `Features/Cigarettes/`, `features/cigarettes/`.

`CigaretteService` coordina tres piezas:

- `CigaretteInventory`: productos y compras.
- `CigaretteQueries`: consultas de solo lectura.
- `CigaretteRules`: validaciones compartidas.

Una compra suma al stock de inmediato. Editar una compra funciona distinto según el turno:

- **Turno abierto:** cambia el stock.
- **Turno cerrado:** el stock ya es definitivo, así que cambian las unidades vendidas del cierre.

Eliminar un producto es una **baja lógica**: `IsActive` pasa a `false` para no perder el historial.

### Cierre de turno

Archivos: `CigaretteService.cs`, `features/cigarettes/closing/`, `closeFinancials.js`.

Es la operación más compleja. `CloseShiftAsync` hace, dentro de una transacción:

1. Valida que el turno no esté cerrado y que los importes sean correctos.
2. Reúne las tiradas sin cierre y las ventas de cafetería pendientes.
3. Calcula las ventas de cada producto.
4. Deja el stock igual al conteo físico.
5. Asigna la cafetería y las tiradas a este cierre.
6. Acredita las reservas a los proveedores.

**Cálculo del stock:**

```text
inicial  = stock actual - compras del turno
vendido  = inicial + compras - final contado
importe  = vendido × precio
```

Ejemplo: stock 30, con 10 comprados en el turno, da inicial 20. Si se cuentan 25 al final, se vendieron 5. A $1.000 son $5.000.

**Cálculo del dinero:**

```text
Arqueo  = efectivo + tiradas + Mercado Pago + Posnet + cambio dejado - cambio recibido
Caja    = Arqueo - proveedores normales - cigarrillos - cafetería
Ventas  = Arqueo + proveedores con caja aparte
```

| Concepto | Importe |
| --- | ---: |
| Efectivo en caja | $50.000 |
| Tiradas | + $20.000 |
| Mercado Pago | + $30.000 |
| Posnet | + $10.000 |
| Cambio dejado | + $15.000 |
| Cambio recibido | − $10.000 |
| **Arqueo** | **$115.000** |
| Proveedores normales | − $20.000 |
| Cigarrillos | − $5.000 |
| Cafetería | − $8.000 |
| **Caja** | **$82.000** |

Con $5.000 en proveedores de caja aparte, las **Ventas** dan $120.000.

Estas fórmulas están en `closeFinancials.js`, en dos versiones: para el formulario en curso y para cierres guardados. Los tickets reutilizan esos cálculos, de modo que pantalla e impresión coinciden. Arqueo, Caja y Ventas no se guardan: se calculan al mostrarlos a partir de los importes del cierre.

**Borradores:** cada cambio del formulario se guarda en `localStorage`, por fecha y turno, para no perder el trabajo si se recarga la página.

**Correcciones:**

- `UpdateCloseAsync` corrige un cierre, incluso moviéndolo de fecha o turno, y arrastra sus movimientos.
- `DeleteCloseAsync` solo acepta el cierre más reciente, porque el inicial de cada turno depende del anterior.
- `ConsolidateCloseAsync` repara cierres hechos en el turno equivocado.

### Caja de cigarrillos

Archivo: `Cash/CigaretteCashService.cs`.

```text
Saldo = reservas de los cierres - compras registradas
```

No hay ninguna tabla con el saldo: **se recalcula en cada consulta**. Así, corregir o eliminar un cierre o una compra nunca deja el saldo desactualizado. Se calcula por separado para efectivo y Mercado Pago.

### Proveedores

Archivos: `Features/Suppliers/`, `features/suppliers/`.

Cada proveedor tiene **dos saldos con significados opuestos**:

- **Reservado:** dinero del local apartado para ese proveedor, dividido en efectivo y Mercado Pago.
- **Cuenta corriente:** lo que el local le debe.

| Movimiento | Reservado | Cuenta corriente |
| --- | --- | --- |
| `allocation` (reserva del cierre) | Sube | |
| `reserved_purchase` (compra con reserva) | Baja | |
| `purchase` (compra a cuenta) | | Sube |
| `payment` (pago) | Baja | Baja |
| `reserved_transfer_out` / `in` | Baja / Sube | |
| `reserved_exchange` (entre medios) | Total igual | |
| `reserved_adjustment` | Según el ajuste | |
| `current_account_adjustment` | | Según el ajuste |

`SupplierLedger` concentra estas reglas. `ApplyTransactionEffect` recibe `direction`: `1` aplica un movimiento y `-1` lo revierte. Editar consiste en revertir el viejo y aplicar el nuevo.

Un proveedor de **caja aparte** tiene su reserva fuera del resultado de Caja, pero dentro de las Ventas del turno.

### Cafetería

Archivos: `Features/Cafeteria/`, `features/cafeteria/`.

No lleva stock. El botón **Venta café** del salón registra una venta con una unidad de cada artículo activo. Cada venta copia nombre y precio, de modo que cambiar un precio no altera las ventas anteriores.

El turno activo se deduce del último cierre. Las **ventas pendientes** son las de una fecha y turno que todavía no tienen cierre, y el siguiente cierre las toma.

### Tiradas

Archivos: `Features/CashDrops/`, `features/cash-drops/`.

Una tirada es efectivo retirado físicamente durante el turno. Se imprime un ticket para acompañar el dinero, y el arqueo la suma de nuevo porque sigue siendo plata del turno. `CigaretteShiftCloseId` está vacío hasta que el cierre la toma.

### Facturas

Archivos: `Features/Invoices/`, `features/invoices/`.

```text
Foto → Detectar bordes → Ajustar esquinas → Corregir perspectiva → Comprimir
     → Repetir por página → Armar PDF → Subir a la API → Guardar en Cloudinary
```

Todo el procesamiento de imagen ocurre **en el navegador**; la foto original no se sube.

**Escáner.** OpenCV es pesado y bloquearía la pantalla, por eso corre en un *Web Worker* (`scan.worker.js`), un hilo aparte. `scanWorkerClient.js` convierte esa mensajería en promesas, con límite de tiempo y cancelación. Si OpenCV falla, `processImage.js` ofrece una alternativa en JavaScript puro.

**Almacenamiento.** Hay dos sistemas que no comparten transacción: Cloudinary y la base. Para no perder archivos si algo falla en el medio:

1. Se guarda en la base una tarea de limpieza, con vencimiento a 24 horas.
2. Se sube el PDF a Cloudinary.
3. Se confirma la factura y se borra la tarea, en una transacción.

Si el proceso se corta entre los pasos 2 y 3, la tarea sigue ahí y `InvoiceStorageWorker` eliminará el archivo huérfano. Antes de borrar, comprueba que ninguna factura lo use.

El PDF se consulta a través de la API, de modo que solo se accede con sesión válida.

### Impresión

Archivos: `features/printing/`.

Cada plantilla genera un HTML completo para papel térmico de 80 mm. `receipt.js` lo escribe en una ventana emergente que se imprime sola y se cierra.

Hay un detalle importante: los navegadores bloquean las ventanas que no nacen directamente de un clic. Por eso primero se abre la ventana vacía, después se espera a la API y al final se completa el contenido:

```js
const printWindow = openReceiptPrintWindow()       // durante el clic
const result = await api(`/tables/${id}/close`)    // espera
printReceipt(result.history, printWindow)          // completa la ventana
```

Todos los datos pasan por `escapeHtml`, para que un nombre de cliente no se ejecute como código.

### Configuración y apariencia

`WelcomeMessageSetting` guarda una sola fila con los textos del ticket. `{nombre}` se reemplaza por el cliente. Las reglas de validación existen en los dos lados: en el frontend para responder enseguida, y en el backend como control definitivo.

**Ticket de cierre de turno.** `ShiftTicketSetting` guarda una fila con el diseño en JSON: márgenes y una lista ordenada de bloques con sus renglones. El diseño guarda orden, visibilidad y textos, nunca importes.

- `shiftTicketLayout.js` define el diseño de fábrica y las operaciones de edición, como funciones puras.
- `normalizeShiftTicketLayout` une lo guardado con el diseño de fábrica. Así, un bloque o renglón que el sistema agregue después aparece aunque el diseño sea anterior.
- `shiftReceipt.js` recorre los bloques en orden y usa una función por bloque para armarlo.
- La vista previa de Configuraciones usa esa misma plantilla, dentro de un `iframe` que no puede ejecutar código.
- Cada impresión lee el diseño del servidor con `printShiftTicket`. Si no puede leerlo, no imprime un ticket con un diseño distinto: avisa del error.

El resumen diario no usa este diseño.

El tema se guarda en `localStorage`. `public/theme-init.js` lo aplica antes de que aparezca la página, para evitar un parpadeo.

## 6. Base de datos

### Relaciones principales

```text
Users ─< UserSessions

Categories ·· Products ·· Orders ·· Tables
              Products ·· PendingOrderItems >─ PendingOrders

ClosedTableHistories ·· ClosedTableHistoryItems

CigaretteProducts ·· CigarettePurchases
CigaretteProducts ·· CigaretteShiftCloseItems >─ CigaretteShiftCloses
CashDrops (opcional) >─ CigaretteShiftCloses
SupplierTransactions (opcional) ·· CigaretteShiftCloses

Suppliers ·· SupplierTransactions
Suppliers ─< Invoices ─ InvoiceDocuments

CafeteriaProducts ·· CafeteriaSaleItems >─ CafeteriaSales

─< o >─  relación con clave foránea definida en el modelo de EF
··       guarda el ID del otro registro, sin clave foránea en el modelo
```

Esto refleja `RestaurantContext`. Algunas actualizaciones de `PostgresSchemaUpgrade` crean claves foráneas adicionales, así que una base antigua puede tener más restricciones que una nueva.

### Dos motores, un modelo

EF Core traduce las consultas para ambos, pero las actualizaciones de esquema se escriben a mano. Al cambiar el esquema hay que revisar los dos motores: por ejemplo, SQLite no admite `ADD COLUMN IF NOT EXISTS`.

### Sin migraciones de EF

El proyecto no usa `dotnet ef migrations`. Al arrancar, `DatabaseInitializer` ejecuta:

1. `EnsureCreated`, que crea todo si la base no existe.
2. Las clases `*SchemaUpgrade`, que agregan lo que falte a bases existentes.
3. `DemoDataSeeder`, solo si no hay usuarios.

Como esto corre en **cada arranque**, cada paso debe ser **idempotente**: repetirlo no puede cambiar el resultado.

`EnsureCreated` no modifica una base que ya existe. Una columna nueva requiere, por lo tanto, sumarla a la entidad **y** a un `SchemaUpgrade`.

### Convenciones

- El dinero usa `decimal` con precisión `(12, 2)`, nunca `double`.
- Las fechas se guardan en UTC y el frontend las muestra en hora local.
- `BusinessDate` es la fecha de trabajo, elegida por el operador.
- Los registros históricos copian nombres y precios.
- Lo que tiene historial se desactiva con `IsActive` en lugar de borrarse.

## 7. Seguridad

| Medida | Dónde | Qué protege |
| --- | --- | --- |
| `FallbackPolicy` | `RestaurantApplication.cs` | Toda ruta exige sesión, incluso las nuevas |
| Hash de contraseñas, 210.000 iteraciones | `UserPasswords.cs` | Contraseñas si se filtra la base |
| Hash de tokens | `AuthenticationEndpoints.cs` | Sesiones si se filtra la base |
| Verificación de duración constante | `UserPasswords.Verify` | Impide averiguar qué usuarios existen |
| Límite de 10 intentos por minuto | `RestaurantApplication.cs` | Fuerza bruta en el login |
| CORS con orígenes exactos | `RestaurantApplication.cs` | Llamadas desde otros sitios |
| `escapeHtml` | Plantillas de tickets | Inyección de código |
| `no-store` | Middleware | Datos sensibles en cachés |
| Límites de tamaño y validación de PDF | `InvoiceEndpoints.cs`, `InvoiceService.cs` | Archivos abusivos |
| Secretos en variables de entorno | Todo el backend | Credenciales en Git |

La regla de fondo: **toda validación del frontend es comodidad, y la seguridad real está en el backend**, porque cualquiera puede llamar a la API sin pasar por la interfaz.

Más detalle en [SECURITY_REVIEW.md](SECURITY_REVIEW.md) y [GUIA_ACCESO.md](GUIA_ACCESO.md).

## 8. Patrones del frontend

### Separación en tres capas

```text
Pantalla.jsx      Qué se dibuja
useAlgo.js        Estado y llamadas a la API
domain/algo.js    Cálculos puros
```

Los archivos de `domain/` no conocen React, así que se prueban fácilmente. Este reparto es la clave para orientarse: para cambiar un cálculo, mirá `domain/`; para cambiar una llamada, `hooks/`; para cambiar lo que se ve, el `.jsx`.

### Estado

No hay una librería de estado global. `App.jsx` tiene los datos compartidos y los pasa por props. Cada pantalla gestiona lo suyo con sus hooks.

| Dónde vive | Para qué |
| --- | --- |
| `useState` | Datos de pantalla |
| `useRef` | Bloqueos inmediatos y referencias al DOM |
| `sessionStorage` | Token, sección actual: dura lo que la pestaña |
| `localStorage` | Tema y borradores de cierre: sobrevive al cierre del navegador |
| API | Toda la información de negocio |

### Navegación

No se usa React Router. `sectionNavigation.js` es un router propio que asocia cada sección con una URL, y `useNavigation` lo conecta con React. La pantalla visible se elige con una expresión condicional en `App.jsx`.

### Sincronización

`useRestaurantData` pide `/bootstrap` cada 10 segundos. Es **polling**: sencillo y suficiente para este uso, a cambio de que los cambios de otro dispositivo tarden hasta 10 segundos en aparecer.

### Cuatro patrones que se repiten

**Evitar doble envío.** Un `useRef` bloquea al instante, mientras que `useState` recién actúa en el siguiente render:

```js
if (actionRef.current) return
actionRef.current = true
```

**Ignorar respuestas viejas.** Si el usuario cambia de fecha mientras carga, la respuesta anterior no debe pisar la nueva:

```js
const currentLoadId = ++loadId.current
const data = await api(...)
if (currentLoadId !== loadId.current) return
```

**Cancelar al desmontar.** Con `AbortController` en la limpieza del `useEffect`, como en `useInvoices.js`.

**Centavos enteros.** En JavaScript `0.1 + 0.2` no da exactamente `0.3`. Por eso las sumas sensibles convierten a centavos, como en `saleConfigurationTotal`.

## 9. Pruebas

```powershell
# Backend, desde la raíz
dotnet test BackEnd.Tests/GestionMesas.Api.Tests.csproj -c Release

# Frontend, desde FrontEnd/gestion-mesas-shop
npm test
npm run lint
npm run build
```

- **Backend:** xUnit. Prueba servicios con SQLite aislado y rutas HTTP completas con `ApiTestHost`. Las pruebas de PostgreSQL se omiten salvo que se defina `SHOP_MESAS_TEST_POSTGRES`.
- **Frontend:** `node --test`, con archivos `*.test.js` junto al código. Cubre lógica de `domain/`, el cliente HTTP y el escáner, no los componentes visuales.

Inyectar dependencias es lo que hace posibles estas pruebas: `TimeProvider` permite controlar el reloj, y `createApiClient` recibe `request` para simular la red.

## 10. Despliegue

```text
 git push a main
      ├──► Vercel: npm run build y publica FrontEnd/gestion-mesas-shop/dist
      └──► Render: construye BackEnd/Dockerfile y reinicia la API
                   └──► En el arranque, actualiza el esquema de PostgreSQL
```

| Variable | Dónde | Para qué |
| --- | --- | --- |
| `ConnectionStrings__Restaurant` | Render | Conexión a PostgreSQL |
| `Authentication__AdminPassword` | Render | Contraseña del administrador |
| `Cors__AllowedOrigins__0` | Render | Origen permitido del frontend |
| `Cloudinary__*` | Render | Credenciales de almacenamiento |
| `VITE_API_URL` | Vercel | URL de la API, fijada al compilar |

Los dos guiones bajos `__` equivalen a `:` en la configuración de .NET: `Cors__AllowedOrigins__0` es `Cors:AllowedOrigins:0`.

Las variables `VITE_` quedan **dentro del código público**, así que nunca deben contener secretos. Cambiarlas exige volver a compilar.

La versión visible sale de `package.json`. Las reglas para actualizarla están en [AGENTS.md](AGENTS.md).

## 11. Cómo agregar una funcionalidad

Ejemplo: agregar a las mesas un campo de observaciones.

**Backend**

1. Agregar la propiedad en `Features/Tables/Entities.cs`.
2. Agregar la columna en una clase `*SchemaUpgrade`, para SQLite y PostgreSQL.
3. Sumar el campo a `TablePatch` en `Contracts.cs`.
4. Aplicarlo en `TablesEndpoints.UpdateAsync`.
5. Agregar una prueba en `BackEnd.Tests/`.

**Frontend**

6. Enviarlo desde `useSalon.js` con `saveTable`.
7. Mostrarlo en `TableMenu.jsx`.
8. Si hay un cálculo, ponerlo en `domain/` con su prueba.

**Para terminar**

9. Ejecutar pruebas, lint y build.
10. Actualizar la versión según [AGENTS.md](AGENTS.md).

Un módulo nuevo sigue el mismo camino: crear una carpeta en `Features/`, registrar su `Map...Endpoints` en `RestaurantEndpoints.cs` y sus servicios en `RestaurantApplication.cs`. Sus rutas quedan protegidas automáticamente.

## 12. Orden sugerido de lectura

1. `BackEnd/Program.cs` y `Hosting/RestaurantApplication.cs`: el arranque.
2. `Features/Orders/OrdersEndpoints.cs`: un módulo simple y completo.
3. `Features/Tables/TableClosing.cs`: una transacción.
4. `src/App.jsx`: cómo se arma la interfaz.
5. `src/shared/api/createApiClient.js`: cómo se habla con la API.
6. `src/features/salon/hooks/useSalon.js`: un hook real.
7. `src/features/salon/domain/salonPresentation.js` y su prueba: lógica pura.
8. `Features/PendingOrders/PendingOrderWorkflow.cs`: concurrencia.
9. `Features/Coworking/CoworkingBilling.cs`: reglas y tareas en segundo plano.
10. `Features/Authentication/`: seguridad.
11. `Features/Suppliers/SupplierLedger.cs`: reglas de saldos.
12. `Features/Cigarettes/CigaretteService.cs` y `closeFinancials.js`: el módulo más complejo.
13. `src/features/invoices/`: workers y procesamiento de imágenes.

## 13. Problemas detectados

Estos puntos surgieron al leer el código para esta guía. **No se corrigieron**, porque el trabajo consistía solo en documentar.

### Importante: los movimientos entre efectivo y Mercado Pago no se revierten

`SupplierLedger.ApplyTransactionEffect` no tiene un caso para `reserved_exchange`, aunque ese tipo se puede editar y eliminar desde la interfaz.

Si un proveedor mueve $10.000 de efectivo a Mercado Pago y después se elimina ese movimiento, el historial lo pierde pero los saldos siguen movidos. Editarlo tampoco cambia los saldos. El total reservado no varía, pero el reparto entre medios de pago queda mal. Ninguna prueba cubre este caso.

### Medio: no se pueden editar ajustes negativos

`UpdateBalancesAsync` genera ajustes con importes negativos cuando un saldo baja. Al editar uno, `ValidateReplacement` llama a `ValidateSplit`, que rechaza negativos. El resultado es un error, y la única salida es eliminar el ajuste.

### Medio: fechas calculadas con la hora del servidor

Varias rutas usan `DateTime.Today` si no reciben fecha. El contenedor no define una zona horaria, así que corre en UTC, tres horas adelantado respecto de Argentina.

`useQuickCoffeeSale` no envía fecha, de modo que después de las 21:00 una venta rápida se registra con la fecha del día siguiente. El cierre la reasigna, pero hasta entonces los totales de «Vendido hoy» pueden no coincidir.

### Menor: finales de línea mezclados

Hay archivos con CRLF y LF combinados. No afecta el funcionamiento, pero genera diferencias innecesarias. Se resuelve con un `.gitattributes`.

### Menor: comentario incorrecto

En `Features/CashDrops/Contracts.cs`, el comentario de `CashDropResponse` dice «Cierre completo de un turno», y debería describir una tirada.

## 14. Glosario

| Término | Significado |
| --- | --- |
| **Arqueo** | Recuento del dinero al terminar el turno |
| **Tirada** | Efectivo retirado de la caja durante el turno |
| **Cambio** | Efectivo que un turno deja para que el siguiente pueda dar vuelto |
| **Reserva** | Dinero apartado para un proveedor o para cigarrillos |
| **Cuenta corriente** | Deuda acumulada con un proveedor |
| **Caja aparte** | Proveedor cuya reserva no se descuenta del resultado de Caja |
| **Fecha de trabajo** | Fecha contable elegida por el operador |
| **API** | Conjunto de rutas por las que el frontend le pide cosas al servidor |
| **Endpoint** | Una ruta concreta de la API |
| **Middleware** | Etapa del pipeline por la que pasa cada pedido |
| **Inyección de dependencias** | El sistema entrega los objetos que una función necesita, en lugar de que los cree ella |
| **Entidad** | Clase de C# que representa una tabla |
| **Contrato o DTO** | Forma del JSON que entra o sale de la API |
| **Transacción** | Grupo de operaciones que se confirman todas juntas o ninguna |
| **Idempotente** | Que repetirlo produce el mismo resultado |
| **Baja lógica** | Marcar un registro como inactivo sin borrarlo |
| **Hash** | Huella irreversible de un dato |
| **CORS** | Regla del navegador sobre qué sitios pueden llamar a una API |
| **Hook** | Función de React que empieza con `use` y agrupa estado o efectos |
| **Prop** | Dato que un componente recibe de su componente padre |
| **Render** | Cuando React recalcula lo que debe verse |
| **Polling** | Consultar periódicamente si hay novedades |
| **Web Worker** | Hilo aparte del navegador para tareas pesadas |
| **WASM** | Código compilado que corre en el navegador, como OpenCV |
