# Revisión de seguridad de Gestión de Mesas

Fecha: 27 de octubre de 2026, America/Buenos_Aires. Código revisado: commit `8579a7e` de `main`.

## Estado posterior de la corrección del acceso

El informe siguiente conserva los resultados del código auditado. En la copia de trabajo posterior se implementó la corrección de S01: autenticación de servidor obligatoria, política global y rol administrativo, tokens aleatorios de 12 horas con hash en base y revocación al salir. Se agregó validación de la sesión en el frontend, migración de contraseñas a hash, sustitución obligatoria del acceso de fábrica, lista explícita de orígenes para el frontend indicado y limitación de intentos de login. Estas medidas también atienden la base de S02 y S03; los demás hallazgos siguen pendientes.

La actualización conserva los datos y las operaciones del usuario administrador. Requiere configurar `Authentication__AdminPassword` antes de arrancar una base nueva o una instalación con `admin/admin`, y publicar backend y frontend compatibles. Ver [instrucciones de autenticación y despliegue](BackEnd/README.md). La configuración de producción y el despliegue real siguen sin verificarse.

Actualización del 28 de octubre de 2026: a pedido del usuario se retiró el mínimo de 14 caracteres de la contraseña configurada, tanto en el script local como en el backend. Se aceptan contraseñas cortas y se mantienen el rechazo de valores vacíos, `admin`, ejemplos `CHANGE_ME` y valores de más de 1024 caracteres.

También se agregó el cambio de nombre de ingreso mediante `Authentication__AdminUsername` y `Start-Local.ps1 -Username`, conservando el ID y los datos de la cuenta. Cambiar realmente el usuario o la contraseña revoca sus sesiones; repetir los mismos valores no las revoca. Se rechazan nombres duplicados y, cuando hay varios administradores renombrados, se exige seleccionar la cuenta con `Authentication__AdminUserId`. Los comandos y sus efectos están documentados en [GUIA_ACCESO.md](GUIA_ACCESO.md).

Validación ampliada del 28 de octubre: se ejecutaron las pruebas HTTP contra **PostgreSQL 18.6 real y aislado**, incluyendo `Production`, login, sesiones, permisos, cambios de credenciales, flujos de negocio y migración del esquema antiguo. La suite Release pasó 112 pruebas; las pruebas unitarias que crean SQLite explícitamente siguen usando SQLite. Sin PostgreSQL habilitado, la regresión normal pasó 111 pruebas y omitió únicamente el caso exclusivo de migración PostgreSQL. El frontend pasó sus 28 pruebas, lint y build. Se actualizó el paquete de publicación Release local, sin desplegarlo. Ver [detalle y evidencias de PostgreSQL](VALIDACION_POSTGRESQL.md).

La validación real detectó y permitió corregir un fallo de arranque: el actualizador PostgreSQL referenciaba una columna histórica `Suppliers.Balance` ausente en bases nuevas. Se comprobó la corrección tanto sobre una base nueva como sobre un esquema anterior reconstruido, conservando credenciales migradas, saldos y datos de negocio. Se eliminaron las bases de prueba y se detuvo la instancia temporal; no se usó la conexión ni se modificaron datos de producción.

Las pruebas HTTP usan la composición de producción dentro de un host aislado, no un deploy. No se verificaron la infraestructura, los permisos o los datos reales de Render, Docker/Linux ni la interfaz en un navegador conectado. El intento anterior de arrancar el paquete publicado como proceso separado fue rechazado por la política de ejecución. Las sondas históricas de `security-review/2026-10-27` documentan las fallas originales y no deben interpretarse como resultados del código corregido.

## Dictamen

**El sistema no ofrece actualmente una barrera de acceso efectiva en la API. No debería exponerse a usuarios no confiables con datos reales hasta corregir S01.** La pantalla de login oculta la interfaz, pero las operaciones del servidor funcionan sin credenciales. Un cliente que alcance la API puede consultar información comercial, modificar caja y proveedores y borrar consumos.

La prioridad es proteger las rutas en el servidor. Cambiar la contraseña, ocultar botones, restringir CORS o actualizar dependencias por separado no resuelve S01.

Esta revisión analiza el código y comprueba comportamientos localmente; no demuestra que haya ocurrido una intrusión ni confirma la configuración real del despliegue.

## Alcance y método

