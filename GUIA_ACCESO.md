# SHOP FAMILY: cambiar usuario y contraseña

Los comandos de esta guía se ejecutan en **PowerShell, desde la carpeta `shop-mesas`**. El script local utiliza `BackEnd/gestion-mesas.db`. No cambia el servicio ni la base de producción.

## Cambiar solamente el usuario

Reemplazá `nuevo_usuario` por el nombre que quieras usar:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\Start-Local.ps1 -Username "nuevo_usuario"
```

Cuando aparezca la pregunta de la clave, escribí **tu contraseña actual** y presioná Enter para conservarla. La contraseña se ingresa de forma oculta: sin mostrar caracteres o mostrando asteriscos, según la versión de PowerShell.

Esperá a que aparezca el mensaje de que la API está escuchando, recargá el navegador e ingresá con el usuario nuevo y la misma contraseña. El usuario anterior deja de servir. El nombre nuevo queda guardado en la misma cuenta; no se crea otra ni se reasignan ventas, mesas, proveedores o cierres.

El usuario puede tener entre 1 y 100 caracteres; se quitan espacios al principio y al final. No puede quedar vacío, contener caracteres de control ni coincidir con otra cuenta, aunque cambien las mayúsculas.

## Cambiar solamente la contraseña

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\Start-Local.ps1
```

Ingresá **la nueva contraseña** cuando la terminal la pida. El script conserva el nombre de usuario guardado, aunque ya no sea `admin`. Después de arrancar la API, recargá la página e ingresá con ese usuario y la contraseña nueva.

No hay un mínimo de longitud. Se rechazan contraseñas vacías o compuestas solo por espacios, `admin`, valores de ejemplo que contengan `CHANGE_ME` y contraseñas de más de 1024 caracteres.

## Cambiar usuario y contraseña juntos

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\Start-Local.ps1 -Username "nuevo_usuario"
```

Esta vez escribí **la nueva contraseña** en la pregunta de la terminal. Después ingresá con ambos valores nuevos.

## Arrancar otro día sin cambiar las credenciales

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\Start-Local.ps1
```

Ingresá **la contraseña actual**. Sin `-Username`, se conserva el usuario que ya estaba guardado. No hace falta volver a poner el nombre nuevo en cada arranque.

El script compila la versión actual en una carpeta nueva para evitar archivos bloqueados por la API abierta, comprueba que el proceso del puerto 5000 pertenece a este repositorio, detiene esa API y hace un respaldo antes del arranque. Los respaldos quedan en `BackEnd/bin/local-dev/backups/`. El cambio se aplica cuando la API inicia correctamente. Ctrl+C detiene la API que arrancaste en esa terminal. Si la terminal ya está ocupada mostrando los logs del servidor, podés usar otra terminal del proyecto para ejecutar el cambio.

## Si no aparece la pregunta de la contraseña

Puede haber una variable de entorno ya definida en tu terminal. Para que el próximo arranque vuelva a pedirla, ejecutá:

```powershell
Remove-Item Env:\Authentication__AdminPassword -ErrorAction SilentlyContinue
powershell -NoProfile -ExecutionPolicy Bypass -File .\Start-Local.ps1
```

Eliminar esa variable del entorno de la terminal no borra la contraseña de la base: permite ingresar el valor que querés usar en el siguiente arranque.

Si antes definiste manualmente `Authentication__AdminUsername`, ese valor se vuelve a aplicar al arrancar. Podés actualizarlo o quitarlo de esa terminal para conservar el usuario guardado:

```powershell
Remove-Item Env:\Authentication__AdminUsername -ErrorAction SilentlyContinue
```

El script restaura las variables que tenía la terminal al terminar. No guarda tu contraseña en un archivo ni la muestra en pantalla. No la escribas como parte del comando ni la agregues a un archivo versionado.

## Si tenés varias cuentas administradoras

