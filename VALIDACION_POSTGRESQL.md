# SHOP FAMILY: validación con PostgreSQL real

Fecha: 28 de octubre de 2026.

## Resultado

Se ejecutó la suite Release con los hosts HTTP conectados a **PostgreSQL 18.6 real, en Windows x64**, usando tanto el entorno `Production` como `Testing`. Cada host creó una base temporal independiente con nombre generado `shop_security_*`; no se usaron la conexión, los usuarios ni los datos de Render.

| Comprobación | Resultado |
| --- | --- |
| Suite con HTTP sobre PostgreSQL y pruebas unitarias existentes sobre SQLite | 112 aprobadas, 0 fallidas, 0 omitidas |
| Suite normal sin PostgreSQL habilitado | 111 aprobadas, 0 fallidas, 1 omitida: migración exclusiva de PostgreSQL |
| Pruebas del frontend | 28 aprobadas |
| Lint del frontend | Aprobado |
| Build del frontend | Aprobado; advertencia de tamaño de chunks |
| Bases temporales restantes después de las pruebas | 0 |

Los tests de servicios que crean explícitamente SQLite siguen utilizando SQLite; habilitar PostgreSQL afecta a los hosts HTTP y al caso de migración específico. El resultado de 112 pruebas no significa que todas sean pruebas SQL de PostgreSQL.

## Qué se verificó

- Rechazo de las rutas de negocio sin sesión y con tokens inventados, vencidos o revocados.
- Login válido, hash de contraseñas, almacenamiento del hash del token y vencimiento de sesión.
- Logout y revocación de sesiones al cambiar credenciales.
- Cambio de usuario y de contraseña, conservando el ID de cuenta y sus datos; rechazo de colisiones y selección explícita entre administradores cuando corresponde.
- Respuestas y preflight CORS con el origen `https://gestion-mesas-shop.vercel.app`.
- Contratos HTTP de configuración de bienvenida, mesas, pedidos, historial, cafetería, cigarrillos, tiradas, proveedores y cierre de turno.
- Migración de una cuenta con contraseña en texto y sin columna `Role`, sin la tabla `UserSessions`, y de un esquema antiguo de proveedores que guardaba `Balance`.
- Conservación de mesa, consumos, ventas de café, cierre, tirada, saldo reservado, cuenta corriente, transacción de proveedor y textos/importes de configuración durante la migración.
- Repetición del arranque sin duplicar datos, cambiar innecesariamente el hash ni revocar una sesión cuando las credenciales no cambian.

## Fallo encontrado y corregido

La primera ejecución falló con el error PostgreSQL `42703: column "Balance" does not exist`. `PostgresSchemaUpgrade` intentaba copiar siempre `Suppliers.Balance`, incluso cuando la base había sido creada con el modelo actual, que ya no tiene esa columna.

Se cambió la actualización para obtener el campo antiguo mediante `to_jsonb(supplier) ->> 'Balance'`: si la columna existe conserva su saldo; si no existe, utiliza cero únicamente para saldos nuevos que estén en NULL. Los saldos ya informados no se sobrescriben. Después se ejecutaron correctamente tanto el caso de base nueva como el de migración del esquema anterior.

## Aislamiento de la prueba

- Instancia PostgreSQL portátil obtenida del distribuidor enlazado por la [página oficial de PostgreSQL para Windows](https://www.postgresql.org/download/windows/), mediante los [binarios de EDB](https://www.enterprisedb.com/download-postgresql-binaries). No se instaló un servicio de Windows.
- Escuchó únicamente en `127.0.0.1`, en un puerto temporal distinto del de la aplicación.
- Credenciales aleatorias exclusivas de la prueba, sin mostrarlas ni agregarlas a Git.
- `PostgresTestDatabase` rechaza hosts externos y cadenas que no utilicen `postgres` como base de control antes de abrir la conexión. Crea y elimina únicamente sus bases nuevas con identificadores generados.
- Se comprobó que no quedaran bases `shop_security_*` después de ejecutar los tests. La instancia temporal se detuvo al terminar.

## Repetir la validación

Primero prepará un **servidor PostgreSQL local exclusivo de pruebas**, sin túneles a producción, con un usuario que pueda crear y eliminar bases de prueba. No utilices la cadena de Render.

La cadena de control debe tener el formato `Host=127.0.0.1;Port=PUERTO_LOCAL;Database=postgres;Username=USUARIO_DE_PRUEBA;Password=CLAVE_DE_PRUEBA`. Ingresala en el siguiente prompt oculto, sin escribir una contraseña real en el historial:

```powershell
$cadena = Read-Host 'Cadena de PostgreSQL local exclusivo de pruebas' -AsSecureString
$env:SHOP_MESAS_TEST_POSTGRES = [System.Net.NetworkCredential]::new('', $cadena).Password
$cadena.Dispose()
try {
  dotnet test BackEnd.Tests/GestionMesas.Api.Tests.csproj -c Release -p:BaseOutputPath=bin/postgres-check/ --logger 'trx;LogFileName=postgresql18-validation.trx' --results-directory BackEnd.Tests/bin/postgres-check/evidence
}
finally {
  Remove-Item Env:\SHOP_MESAS_TEST_POSTGRES -ErrorAction SilentlyContinue
}
```

Sin `SHOP_MESAS_TEST_POSTGRES`, el host vuelve al modo SQLite y el test exclusivo de migración PostgreSQL figura como omitido. Las tres pruebas de rechazo de conexiones externas/no permitidas siempre se ejecutan y no abren esas conexiones.

## Evidencias y límites

- [Resultado PostgreSQL](security-review/2026-10-28/postgresql18-validation.trx).
- [Regresión SQLite](security-review/2026-10-28/sqlite-regression.trx).
- [Resumen de validación](security-review/2026-10-28/validation-summary.json).

Esta validación comprueba los flujos descritos y un esquema anterior reconstruido con datos ficticios. No constituye una prueba sobre una copia de la base real de Render, su contenido completo, sus permisos, TLS, red, Docker/Linux o el navegador de producción. El trabajador periódico mantiene sus pruebas específicas y no se ejecuta dentro de los hosts HTTP.

No se hizo deploy ni push. La aplicación publicada seguirá con su código anterior hasta que se desplieguen las versiones compatibles de backend y frontend con las variables de entorno configuradas. Los demás hallazgos del informe de seguridad siguen pendientes.
