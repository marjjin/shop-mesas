// Diseño del ticket de cierre: qué bloques existen, su orden, textos y márgenes.
// Funciones puras, sin React: las usan la impresión, la vista previa y el editor.

const row = (id, label) => ({ id, visible: true, label })
const section = (id, name, title, rows = []) => ({ id, type: 'section', name, visible: true, title, text: '', rows })

// Diseño de fábrica. name identifica el bloque en el editor aunque se borre su título.
const defaultBlocks = [
  section('header', 'Encabezado', '', [row('business', 'SHOP FAMILY'), row('title', 'CIERRE DE CIGARRILLOS')]),
  section('meta', 'Datos del turno', '', [row('date', 'Fecha'), row('shift', 'Turno'), row('closedAt', 'Cierre')]),
  section('sales', 'Detalle de ventas', 'DETALLE DE VENTAS'),
  section('salesTotal', 'Total de cigarrillos', '', [row('total', 'VENTAS CIGARRILLOS'), row('units', 'Unidades vendidas')]),
  section('reservation', 'Reserva de cigarrillos', 'RESERVA DE CIGARRILLOS', [row('cash', 'Efectivo reservado'), row('mercadoPago', 'Mercado Pago reservado'), row('total', 'Total reservado para cigarrillos')]),
  section('cafeteria', 'Caja Cafetería', 'CAJA CAFETERÍA'),
  section('suppliers', 'Proveedores', 'PROVEEDORES'),
  section('cashDrops', 'Tiradas', 'TIRADAS DE EFECTIVO', [row('total', 'Total tiradas')]),
  section('cashSummary', 'Arqueo y resultados', 'ARQUEO Y RESULTADOS', [
    row('cash', 'Efectivo en caja'), row('mercadoPago', 'Mercado Pago final'), row('posnet', 'Total Posnet'),
    row('nextChange', 'Cambio próximo turno'), row('receivedChange', 'Cambio recibido'), row('arqueo', 'Arqueo de caja'),
    row('lessCigarettes', '− Cigarrillos'), row('lessCafeteria', '− Caja Cafetería'), row('lessSuppliers', '− Proveedores sin caja aparte'),
    row('caja', 'Caja'), row('arqueoBase', 'Arqueo de caja'), row('plusSeparate', '+ Proveedores con caja aparte'), row('shiftSales', 'Ventas totales del turno'),
  ]),
  section('footer', 'Pie', '', [row('text', 'COMPROBANTE DE CIERRE')]),
]

export const createDefaultShiftTicketLayout = () => structuredClone({ margins: { top: 8, right: 6, bottom: 8, left: 6 }, blocks: defaultBlocks })

export const defaultShiftTicketBlock = (id) => defaultBlocks.find((block) => block.id === id)

// Une lo guardado con el diseño de fábrica. Así un bloque o renglón nuevo del sistema
// aparece aunque el diseño se haya guardado antes de que existiera.
export function normalizeShiftTicketLayout(saved) {
  const layout = createDefaultShiftTicketLayout()
  if (!saved?.margins || !Array.isArray(saved.blocks)) return layout
  const savedIds = new Set(saved.blocks.map((block) => block.id))
  const blocks = saved.blocks.flatMap((block) => {
    if (block.type === 'text' || block.type === 'signature') return [{ ...block, title: block.title ?? '', text: block.text ?? '', rows: [] }]
    const base = defaultShiftTicketBlock(block.id)
    if (!base) return []
    const savedRows = (block.rows ?? []).filter((item) => base.rows.some(({ id }) => id === item.id))
    const newRows = base.rows.filter(({ id }) => !savedRows.some((item) => item.id === id))
    return [{ ...structuredClone(base), visible: block.visible, title: block.title ?? '', rows: [...savedRows.map((item) => ({ ...item, label: item.label ?? '' })), ...structuredClone(newRows)] }]
  })
  return { margins: { ...saved.margins }, blocks: [...blocks, ...layout.blocks.filter(({ id }) => !savedIds.has(id))] }
}

const swap = (items, index, offset) => {
  const target = index + offset
  if (index < 0 || target < 0 || target >= items.length) return items
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]]
  return next
}

const mapBlock = (layout, blockId, change) => ({ ...layout, blocks: layout.blocks.map((block) => block.id === blockId ? change(block) : block) })

export const updateBlock = (layout, blockId, changes) => mapBlock(layout, blockId, (block) => ({ ...block, ...changes }))

export const updateRow = (layout, blockId, rowId, changes) => mapBlock(layout, blockId, (block) => ({ ...block, rows: block.rows.map((item) => item.id === rowId ? { ...item, ...changes } : item) }))

export const moveBlock = (layout, blockId, offset) => ({ ...layout, blocks: swap(layout.blocks, layout.blocks.findIndex(({ id }) => id === blockId), offset) })

export const moveRow = (layout, blockId, rowId, offset) => mapBlock(layout, blockId, (block) => ({ ...block, rows: swap(block.rows, block.rows.findIndex(({ id }) => id === rowId), offset) }))

export const removeBlock = (layout, blockId) => ({ ...layout, blocks: layout.blocks.filter(({ id }) => id !== blockId) })

// Los bloques propios se agregan antes del pie para que queden dentro del comprobante.
export function addCustomBlock(layout, type, id) {
  const block = { id, type, visible: true, title: type === 'signature' ? 'Firma' : '', text: '', rows: [] }
  const footer = layout.blocks.findIndex((item) => item.id === 'footer')
  const position = footer < 0 ? layout.blocks.length : footer
  return { ...layout, blocks: [...layout.blocks.slice(0, position), block, ...layout.blocks.slice(position)] }
}

// Quita lo que solo usa el editor y deja los márgenes como números.
export function toShiftTicketRequest(layout) {
  return {
    margins: Object.fromEntries(Object.entries(layout.margins).map(([side, value]) => [side, Number(value)])),
    blocks: layout.blocks.map(({ id, type, visible, title, text, rows }) => ({ id, type, visible, title: title.trim(), text: text.trim(), rows })),
  }
}

export function validateShiftTicketLayout(layout) {
  const margins = Object.values(layout.margins).map(Number)
  if (Object.values(layout.margins).some((value) => value === '') || margins.some((value) => !Number.isFinite(value) || value < 0 || value > 20 || Math.round(value * 10) / 10 !== value))
    return 'Los márgenes deben estar entre 0 y 20 mm, con hasta un decimal.'
  if (Number(layout.margins.left) + Number(layout.margins.right) > 40) return 'Los márgenes izquierdo y derecho no pueden sumar más de 40 mm.'
  if (layout.blocks.length > 40) return 'El ticket admite hasta 40 bloques.'
  if (layout.blocks.some((block) => block.title.length > 100)) return 'Los títulos admiten hasta 100 caracteres.'
  if (layout.blocks.some((block) => block.text.length > 1000)) return 'Los textos libres admiten hasta 1000 caracteres.'
  if (layout.blocks.some((block) => block.rows.some((item) => item.label.length > 100))) return 'Las etiquetas admiten hasta 100 caracteres.'
  return ''
}
