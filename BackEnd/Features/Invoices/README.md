# Facturas

Archivo de documentos vinculado a proveedores existentes. Registrar una factura no modifica compras, reservas ni cuentas corrientes.

## Almacenamiento

Los nuevos escaneos se guardan en Cloudinary como PDF `raw` con entrega `private`. La base conserva los metadatos, el proveedor, el nombre del cloud, `asset_id` y `public_id`; el contenido binario queda vacío. No existe fallback a la base para nuevas subidas si Cloudinary falla o no está configurado.

La API recibe el PDF comprimido, firma la operación con SHA-256 y realiza la subida desde el servidor. La consulta del PDF pasa por la sesión y los permisos de la API; el navegador no recibe credenciales ni URLs públicas de Cloudinary. Las respuestas del proveedor y las solicitudes firmadas no se registran en los logs del cliente HTTP.

## Configuración privada del backend

Configurar en el entorno de la API (local o Render):

- `Cloudinary__CloudName`
- `Cloudinary__ApiKey`
- `Cloudinary__ApiSecret`

Alternativamente, definir únicamente `CLOUDINARY_URL` con el formato de conexión provisto por Cloudinary. Las tres variables separadas tienen prioridad; no mezclar una configuración parcial con la URL. `Cloudinary__InvoiceFolder` es opcional y usa `shop-family/facturas` por defecto. No usar variables `VITE_` para estas credenciales. `.env.example` documenta los nombres, pero .NET no carga ese archivo automáticamente.

En Render, configurar las variables privadas declaradas en `render.yaml` y reiniciar/desplegar la API. En local, exportarlas al proceso antes de iniciar la API. No es necesario un upload preset. Una configuración ausente no impide iniciar el resto del sistema: al intentar guardar un escaneo devuelve un error 503 con instrucciones.

## Consistencia y archivos anteriores

Antes de cada subida se persiste una tarea de recuperación con un identificador opaco y único. La factura y su referencia se confirman en una transacción local, eliminando esa tarea. Una subida interrumpida o una falla al guardar los metadatos deja una tarea para recuperar el archivo huérfano a partir de las 24 horas.

Al eliminar una factura, se registra una tarea de eliminación en la misma transacción. `InvoiceStorageWorker` procesa las tareas cada 30 segundos y reintenta los fallos con espera creciente. No elimina activos que sigan referenciados por una factura y no opera sobre otra cuenta de Cloudinary si cambió la configuración. La migración usa una actualización condicional para que una sola instancia confirme la referencia. Las subidas redundantes quedan sujetas a limpieza; la eliminación remota es idempotente.

Los documentos previamente guardados en la base siguen siendo legibles. Cuando Cloudinary está configurado, el worker migra uno por ciclo: borra los bytes locales únicamente después de confirmar la subida y la actualización de la referencia. Si falla, conserva el original. La actualización del esquema es idempotente en SQLite y PostgreSQL. Las copias de seguridad de la base conservan las referencias, pero deben acompañarse con una estrategia de recuperación de la cuenta de Cloudinary.

## Módulos

- `InvoiceService`: validación, búsqueda, paginación y proveedor.
- `InvoiceFileStore`: contrato de preparación, lectura y eliminación; implementación de base para pruebas aisladas.
- `Storage/CloudinaryInvoiceClient`: transporte HTTPS y firmas; destinos fijos de la API de Cloudinary.
- `Storage/CloudinaryInvoiceFileStore`: referencias y tareas de recuperación.
- `Storage/InvoiceStorageMaintenance`: migración y limpieza reintentable.
- `InvoiceEndpoints`: operaciones autenticadas y recepción multipart limitada.
- `InvoiceModel` e `InvoiceSchemaUpgrade`: modelo y esquema compatible.

El cliente mantiene el recorte, corrección de perspectiva y tratamiento de documento o color. Reduce las imágenes a 1800 píxeles de lado y comprime a JPEG antes de generar el PDF; no se suben las fotografías originales. Límites: 10 páginas y 8 MB por PDF; imágenes de hasta 20 MB y 40 megapíxeles. La cámara integrada requiere HTTPS o localhost y permiso. No incluye OCR.

Referencias oficiales: [archivos raw y entregas privadas](https://cloudinary.com/documentation/upload_parameters), [firmas de autenticación](https://cloudinary.com/documentation/authentication_signatures), [Upload API: carga, descarga por asset ID y eliminación](https://cloudinary.com/documentation/image_upload_api_reference).
