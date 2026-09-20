# Gestión de Mesas API

API ASP.NET Core Minimal API con Entity Framework Core y PostgreSQL. En el primer arranque crea automáticamente las categorías, productos, mesas de muestra y el usuario `admin` / `admin`.

## Desarrollo local

Definí la variable `ConnectionStrings__Restaurant` con una cadena de conexión de PostgreSQL antes de ejecutar `dotnet run`. La API queda disponible normalmente en `http://localhost:5000` y el cliente Vite la consume mediante `http://localhost:5000/api`.

## Despliegue en Render

El archivo `render.yaml` crea un servicio Docker y una base PostgreSQL administrada. La variable `ConnectionStrings__Restaurant` se obtiene automáticamente de la base. Render expondrá el puerto asignado a través de `ASPNETCORE_URLS`.

Para el frontend desplegado, definí la variable `VITE_API_URL` con la URL pública de Render seguida de `/api` y generá nuevamente el build del frontend.