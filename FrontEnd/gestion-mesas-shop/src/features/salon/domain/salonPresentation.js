// Quita acentos y mayúsculas para buscar sin importar cómo se escriba.
const normalize = (value) => (value || '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es-AR')

// Filtra mesas por estado y por nombre de mesa o cliente.
export function filterSalonTables(tables, { search = '', status = 'all' } = {}) {
  const query = normalize(search)
  return tables.filter((table) => (status === 'all' || table.status === status)
    && (normalize(table.name).includes(query) || normalize(table.customerName).includes(query)))
}

// Cuenta mesas libres y ocupadas, y calcula el porcentaje de ocupación.
export function getSalonSummary(tables) {
  const occupied = tables.filter((table) => table.status === 'occupied').length
  return { total: tables.length, occupied, free: tables.filter((table) => table.status === 'free').length,
    occupancy: tables.length ? Math.round(occupied / tables.length * 100) : 0 }
}

// Área máxima del plano. Coincide con el límite que aplica la API al guardar.
export const FLOOR_LIMITS = { x: 2400, y: 1600 }
const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || 0))

// Mesas con posición fuera del área (negativa o enorme) se dibujan en el borde, así siempre se ven.
export function placeTablesOnFloor(tables) {
  return tables.map((table) => {
    const x = clamp(table.x, 0, FLOOR_LIMITS.x)
    const y = clamp(table.y, 0, FLOOR_LIMITS.y)
    return x === table.x && y === table.y ? table : { ...table, x, y }
  })
}

// El lienzo crece según la mesa más alejada, con un tamaño mínimo.
export function getFloorBounds(tables) {
  return {
    width: Math.max(760, ...tables.map((table) => table.x + table.width + 60)),
    height: Math.max(560, ...tables.map((table) => table.y + table.height + 60)),
  }
}

// Zoom para que el plano entre en el ancho disponible, entre 25% y 100%.
export function fitFloorToWidth(viewportWidth, canvasWidth) {
  return viewportWidth > 0 ? Math.min(1, Math.max(.25, (viewportWidth - 48) / canvasWidth)) : 1
}
