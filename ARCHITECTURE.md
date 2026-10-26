# Organización del proyecto

## Frontend

`FrontEnd/gestion-mesas-shop/src/App.jsx` compone navegación y pantallas. `app/useRestaurantData.js` mantiene la carga y actualización de los datos compartidos del salón.

- `features/`: pantallas, estilos, componentes y hooks por funcionalidad. Las pantallas pequeñas permanecen juntas; configuraciones, proveedores, cigarrillos, pedidos y cajas separan formularios, historial y operaciones.
- `features/salon/`: plano, edición y operaciones de mesas, consumos y asignación de pedidos.
- `features/cigarettes/domain/`: cálculos de cierres, fechas y borradores. Los comprobantes reutilizan los cálculos financieros.
- `features/printing/`: apertura/escritura de ventanas, plantillas independientes por comprobante y exportación PDF.
- `shared/api/`: transporte HTTP y resolución del endpoint local o de producción.
- `shared/utils/`: formatos monetarios, fechas, búsqueda, escape HTML y contratos del ticket de bienvenida.
- `styles/`: estilos base y variables de tema. Se conserva el orden de carga de CSS para mantener la cascada existente.

Los hooks de sesión, navegación y apariencia conservan las claves de almacenamiento existentes. Los cambios de configuración del ticket siguen guardándose en la API.

Desde la carpeta del frontend:

```sh
npm test
npm run lint
npm run build
```

## Backend

`BackEnd/Program.cs` compone el arranque. `Hosting/` configura servicios, CORS, puerto de Render y registro de endpoints.

- `Features/`: endpoints, contratos, entidades y servicios por dominio. Se mantiene el namespace público para conservar los contratos y el modelo persistido.
- `Infrastructure/Persistence/`: contexto EF, selección SQLite/PostgreSQL, inicialización, actualizaciones existentes del esquema y datos iniciales.
- Los servicios de cigarrillos separan inventario, consultas y cierres. El registro de movimientos de proveedores concentra las operaciones de saldo compartidas.
- `BackEnd.Tests/`: pruebas de servicios y contratos HTTP con servidor en puerto efímero y SQLite aislado, además de inicialización y configuración de conexiones.

Desde la raíz:

```sh
dotnet test BackEnd.Tests/GestionMesas.Api.Tests.csproj -c Release
dotnet build BackEnd/GestionMesas.Api.csproj -c Release
```

Release permite verificar mientras la API de desarrollo mantiene abierto su ejecutable Debug. Los archivos de despliegue y las variables de entorno siguen en sus ubicaciones actuales.
