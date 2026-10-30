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

El cliente mantiene el recorte, corrección de perspectiva y tratamiento de documento o color. Conserva hasta 2400 píxeles de lado sin ampliar imágenes pequeñas y comprime a JPEG con parámetros de calidad de 0,90 a 0,78. Busca unas 700 KiB por página; prioriza la legibilidad si no alcanza ese objetivo. No se suben las fotografías originales. El límite final continúa siendo 10 páginas y 8 MB por PDF; si se supera, se pide dividir el documento en lugar de seguir degradando el texto. Admite imágenes de entrada de hasta 20 MB y 40 megapíxeles. La cámara integrada requiere HTTPS o localhost y permiso. Al entrar por una IP local con HTTP o sin soporte de getUserMedia, el botón usa el selector de captura del dispositivo (`capture=environment`); el navegador decide si abre la cámara o un selector. El modo Elegir imagen conserva el selector de archivos. Las páginas del borrador no dependen de randomUUID en conexiones HTTP. No incluye OCR.

La detección de bordes y la corrección geométrica usan OpenCV.js, dentro de un worker que se carga al seleccionar la primera imagen y se reutiliza hasta cerrar el editor. No requiere claves de un servicio de escaneo ni envía las fotos a terceros para procesarlas. Siempre se revisan las esquinas antes de aplicar el recorte. Ver versiones, módulos y validación en [el módulo del escáner](../../../FrontEnd/gestion-mesas-shop/src/features/invoices/scanner/README.md).

Referencias oficiales: [archivos raw y entregas privadas](https://cloudinary.com/documentation/upload_parameters), [firmas de autenticación](https://cloudinary.com/documentation/authentication_signatures), [Upload API: carga, descarga por asset ID y eliminación](https://cloudinary.com/documentation/image_upload_api_reference).
