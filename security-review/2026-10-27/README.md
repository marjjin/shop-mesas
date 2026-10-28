# Evidencias de la revisión de seguridad

Estas evidencias corresponden al código `8579a7e`, revisado el 27 de octubre de 2026. El informe y sus límites están en [SECURITY_REVIEW.md](../../SECURITY_REVIEW.md).

`SecurityAuditProbe.cs.txt` conserva las 13 sondas utilizadas. No forma parte de la compilación ni de la suite normal. Sus aserciones **confirman comportamientos vulnerables**: no deben confundirse con pruebas que exigen que el sistema sea seguro. El resultado obtenido es `security-audit.trx`.

Las sondas usan `ApiTestHost`, rutas locales, SQLite en memoria y datos ficticios. La prueba de concurrencia abre dos contextos sobre una base en memoria y fuerza que ambos lean el saldo previo. La aceptación de una fecha extrema se comprueba con el trabajador periódico desactivado; no se ejecuta el bucle masivo de cobro ni se hace una prueba de agotamiento de recursos.

Para reproducir desde la raíz del repositorio, en una copia de trabajo sin un archivo preexistente `BackEnd.Tests/SecurityAuditProbe.cs`:

```powershell
Copy-Item -LiteralPath security-review/2026-10-27/SecurityAuditProbe.cs.txt -Destination BackEnd.Tests/SecurityAuditProbe.cs
dotnet test BackEnd.Tests/GestionMesas.Api.Tests.csproj --no-restore -p:BaseOutputPath=bin/security-review/ --filter FullyQualifiedName~SecurityAuditProbe --logger 'trx;LogFileName=security-audit.trx' --results-directory BackEnd.Tests/bin/security-review/evidence
Remove-Item -LiteralPath BackEnd.Tests/SecurityAuditProbe.cs
```

Después de corregir la aplicación es esperable que varias sondas dejen de pasar; entonces corresponde escribir pruebas permanentes que esperen rechazos, autorización e integridad.

- `npm-audit.json`: resultado completo del registro npm; salida de auditoría 1 por avisos encontrados.
- `npm-audit-production.json`: resultado excluyendo dependencias de desarrollo; salida 1.
- `nuget-audit.json`: consulta de vulnerabilidades de paquetes del backend, incluidas transitivas; salida 0.
- `secret-scan-summary.json`: conteo de patrones seleccionados sobre el historial disponible, sin imprimir valores sensibles. No equivale a una auditoría exhaustiva con un detector especializado. Excluye `package-lock.json`.
- `database-url-scan-redacted.json`: las tres coincidencias de URL con credenciales se ubicaron en ejemplos de pruebas de `DatabaseInitializationTests.cs`, commit `7d65553`. Los valores están redactados en la evidencia; no se confirmó un secreto real.

Las versiones corregidas consultadas con `npm view` fueron DOMPurify 3.4.17, Vite 8.3.5, source-map-js 1.2.2 y Zod 4.6.6. No se actualizó ningún paquete durante la revisión. El feed de npm y el mantenedor de DOMPurify difieren en la severidad de algunos avisos; el informe distingue ese resultado automático de la explotabilidad del flujo usado por la aplicación.