Con una sola cuenta administradora, el script la identifica aunque hayas cambiado el nombre. Si todavía existe la cuenta administradora llamada `admin`, esa es la cuenta elegida por defecto. Cuando hay varias cuentas administradoras y ninguna se llama `admin`, el servidor exige elegir una por su ID para evitar cambiar otra cuenta por error.

Ejemplo para una cuenta cuyo ID comprobaste que es `1`:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\Start-Local.ps1 -AdminUserId 1 -Username "nuevo_usuario"
```

Usá el ID real de la cuenta que quieras modificar. El ID aparece en `user.id` de la respuesta autenticada de `/api/session` o de login; la cuenta inicial suele tener ID 1. El script no crea una cuenta si ese ID no existe ni convierte otro rol en administrador. Si dejás `Authentication__AdminUserId` definido en el entorno, seguirá seleccionando esa cuenta al reiniciar.

## Producción: variables del backend en Render

`Start-Local.ps1` sirve para localhost. Para el servicio publicado, los valores se definen en las variables de entorno de **la API en Render**:

1. En la lista de servicios de Render, abrí **`shop-mesas`** (el servicio web Docker de esta aplicación).
2. Entrá a **Environment**, en el menú lateral.
3. En **Environment Variables**, usá **+ Add Environment Variable** para agregar cada clave y su valor. Si la clave ya existe, editá esa fila.
4. Si solo querés preparar la configuración sin publicar todavía, abrí el desplegable de guardado y elegí **Save only**. Esa opción guarda los valores sin hacer deploy; se aplican en el próximo despliegue. Ver [documentación oficial de Render](https://render.com/docs/configure-environment-variables).

Además de las credenciales de la tabla siguiente, el origen permitido del frontend es `Cors__AllowedOrigins__0=https://gestion-mesas-shop.vercel.app`, sin comillas. Conservá el valor de `ConnectionStrings__Restaurant` que conecta la API a su base existente. Estas variables se configuran en el servicio `shop-mesas`, no en `gestion-mesas-db` ni en el servicio de otra aplicación.

| Variable | Efecto |
| --- | --- |
| `Authentication__AdminUsername` | Opcional: establece el nombre de ingreso de la cuenta administradora elegida. Sin esta variable se conserva el nombre guardado. |
| `Authentication__AdminPassword` | Establece su contraseña. Es necesaria en una instalación nueva o si sigue usando el acceso de fábrica. |
| `Authentication__AdminUserId` | Opcional: elige la cuenta por un ID existente cuando hay varios administradores. |

Para cambiar solo el usuario, modificá `Authentication__AdminUsername` y conservá el valor actual de la contraseña. Para cambiar solo la contraseña, modificá `Authentication__AdminPassword` y conservá el nombre actual. Para cambiar ambos, actualizá ambas variables. Los cambios se aplican al reiniciar el servicio con una versión que incluya esta funcionalidad.

Estas variables deben mantener los valores deseados: si una variable conserva un valor anterior, ese valor volverá a aplicarse al próximo arranque. Son configuración del servidor, no variables `VITE_` del frontend. No hay que cambiar `ConnectionStrings__Restaurant` ni crear otra base para cambiar las credenciales.

Al cambiar realmente el usuario o la contraseña se revocan las sesiones de esa cuenta y hay que volver a ingresar. Reiniciar con los mismos valores no cambia el hash ni revoca sesiones vigentes. Las credenciales del localhost y las de Render son independientes.

No se realizó ningún deploy como parte de la preparación de esta guía. La [validación con PostgreSQL 18.6 real](VALIDACION_POSTGRESQL.md) ya se completó en una instancia local aislada. Antes de publicar, conservá un respaldo, comprobá la configuración del servicio real y coordiná las versiones compatibles de frontend y backend, según [BackEnd/README.md](BackEnd/README.md).

Guardar variables no instala el código nuevo: la autenticación y el cambio de usuario descritos requieren que el backend actualizado esté desplegado y que el frontend sea compatible.
