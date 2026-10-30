# Escaneo de facturas

El flujo captura una imagen, propone las esquinas, permite corregirlas y genera una página enderezada en modo documento o color. El PDF final conserva el flujo existente de proveedor y subida privada a Cloudinary. No incluye OCR ni captura automática en vivo.

## Organización

- `CameraCapture` y `browserCapture`: cámara integrada con HTTPS/localhost y captura nativa del dispositivo al entrar por HTTP. El navegador controla el selector nativo.
- `scanClient`: lectura orientada de la imagen, reducción a 2400 píxeles sin ampliar, compresión JPEG y URLs del borrador.
- `scanWorkerClient`: worker por editor, iniciado al elegir la primera imagen; correlación de solicitudes, cancelación, límite de 45 segundos y liberación al cerrar. Reutiliza la inicialización entre páginas.
- `scan.worker`: carga el motor local y procesa imágenes fuera de la interfaz. Nunca transfiere la imagen original del borrador al worker con transferencia de propiedad.
- `openCvRuntime`: inicialización compatible con el thenable de Emscripten; no debe usarse `await cvModule` ni importar dinámicamente la distribución CommonJS, porque su `then` puede provocar adopción recursiva.
- `openCvScanner`: contorno de jscanify, coordenadas normalizadas, corrección de perspectiva OpenCV y liberación de matrices WASM. La detección usa una copia de hasta 1000 píxeles; el resultado conserva la resolución de trabajo de hasta 2400.
- `ScanCropEditor`: revisión accesible de las cuatro esquinas; informa cuando no se encuentra un documento y permite recortarlo manualmente.
- `processImage` y `geometry`: tratamiento de iluminación, geometría y corrección compatible sin OpenCV cuando el worker puede continuar sin ese motor.

La primera imagen carga el worker de aproximadamente 11 MB sin compresión HTTP, incluyendo el WASM. El resto de las pantallas no descarga ese archivo. No depende de CDN ni de cuentas externas para detectar o corregir; no se envían fotos a un servicio de escaneo. El runtime se libera al cerrar el editor. La detección requiere bordes visibles y contraste; no garantiza reconocer todos los documentos.

## Dependencias y licencias

- jscanify: código de los métodos de detección del paquete npm `jscanify@1.4.3`, cuyo archivo de navegador conserva una cabecera v1.4.0. Adaptado en `vendor/jscanify.js` para ES modules e inyección de OpenCV, sin los métodos DOM no utilizados, con liberación explícita de contornos y limpieza en errores. Se conserva su licencia MIT. Se incluye la parte de navegador en lugar de instalar las dependencias de Node (`canvas`, `jsdom`) que el cliente no utiliza. Fuente: https://github.com/puffinsoft/jscanify.
- OpenCV: distribución npm fijada `@techstark/opencv-js@4.12.0-release.1`, Apache-2.0, incluida en el worker por Vite. Fuente: https://github.com/TechStark/opencv-js. Las referencias a `fs`, `path` y `crypto` de esa distribución pertenecen a su ruta Node, que no se ejecuta en el navegador.
- Los avisos y licencias distribuidos están en `public/licenses/`.

## Validación

`npm test` ejercita el motor WASM real con una factura inclinada y texto, ausencia de contornos, objetos pequeños, conservación de colores, perspectiva, contraste y ciclo de vida del worker. `npm run lint` valida el cliente.

Después de `npm run build`, ejecutar `npm run verify:scanner`: inicia el worker compilado en una VM con contexto de worker y sin las APIs de Node; verifica que se cargue OpenCV y se realicen detección y corrección. Complementa las pruebas del módulo; no sustituye la revisión en navegadores móviles reales ni prueba los permisos de cámara.
