# Gestión de mesas — Frontend

## Desarrollo

Requiere Node.js compatible con Vite 8 (22.12 o posterior).

```sh
npm ci
npm run dev
```

En desarrollo se usa `http://localhost:5000/api`. Para otra API, definí `VITE_API_URL` en `.env.local`.

## Vercel

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

## Comprobaciones

```sh
node --test src/shared/utils/apiUrl.test.js src/receipt.test.js
npm run build
```

Referencias: [Vite en Vercel](https://vercel.com/docs/frameworks/frontend/vite), [variables de entorno de Vercel](https://vercel.com/docs/environment-variables/managing-environment-variables).
