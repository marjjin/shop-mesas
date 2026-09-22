# Gestión de Mesas API

API ASP.NET Core Minimal API con Entity Framework Core y PostgreSQL. En el primer arranque crea automáticamente las categorías, productos, mesas de muestra y el usuario `admin` / `admin`.

## Desarrollo local

Ejecutá `dotnet run --urls http://localhost:5000`. Sin configuración adicional, la API usa SQLite y crea `gestion-mesas.db` localmente. La API queda disponible en `http://localhost:5000` y el cliente Vite la consume mediante `http://localhost:5000/api`.

Si preferís PostgreSQL, definí la variable `ConnectionStrings__Restaurant` con su cadena de conexión antes de iniciar la API; esa variable reemplaza automáticamente la configuración local.

## Despliegue en Render

El archivo `render.yaml` crea un servicio Docker y una base PostgreSQL administrada. La variable `ConnectionStrings__Restaurant` se obtiene automáticamente de la base. Render expondrá el puerto asignado a través de `ASPNETCORE_URLS`.

Para el frontend desplegado, definí la variable `VITE_API_URL` con la URL pública de Render seguida de `/api` y generá nuevamente el build del frontend.