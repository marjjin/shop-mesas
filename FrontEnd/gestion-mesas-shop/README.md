# Gestión de mesas — Frontend

## Desarrollo

Requiere Node.js compatible con Vite 8 (22.12 o posterior).

```sh
npm ci
npm run dev
```

En desarrollo, el navegador usa `/api` del propio servidor Vite, que reenvía las consultas a `http://localhost:5000/api`. Esto permite usar localhost o 127.0.0.1 incluso cuando Vite elige otro puerto, sin depender del CORS de la API. Para otra API, definí `VITE_API_URL` en `.env.local` y reiniciá Vite; el proxy conserva la ruta base configurada. El backend debe estar iniciado.

## Vercel

### Acceso desde el celular

La dirección pública es [https://gestion-mesas-shop.vercel.app](https://gestion-mesas-shop.vercel.app). Se puede abrir desde Chrome o Safari usando Wi-Fi o datos móviles. La cámara de Facturas necesita HTTPS y permiso del navegador. `localhost` en el celular apunta al propio teléfono y no al equipo de desarrollo.

El frontend se publica desde `main` en Vercel y consulta la API HTTPS de Render. En el servicio existente de Render debe estar habilitado el despliegue automático desde la misma rama. El health check de la API (`/`) incluye `commit`, tomado de `RENDER_GIT_COMMIT`, para comprobar que ambos servicios publicaron la actualización.

Para guardar escaneos en Cloudinary, sus variables privadas se configuran en Render; editar `.env.example` no configura el servicio publicado. Ver [configuración de Facturas](../../BackEnd/Features/Invoices/README.md). No es necesario crear otra base de datos ni otro servicio para esta actualización.

Configuración del proyecto:

- **Root Directory:** `FrontEnd/gestion-mesas-shop`.
- **Framework:** Vite.
- **Install Command:** `npm ci`.
- **Build Command:** `npm run build`.
- **Output Directory:** `dist`.
- **VITE_API_URL** en Production y Preview: `https://shop-mesas.onrender.com/api`, o la URL HTTPS de tu propia API.

El archivo `vercel.json` configura los comandos y la carpeta de salida. La carpeta raíz se selecciona en Vercel.

Sin `VITE_API_URL`, el build de producción usa la API pública histórica de Render. Si se indica solo el dominio, se agrega `/api` automáticamente. Una URL local o HTTP hace fallar el build de producción con un mensaje explícito para evitar publicar un cliente que dependa de localhost.

Las variables se incorporan durante la compilación: cambiar `VITE_API_URL` requiere generar un nuevo deploy.

## Publicar la edición de tickets

1. Publicá primero el backend actualizado en Render con su PostgreSQL configurado. Ver `BackEnd/README.md`.
2. Comprobá que `GET https://shop-mesas.onrender.com/api/settings/welcome-message` devuelva 200 y los campos `amount`, `businessName`, `greetingText`, `messageText`, `conditionsText`, `minimumLabel` y `footerText`.
3. Publicá el frontend en Vercel.

Un 404 en esa ruta significa que la API publicada todavía no contiene el endpoint, o que se configuró otra URL. El editor informa si el backend no admite los nuevos campos.

Los ajustes se guardan en la base de datos del backend. Tanto la apertura directa como la asignación de pedidos consultan la configuración guardada antes de imprimir. Las respuestas de configuración llevan `Cache-Control: no-store`.

## Apariencia

En **Configuraciones → Apariencia** se puede elegir Claro, Oscuro o Sistema. La opción Sistema sigue los cambios de apariencia del dispositivo. El botón del menú y el de inicio de sesión permiten alternar rápidamente entre claro y oscuro.

La preferencia se guarda en `localStorage` con la clave `mesa-theme`, por navegador y dominio. No requiere cambios en la API. `public/theme-init.js` aplica el tema antes de mostrar la aplicación y Vite lo incluye en el build de producción. La vista previa del ticket conserva los colores del papel.

## Comprobaciones

```sh
npm test
npm run build
```

Referencias: [Vite en Vercel](https://vercel.com/docs/frameworks/frontend/vite), [variables de entorno de Vercel](https://vercel.com/docs/environment-variables/managing-environment-variables).
