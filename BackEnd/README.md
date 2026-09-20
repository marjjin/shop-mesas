# Gestión de Mesas API

API ASP.NET Core Minimal API con Entity Framework Core y SQLite. En el primer arranque crea automáticamente las categorías, productos, mesas de muestra y el usuario `admin` / `admin`.

## Desarrollo local

Ejecutá `dotnet run` dentro de esta carpeta. La API queda disponible normalmente en `http://localhost:5000` y el cliente Vite la consume mediante `http://localhost:5000/api`.

## Despliegue en Render

El archivo `render.yaml` y el `Dockerfile` ya están incluidos. Creá un servicio desde el repositorio seleccionando Docker. Render expondrá el puerto asignado a través de `ASPNETCORE_URLS` y montará un disco en `/app/data`, donde se conserva la base SQLite entre despliegues.

Para el frontend desplegado, definí la variable `VITE_API_URL` con la URL pública de Render seguida de `/api` y generá nuevamente el build del frontend.