- Revisión de los módulos de autenticación, configuración, catálogo, mesas, pedidos, pendientes, historial, coworking, cafetería, cigarrillos, cierres, proveedores y tiradas; cliente React, almacenamiento del navegador, impresión y generación de PDF.
- Revisión de EF Core, inicialización de SQLite/PostgreSQL, Dockerfile, archivos de despliegue y exclusiones de Git/Docker.
- Trece pruebas de seguridad contra las rutas reales de la aplicación mediante `ApiTestHost`, en puertos locales efímeros y bases SQLite temporales en memoria. El trabajador periódico de coworking se desactiva en ese host de pruebas.
- Prueba determinista de concurrencia de proveedores con dos contextos independientes que cargan el mismo saldo antes de escribir. Se comprueba una intercalación vulnerable; no se mide su frecuencia bajo carga real.
- Auditorías de dependencias npm y NuGet, incluyendo transitivas, consultadas en la fecha del informe; compilación, lint y pruebas existentes.
- Búsqueda de patrones de credenciales en los 103 commits disponibles y de archivos sensibles en el historial. Es una búsqueda acotada de patrones, no una garantía de ausencia de secretos.

No se enviaron pruebas a la API de producción, no se abrió su base de datos y no se cambiaron datos reales. No se modificó el código funcional ni se instalaron actualizaciones. Las sondas temporales se retiraron del proyecto de pruebas y se conservaron como texto junto con sus resultados en [security-review/2026-10-27](security-review/2026-10-27/README.md).

No se inspeccionaron las cuentas de hosting, reglas de red efectivas, certificados, permisos reales de PostgreSQL, secretos de producción, copias de seguridad, logs operativos, dispositivos del personal ni políticas de GitHub. Las comprobaciones dinámicas utilizaron SQLite; las diferencias de PostgreSQL requieren validación adicional.

## Hallazgos priorizados

Las severidades describen el riesgo en este sistema. Los hallazgos se relacionan entre sí y no deben sumarse como vulnerabilidades independientes.

| ID | Severidad | Hallazgo | Evidencia |
| --- | --- | --- | --- |
| S01 | Crítica | Lectura, modificación y borrado sin autenticación ni permisos | Código y HTTP local |
| S02 | Alta | Administrador de fábrica, contraseñas en texto plano y sesión de demostración | Código y HTTP local |
| S03 | Alta | CORS abierto por defecto permite operar desde otros sitios en la configuración examinada | Código y HTTP local |
| S04 | Alta | Las tiradas se pueden modificar y borrar después del cierre | HTTP local |
| S05 | Alta | Operaciones sobre saldos sin control de concurrencia | Reproducción con dos contextos |
| S06 | Alta | Desbordamiento de cantidades y stock hasta valores negativos | HTTP local |
| S07 | Alta | Borrado de consumos y cambios operativos sin trazabilidad suficiente | Código y HTTP local |
| S08 | Alta | Entradas pequeñas pueden disparar trabajo y asignaciones de memoria enormes | Entrada aceptada y análisis de bucles |
| S09 | Media | Sin límites de intentos en la aplicación y consultas sin paginación | Código y prueba acotada |
| S10 | Media | Dependencias con avisos publicados; explotabilidad específica no demostrada | npm audit y revisión de uso |
| S11 | Media | La aplicación necesita modificar el esquema con su identidad de ejecución | Código; permisos reales no inspeccionados |
| S12 | Baja | Borradores financieros persisten en el navegador después de salir | Código |

### S01. La API no exige autenticación ni autorización

**Evidencia:** [RestaurantApplication.cs](BackEnd/Hosting/RestaurantApplication.cs#L9), [RestaurantEndpoints.cs](BackEnd/Hosting/RestaurantEndpoints.cs#L7), [AuthenticationEndpoints.cs](BackEnd/Features/Authentication/AuthenticationEndpoints.cs#L13), [createApiClient.js](FrontEnd/gestion-mesas-shop/src/shared/api/createApiClient.js#L9).

No se registran esquemas de autenticación, políticas de autorización ni requisitos de acceso para el grupo `/api`. El login devuelve `demo-admin-token`, pero las rutas no lo verifican y el cliente no lo envía. Tampoco hay roles que separen salón, caja y administración.

**Comprobado:** sin iniciar sesión devolvieron 200 bootstrap, historial, proveedores, cafetería, cigarrillos y tiradas. Un bearer inválido también obtiene 200. Un cliente anónimo pudo borrar el catálogo, crear artículos y modificar configuraciones. Las pruebas funcionales existentes también realizan operaciones financieras sin una sesión de servidor.

**Impacto:** exposición de clientes presentes y operaciones comerciales; alteración de inventario, caja y reservas; borrado de consumos. Basta acceso de red a la API; no hace falta conocer la contraseña. Si hay un control externo de acceso, limita quién puede alcanzarla, pero no existe evidencia de él en el código revisado.

**Corrección:** implementar autenticación real y autorización por defecto en `/api`, permitiendo acceso anónimo únicamente a login y un health check mínimo. Definir permisos de salón, caja y administración; reservar correcciones, ajustes de saldo, cambios de configuración y borrados a personal autorizado. Validar en el servidor cada ruta y recurso. Añadir pruebas de 401 sin sesión y 403 con permisos insuficientes.

La documentación de [seguridad de Minimal APIs](https://learn.microsoft.com/en-us/aspnet/core/fundamentals/minimal-apis/security?view=aspnetcore-10.0) distingue autenticación de autorización y describe la protección de endpoints.

### S02. Credenciales y sesiones de demostración

**Evidencia:** [DemoDataSeeder.cs](BackEnd/Infrastructure/Persistence/DemoDataSeeder.cs#L6), [AuthenticationEndpoints.cs](BackEnd/Features/Authentication/AuthenticationEndpoints.cs#L15), [User](BackEnd/Features/Authentication/Entities.cs#L3), [DatabaseInitializer.cs](BackEnd/Infrastructure/Persistence/DatabaseInitializer.cs#L13), [useSession.js](FrontEnd/gestion-mesas-shop/src/features/auth/useSession.js#L4), [App.jsx](FrontEnd/gestion-mesas-shop/src/App.jsx#L51).

Se crea `admin/admin` si no hay usuarios, sin distinguir producción. La contraseña se guarda y compara directamente como texto. El formulario viene precargado con esas credenciales. El token devuelto es fijo, sin identidad verificable, vencimiento ni revocación. La interfaz toma como sesión un objeto modificable de `sessionStorage`; salir elimina ese objeto sin revocar ninguna sesión del servidor.

**Comprobado:** una base nueva acepta `admin/admin`; logins repetidos devuelven el mismo token. No se probó si la instalación real conserva esa contraseña. La interfaz puede habilitarse falsificando el objeto local; eso no otorga privilegios de servidor, porque actualmente el servidor ya permite el acceso anónimo.

**Corrección:** retirar las credenciales precargadas y el sembrado de administrador de producción; establecer un alta inicial controlada, cuentas individuales y cambio de credenciales existentes. Usar ASP.NET Core Identity o un mecanismo mantenido para hash con sal y parámetros adecuados. No reemplazar texto plano por un hash rápido casero. Diseñar expiración, revocación y cierre de sesión real.

Para un despliegue bajo el mismo origen, considerar sesión con cookie `HttpOnly`, `Secure`, `SameSite` y protección CSRF. Si frontend y API siguen en orígenes diferentes, definir explícitamente el flujo de cookies o tokens y sus restricciones; un token fijo en un header no soluciona la autenticación. [OWASP Password Storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html) explica el almacenamiento mediante hash adaptativo.

### S03. CORS permite cualquier origen si falta configuración

**Evidencia:** [RestaurantApplication.cs](BackEnd/Hosting/RestaurantApplication.cs#L22), [render.yaml](BackEnd/render.yaml#L9).

Cuando `Cors:AllowedOrigins` está vacío se aplica `AllowAnyOrigin`, con métodos de lectura, escritura y borrado. El archivo de despliegue no define esa lista; podría existir una configuración manual que no se inspeccionó.

**Comprobado:** un preflight desde `https://untrusted.example` permite PUT y la escritura posterior devuelve 200 con `Access-Control-Allow-Origin: *`. Con la API anónima esto permite que otro sitio use el navegador de un visitante para leer o alterar la API, sujeto a que sea alcanzable y a las restricciones de red del navegador.

**Corrección:** lista explícita de orígenes de frontend, configuración separada por entorno y fallo de arranque en producción si falta. No reflejar orígenes arbitrarios ni combinar cookies con una política abierta. Se comprobó además que restringir CORS deja funcionando las llamadas anónimas directas: S01 debe resolverse por separado. [Microsoft aclara que CORS no constituye control de acceso al servidor](https://learn.microsoft.com/en-us/aspnet/core/security/cors?view=aspnetcore-10.0).

### S04. Se puede alterar el arqueo de un turno cerrado mediante sus tiradas

**Evidencia:** [CashDropService.cs](BackEnd/Features/CashDrops/CashDropService.cs#L64), [CigaretteQueries.cs](BackEnd/Features/Cigarettes/CigaretteQueries.cs#L83).

La creación verifica que el turno esté abierto. La edición y el borrado no comprueban `CigaretteShiftCloseId` ni exigen un flujo de corrección del cierre. Los importes del cierre se calculan nuevamente al consultarlo.

**Comprobado:** registrar una tirada de 500, cerrar el turno y editarla a 1 cambia el total histórico a 1. Borrarla deja ese total en 0. Se realiza mediante las rutas normales y sin autorización.

**Corrección:** bloquear cambios directos de movimientos vinculados a cierres. Si el negocio necesita corregirlos, exigir permiso administrativo, motivo, versión y registro del antes/después; conservar el movimiento original y emitir una corrección vinculada. Probar que el resumen histórico solo cambia por ese flujo explícito.

### S05. Los saldos pueden perder actualizaciones concurrentes

**Evidencia:** [SupplierService.cs](BackEnd/Features/Suppliers/SupplierService.cs#L147), [SupplierLedger.cs](BackEnd/Features/Suppliers/SupplierLedger.cs#L13), [RestaurantContext.cs](BackEnd/Infrastructure/Persistence/RestaurantContext.cs#L67).

Las operaciones leen saldos, verifican disponibilidad y luego guardan valores absolutos. No hay token de concurrencia ni una actualización condicional atómica que vincule la validación al descuento.

**Comprobado:** dos contextos cargan saldo reservado y cuenta corriente de 1000. Ambos registran un pago de 800. Quedan dos movimientos por 1600 y saldos finales de 200. El segundo pago debería rechazarse después del primero, porque solo quedan 200. La prueba reproduce la intercalación de lecturas; no representa dinero transferido realmente por Mercado Pago.

**Corrección:** transacciones con control de concurrencia o actualizaciones condicionales que descuenten solo si hay saldo, verificando filas afectadas. Resolver conflictos explícitamente; no repetir a ciegas pagos no idempotentes. Añadir claves de idempotencia en operaciones financieras donde corresponda y restricciones de integridad en ambas bases. [EF Core documenta los tokens de concurrencia y su tratamiento](https://learn.microsoft.com/en-us/ef/core/saving/concurrency).

**Riesgo adicional por revisión de código:** `RegisterSaleAsync` determina turno antes de guardar y `CloseShiftAsync` captura pendientes antes de confirmar el cierre. No comparten una coordinación que impida una venta intercalada. La corrección de cafetería existente cubre la secuencia normal, pero una carrera podría dejar una venta asociada al turno que acaba de cerrarse. Este caso específico no se reprodujo en esta revisión; debe probarse con intercalación controlada, junto con altas de tiradas y compras durante el cierre. Una entidad de turno con estado y asociación explícita de ventas facilitaría la integridad.

### S06. Cantidades positivas pueden desbordar a valores negativos

**Evidencia:** [PendingOrdersEndpoints.cs](BackEnd/Features/PendingOrders/PendingOrdersEndpoints.cs#L46), [CigaretteInventory.cs](BackEnd/Features/Cigarettes/CigaretteInventory.cs#L64), [PendingOrderWorkflow.cs](BackEnd/Features/PendingOrders/PendingOrderWorkflow.cs#L46).

Se acepta un entero positivo sin un máximo de negocio y se suma a otro `int` sin detección de desbordamiento. `Math.Max(1, cantidad)` no protege la suma posterior. No se observan restricciones CHECK equivalentes en el modelo.

**Comprobado:** cargar 2.147.483.647 unidades en un pendiente y añadir 1 produce -2.147.483.648. Ese valor se transfiere a una comanda al asignar la mesa. Crear stock de cigarrillos de 2.147.483.647 y comprar 1 también guarda stock negativo.

**Corrección:** límites razonables de cantidad y stock, validar el total resultante y usar aritmética comprobada. Añadir restricciones en persistencia compatibles con SQLite y PostgreSQL y errores 400 consistentes. Extender la validación a importes, precisión decimal, fechas y tamaños de colecciones. También se comprobó que `customerName: null` devuelve 500 por ejecutar `Trim()` sin validar, en vez de rechazar la solicitud como entrada inválida.

### S07. Borrados y cambios operativos sin una trazabilidad suficiente

**Evidencia:** [CatalogEndpoints.cs](BackEnd/Features/Catalog/CatalogEndpoints.cs#L60), [TablesEndpoints.cs](BackEnd/Features/Tables/TablesEndpoints.cs#L27), [TablesEndpoints.cs](BackEnd/Features/Tables/TablesEndpoints.cs#L69), [SupplierService.cs](BackEnd/Features/Suppliers/SupplierService.cs#L161), [entidades de proveedores](BackEnd/Features/Suppliers/Entities.cs#L16), [CigaretteService.cs](BackEnd/Features/Cigarettes/CigaretteService.cs#L161).

El borrado de productos elimina consumos y pendientes asociados. El de mesas elimina consumos sin archivar un cierre. Reabrir una mesa ya ocupada cambia cliente y reloj sin comprobar el estado previo. Las correcciones de movimientos sobrescriben o eliminan registros; las entidades financieras no identifican al usuario que realizó cada cambio ni conservan una bitácora completa del antes/después.

**Comprobado:** borrar el catálogo elimina consumos activos y no genera historial de mesa. Reabrir una mesa ocupada reemplaza su hora y cliente mientras mantiene los consumos existentes. Eso puede alterar la interpretación del tiempo de permanencia y el cobro de coworking.

**Corrección:** bajas lógicas de productos usados, impedir borrados incompatibles con consumos activos y exigir transiciones de estado válidas. Separar apertura de corrección de horarios. Registrar actor autenticado, instante UTC, operación, objeto, valores anteriores/nuevos, motivo y correlación; limitar quién puede consultar o modificar esa bitácora. Para caja y proveedores, preferir movimientos de reversión/corrección conservando los originales. Los logs HTTP del hosting no sustituyen esa trazabilidad.

### S08. Trabajo desproporcionado a partir de entradas pequeñas

**Evidencia:** [TablesEndpoints.cs](BackEnd/Features/Tables/TablesEndpoints.cs#L46), [CoworkingBilling.cs](BackEnd/Features/Coworking/CoworkingBilling.cs#L56), [CigaretteService.cs](BackEnd/Features/Cigarettes/CigaretteService.cs#L116), [CigaretteService.cs](BackEnd/Features/Cigarettes/CigaretteService.cs#L175).

**Comprobado:** una mesa nueva, abierta y sin consumos acepta `openedAt` del año 0001. El trabajador genera un objeto por cada media hora desde esa fecha, sin límite de lote dentro del bucle. Si no hay consumos posteriores que cambien el punto de partida, el recorrido equivale a unos 35 millones de cargos hasta 2026.

Por otra parte, corregir la cantidad de cafetería solo rechaza números negativos; con una venta de plantilla, un valor cercano a `int.MaxValue` provoca un bucle que crea esa cantidad de ventas con sus artículos.

**Impacto inferido:** agotamiento de memoria, tiempo de CPU, transacciones largas y caída o indisponibilidad del servicio. No se ejecutaron esos bucles con cantidades destructivas ni se midió una caída. La aceptación de la fecha sí se verificó; el resto se deriva del código.

**Corrección:** ventana máxima para corrección de fechas, cantidades máximas de negocio, procesamiento en lotes con presupuesto de trabajo y cancelación dentro de bucles. Proteger correcciones con permisos y revalidar cada operación. Agregar límites de solicitudes no reemplaza los límites de trabajo por solicitud.

### S09. Falta de controles de abuso y límites de consulta

**Evidencia:** [RestaurantApplication.cs](BackEnd/Hosting/RestaurantApplication.cs#L9), [HistoryEndpoints.cs](BackEnd/Features/History/HistoryEndpoints.cs#L13), [SupplierService.cs](BackEnd/Features/Suppliers/SupplierService.cs#L8), [BootstrapEndpoints.cs](BackEnd/Features/Bootstrap/BootstrapEndpoints.cs#L13), [CigaretteQueries.cs](BackEnd/Features/Cigarettes/CigaretteQueries.cs#L34).

No se observa rate limiting de la aplicación, bloqueo por intentos ni una política explícita para límites de colecciones. Historial y proveedores cargan todos los registros y hacen agrupaciones en memoria; los rangos de cierres no tienen una amplitud máxima. Bootstrap expone todos los datos operativos necesarios para la pantalla sin segmentación por permiso.

**Comprobado:** 30 intentos consecutivos de login inválido reciben 401 sin bloqueo de la aplicación y un login válido posterior funciona. Esta prueba acotada no descarta límites externos del proxy o del proveedor. Tampoco se afirma que no exista el límite de cuerpo que aplica Kestrel por defecto.

**Corrección:** límites específicos para login y escrituras, controles por cuenta y origen de red con tratamiento correcto del proxy, paginación, límites de fechas y colecciones, índices y cancelación. Añadir alertas para intentos reiterados y operaciones sensibles. El objetivo es reducir tanto abuso como crecimiento normal que vuelva lentas las consultas.

### S10. Dependencias con avisos de seguridad

Resultados guardados sin aplicar `audit fix` ni cambiar el lockfile:

| Paquete instalado | Ruta | Clasificación de npm audit | Alcance observado | Versión corregida consultada |
| --- | --- | --- | --- | --- |
| DOMPurify 3.4.15 | jsPDF 4.2.1 | Crítica | Dependencia incluida en la compilación de producción | 3.4.17 |
| Vite 8.3.0 | Herramientas de desarrollo | Alta | Servidor/herramientas de desarrollo; no demuestra una falla en los archivos estáticos desplegados | 8.3.5 |
| source-map-js 1.2.1 | Vite → PostCSS | Alta | Herramientas de desarrollo/procesamiento de mapas | 1.2.2 |
| Zod 4.6.5 | eslint-plugin-react-hooks | Alta | Herramientas de lint | 4.6.6 |

`npm audit` reporta cuatro paquetes afectados: uno crítico y tres altos. Con `--omit=dev`, queda DOMPurify. Las versiones corregidas indicadas existen en el registro en la fecha de revisión; no son una promesa de cubrir avisos futuros.

**Matiz de explotabilidad:** el cliente utiliza jsPDF mediante `.text()`, no su API `.html()`. No se encontró uso directo de DOMPurify ni de las opciones especiales que requieren los avisos consultados. El build genera un chunk de DOMPurify, pero su presencia no prueba que un atacante pueda activar la vulnerabilidad desde el flujo de tickets. Además, el [aviso del mantenedor sobre SAFE_FOR_TEMPLATES](https://github.com/cure53/DOMPurify/security/advisories/GHSA-cg2g-xh64-v4q7) describe precondiciones específicas y lo clasifica como bajo, mientras el feed de npm usado por el escáner lo clasifica crítico. Se conserva esa discrepancia y no se informa XSS demostrado en esta aplicación.

NuGet no informó paquetes vulnerables en el backend, incluidas transitivas, en la consulta realizada. Esto no certifica el runtime desplegado, la imagen base ni la ausencia de fallas desconocidas. El runtime local es ASP.NET Core/.NET 10.0.11; no se inspeccionó el de producción.

**Corrección:** actualizar los paquetes afectados y el lockfile mediante cambios controlados y volver a ejecutar auditoría, pruebas, lint, build e impresión/PDF. Mantener Vite de desarrollo fuera de redes no confiables. Automatizar revisiones de dependencias y secretos; no hay una configuración de CI en `.github` en el repositorio actual.

### S11. La identidad que sirve HTTP también modifica el esquema

**Evidencia:** [DatabaseInitializer.cs](BackEnd/Infrastructure/Persistence/DatabaseInitializer.cs#L9), [PostgresSchemaUpgrade.cs](BackEnd/Infrastructure/Persistence/PostgresSchemaUpgrade.cs#L9), [WelcomeMessageSchemaUpgrade.cs](BackEnd/Infrastructure/Persistence/WelcomeMessageSchemaUpgrade.cs#L12).

Cada arranque ejecuta creación y ampliaciones de esquema con la conexión de la aplicación. Un despliegue que las ejecute satisfactoriamente necesita permisos DDL para esa identidad. No se verificaron los grants reales ni se afirma que sea superusuario.

**Impacto:** una futura falla de ejecución de código o uso indebido de la conexión tendría un alcance mayor al de una cuenta limitada a operaciones de datos. Los cambios automáticos de esquema también aumentan el riesgo de arranque simultáneo y recuperación.

**Corrección:** separar la tarea de migración, con credenciales propias, de la cuenta de ejecución. Usar permisos mínimos para servir la API; revisar grants y restricciones de red de PostgreSQL. Verificar cifrado y validación de certificado en la conexión real: el conversor actual solo configura SSL si lo indica `sslmode`, y el valor efectivo no fue inspeccionado.

### S12. Los borradores financieros sobreviven al cierre de sesión

**Evidencia:** [closeDrafts.js](FrontEnd/gestion-mesas-shop/src/features/cigarettes/domain/closeDrafts.js#L3), [useSession.js](FrontEnd/gestion-mesas-shop/src/features/auth/useSession.js#L18).

Stock final, saldos y reservas se guardan en `localStorage`, identificados por fecha/turno. Salir no los elimina ni los separa por usuario. En una computadora compartida, otro usuario del mismo perfil de navegador puede verlos o modificarlos y el siguiente operador puede recuperar ese borrador.

**Corrección:** definir retención, eliminar borradores al cerrar sesión cuando corresponda y separarlos por identidad/local. Para datos sensibles, preferir borradores de servidor con permisos y vencimiento. Un borrador local nunca debe considerarse evidencia contable confiable.

## Controles favorables y categorías revisadas sin explotación demostrada

- Las consultas de negocio usan principalmente EF Core con parámetros. El SQL manual observado corresponde a ampliaciones de esquema; los identificadores proceden del código y los valores por defecto se escapan. No se encontró una ruta de inyección SQL mediante entrada HTTP en los archivos examinados. Esto no sustituye el arreglo de autenticación ni una revisión continua.
- React representa textos como texto, y las plantillas de impresión aplican `escapeHtml` a nombres y mensajes. La prueba de escape de bienvenida pasa. No se encontró un `dangerouslySetInnerHTML`, `eval` o flujo equivalente de contenido de usuario que permita afirmar XSS propio confirmado. El `document.write` de impresión exige mantener el escape en cualquier plantilla futura.
- No se observaron endpoints de subida de archivos, ejecución de comandos del sistema o descarga HTTP de URLs suministradas por usuarios que sustenten una falla de carga, traversal, SSRF o ejecución remota de código en el código actual.
- Se usan DTOs de entrada en vez de vincular indiscriminadamente entidades completas. Esto reduce sobreescrituras accidentales de propiedades; no aporta autorización.
- Hay validaciones de importes positivos, nombres y turnos en varios módulos, transacciones en cierres/asignación de pendientes y un índice único de fecha/turno. Son controles útiles, aunque insuficientes frente a los casos reproducidos.
- `.gitignore` y `.dockerignore` excluyen bases locales y `.env`. No se encontraron archivos `.env`, `.db`, `.pem`, `.pfx` o `.key` versionados en los 103 commits disponibles con la búsqueda realizada. Los tres resultados de URLs PostgreSQL con credenciales fueron ejemplos de pruebas de `DatabaseInitializationTests.cs`, con valores de muestra; no se confirmó una credencial real filtrada. No hubo coincidencias de los patrones seleccionados de claves AWS, tokens GitHub, claves privadas o JWT. Las credenciales de fábrica de S02 sí son reales dentro del comportamiento del sistema.
- La URL de API del frontend rechaza credenciales embebidas y exige HTTPS al compilar para producción. Se usa una variable de conexión en el despliegue en vez de escribir la contraseña en `render.yaml`.

## Infraestructura y operación: puntos que requieren evidencia del despliegue

Estos puntos son pendientes de verificación, no fallas remotas confirmadas:

| Área | Evidencia del repositorio | Qué verificar |
| --- | --- | --- |
| HTTPS | API escucha HTTP; cliente exige HTTPS en producción | Terminación TLS, red interna, redirección efectiva y configuración del proxy. HTTP interno detrás de TLS no demuestra exposición de credenciales en Internet. |
| Cabeceras del frontend | No hay política de hosting/CSP visible | CSP, protección frente a framing, `nosniff` y política de referencias en el servidor que entrega HTML. Una CSP estricta necesita contemplar los scripts de impresión actuales. |
| Contenedores | Dockerfile multietapa, etiquetas `10.0`, sin `USER` explícito | Usuario efectivo no privilegiado, permisos de archivos, actualización de imagen, escaneo del sistema operativo y capacidad de reconstruir el despliegue. No se construyó ni inspeccionó la imagen real. |
| Base de datos | SQLite por defecto, PostgreSQL en Render | Acceso privado, permisos mínimos, TLS de conexión, cifrado del volumen y protección del archivo SQLite si se usa. |
| Respaldo | `render.yaml` declara una base con `plan: free`; no hay política de recuperación documentada | Plan real, backups automáticos, copia fuera del servicio, retención y una restauración comprobada. La declaración del plan no demuestra que existan o falten copias. |
| Monitoreo | Logging general y errores del trabajador; sin auditoría de actor | Registros de acceso y correcciones, alertas, retención, acceso restringido y procedimiento de incidente. |
| GitHub/despliegue | No existe `.github` en el árbol actual | Protección de `main`, revisión de cambios, MFA de administradores, permisos de despliegue, escaneo de secretos y dependencias. La configuración externa no fue consultada. |
| Dispositivos | Hay datos de sesión/borradores en navegador | Bloqueo de pantalla, perfiles por operador, extensiones confiables y manejo de equipos compartidos. |

## Plan de corrección y criterios de aceptación

1. **Contención y acceso:** limitar el acceso de red a personal autorizado mientras se implementa S01; preservar respaldo y evidencia si existen sospechas de uso indebido. Desplegar autenticación y permisos reales junto con el cliente actualizado. Aceptación: cada ruta de negocio rechaza falta de sesión y permisos insuficientes; el health check no entrega datos comerciales.
2. **Identidad y sesiones:** retirar administrador de fábrica, migrar contraseñas a hash, crear cuentas individuales y definir expiración/revocación. Aceptación: no existe `demo-admin-token`, cambiar un objeto del navegador no otorga acceso y salir invalida la sesión según el diseño elegido.
3. **Integridad contable:** bloquear edición directa de tiradas cerradas, corregir concurrencia y overflow, validar transiciones de mesas y conservar movimientos/auditoría. Aceptación: los casos S04–S07 son rechazados o pasan por un flujo explícito y trazable; dos operaciones no pueden gastar el mismo saldo.
4. **Disponibilidad y dependencias:** acotar fechas, cantidades, bucles, consultas e intentos; actualizar paquetes afectados. Aceptación: las entradas extremas se rechazan antes de generar trabajo, se pagina el historial y se vuelve a revisar la auditoría sin omitir el alcance real de cada aviso.
5. **Operación:** separar migraciones y cuenta de datos, verificar TLS/red, usuario de contenedor, backups y restauración. Aceptación: evidencias del despliegue y una prueba de recuperación, además de CI con pruebas de seguridad que esperen el comportamiento seguro.

Una implementación solo de login no completa el plan: los problemas de integridad y disponibilidad también afectan a operadores legítimos y a errores de uso.

## Validación y evidencias

| Verificación | Resultado |
| --- | --- |
| Sondas específicas de esta revisión | 13 de 13 reproducen los comportamientos descritos |
| Suite normal del backend, después de retirar las sondas | 78 aprobadas |
| `npm test` | 24 aprobadas |
| `npm run lint` | Aprobado |
| `npm run build` | Aprobado; advertencia de tamaño de chunks |
| `npm audit --json` | 4 paquetes: 1 crítico y 3 altos según el feed consultado |
| `npm audit --omit=dev --json` | 1 paquete, DOMPurify, crítico según el feed consultado |
| `dotnet list ... package --vulnerable --include-transitive --format json` | Sin paquetes vulnerables informados para el backend |
| Búsqueda acotada de secretos en historial | Sin credenciales reales confirmadas; 3 coincidencias de URLs de muestra en pruebas |

Las suites funcionales aprobadas no acreditan seguridad. En particular, los contratos existentes esperan un token fijo y ejecutan operaciones anónimas; deberán actualizarse al implementar la autenticación. Las sondas de este informe afirman deliberadamente el comportamiento vulnerable para dejar evidencia: que pasen significa que se reprodujo el problema.

Se utilizó `-p:BaseOutputPath=bin/security-review/` para compilar y probar en una carpeta separada del backend que estaba en ejecución. Las solicitudes de las sondas solo alcanzaron el host efímero de pruebas.

Archivos de evidencia: [instrucciones y sondas](security-review/2026-10-27/README.md), [resultado TRX](security-review/2026-10-27/security-audit.trx), [npm](security-review/2026-10-27/npm-audit.json), [npm de producción](security-review/2026-10-27/npm-audit-production.json), [NuGet](security-review/2026-10-27/nuget-audit.json), [resumen de búsqueda de secretos](security-review/2026-10-27/secret-scan-summary.json) y [coincidencias de base de datos redactadas](security-review/2026-10-27/database-url-scan-redacted.json).

Referencias adicionales: [OWASP REST Security](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html), [cabeceras HTTP de OWASP](https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html), [aviso DOMPurify sobre hooks IN_PLACE](https://github.com/cure53/DOMPurify/security/advisories/GHSA-mrv2-3pqr-j5jr). Los avisos concretos de cada dependencia y sus rangos quedan identificados en el JSON de npm.
