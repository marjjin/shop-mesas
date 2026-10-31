// Comprobante de cierre de un turno. El diseño decide el orden y los textos;
// los importes siempre salen del cierre.
import { localTime } from '../../../shared/utils/date.js'
import { escapeHtml } from '../../../shared/utils/html.js'
import { money as currency } from '../../../shared/utils/currency.js'
import { getCloseFinancialSummary } from '../../cigarettes/domain/closeFinancials.js'
import { createDefaultShiftTicketLayout } from '../shiftTicketLayout.js'
import { cigaretteReservationReceiptMarkup } from './cigaretteReservationReceipt.js'

const visibleRows = (block) => block.rows.filter((row) => row.visible)
const heading = (block) => block.title ? `<h3>${escapeHtml(block.title)}</h3>` : ''
const label = (block, id) => {
  const row = visibleRows(block).find((item) => item.id === id)
  return row ? escapeHtml(row.label) : null
}

// Cada función arma un bloque. Devuelve texto vacío si no hay nada para mostrar.
const sectionRenderers = {
  header: (block) => `<header>${visibleRows(block).map((row) => row.id === 'business' ? `<h1>${escapeHtml(row.label)}</h1>` : `<h2>${escapeHtml(row.label)}</h2>`).join('')}</header>`,

  meta: (block, { close, shiftName, businessDate }) => {
    const values = { date: businessDate, shift: shiftName, closedAt: localTime(close.closedAt) }
    return `<div class="meta">${visibleRows(block).map((row) => `<span>${escapeHtml(row.label)}: ${values[row.id]}</span>`).join('')}</div>`
  },

  sales: (block, { close }) => {
    // Solo imprime los productos que tuvieron ventas.
    const items = close.items.filter((item) => item.soldQuantity > 0).map((item) => `<div class="item">
    <div class="item-title"><b>${escapeHtml(item.productName)}</b><strong>${currency.format(item.salesAmount)}</strong></div>
    <div class="calculation"><span>${item.soldQuantity} un. × ${currency.format(item.unitPrice)}</span><span>${currency.format(item.salesAmount)}</span></div>
    <small>Stock: ${item.initialStock} inicial + ${item.purchasedQuantity} compras − ${item.finalStock} final</small>
  </div>`).join('')
    return `${heading(block)}${items || '<p>Sin ventas registradas</p>'}`
  },

  salesTotal: (block, { close }) => {
    const total = label(block, 'total')
    const units = label(block, 'units')
    return `${total === null ? '' : `<div class="total"><span>${total}</span><span>${currency.format(close.totalSales)}</span></div>`}${units === null ? '' : `<div class="units">${units}: ${close.totalSold}</div>`}`
  },

  reservation: (block, { close }) => cigaretteReservationReceiptMarkup(close, block),

  cafeteria: (block, { close }) => {
    const cafeteria = close.cafeteria
    if (!cafeteria?.saleCount) return ''
    const items = cafeteria.items?.map((item) => `<div class="cafeteria-item"><span>${escapeHtml(item.productName)} · ${item.quantity} × ${currency.format(item.unitPrice)}</span><b>${currency.format(item.totalSales)}</b></div>`).join('')
    return `<section class="cafeteria">${heading(block)}${items}<div class="cafeteria-total"><span>${cafeteria.saleCount} ${cafeteria.saleCount === 1 ? 'venta rápida' : 'ventas rápidas'}</span><strong>${currency.format(cafeteria.totalSales)}</strong></div></section>`
  },

  suppliers: (block, { close }) => {
    const allocations = close.supplierAllocations || []
    if (!allocations.length) return ''
    return `<section class="suppliers">${heading(block)}${allocations.map((allocation) => `<div class="supplier-item"><span><b>${escapeHtml(allocation.supplierName)}</b><small>Reservado: ${currency.format(allocation.amount)} · Efectivo: ${currency.format(allocation.cashAmount || 0)} · Mercado Pago: ${currency.format(allocation.mercadoPagoAmount || 0)}</small></span><strong>Saldo: ${currency.format(allocation.balance)}</strong></div>`).join('')}</section>`
  },

  cashDrops: (block, { close, summary }) => {
    const drops = close.cashDrops || []
    if (!drops.length) return ''
    const total = label(block, 'total')
    return `<section class="cash-drops">${heading(block)}${drops.map((drop) => `<div class="cash-drop-item"><span>${localTime(drop.createdAt)}</span><strong>${currency.format(drop.amount)}</strong></div>`).join('')}${total === null ? '' : `<div class="cash-drop-total"><span>${total}</span><strong>${currency.format(summary.cashDropsTotal)}</strong></div>`}</section>`
  },

  cashSummary: (block, { close, summary }) => {
    const cafeteriaTotal = close.cafeteria?.totalSales || 0
    const caja = summary.archaeologicalResult - close.totalSales - cafeteriaTotal - summary.normalSupplierReservations
    const rows = {
      cash: ['cash-row', currency.format(summary.cashInBox)],
      mercadoPago: ['cash-row', currency.format(close.endingMercadoPagoBalance || 0)],
      posnet: ['cash-row', currency.format(close.posnetTotal || 0)],
      nextChange: ['cash-row', `+ ${currency.format(close.nextShiftChangeCash || 0)}`],
      receivedChange: ['cash-row', `− ${currency.format(close.receivedChangeCash || 0)}`],
      arqueo: ['cash-total', currency.format(summary.archaeologicalResult)],
      lessCigarettes: ['cash-row', currency.format(close.totalSales)],
      lessCafeteria: ['cash-row', currency.format(cafeteriaTotal)],
      lessSuppliers: ['cash-row', currency.format(summary.normalSupplierReservations)],
      caja: ['cash-total', currency.format(caja)],
      arqueoBase: ['cash-row shift-sales-start', currency.format(summary.archaeologicalResult)],
      plusSeparate: ['cash-row', currency.format(summary.separateCashBoxReservations)],
      shiftSales: ['cash-total shift-sales-total', currency.format(summary.shiftSales)],
    }
    const content = visibleRows(block).map((row) => {
      const [className, value] = rows[row.id]
      const amount = className.startsWith('cash-row') ? `<b>${value}</b>` : `<strong>${value}</strong>`
      return `<div class="${className}"><span>${escapeHtml(row.label)}</span>${amount}</div>`
    }).join('')
    return `<section class="cash-summary">${heading(block)}${content}</section>`
  },

  footer: (block) => visibleRows(block).map((row) => `<footer>${escapeHtml(row.label)}</footer>`).join(''),
}

function renderBlock(block, context) {
  if (!block.visible) return ''
  if (block.type === 'text') return block.title || block.text ? `<section class="custom-text">${heading(block)}${block.text ? `<p>${escapeHtml(block.text)}</p>` : ''}</section>` : ''
  if (block.type === 'signature') return `<section class="signature"><span></span>${block.title ? `<p>${escapeHtml(block.title)}</p>` : ''}</section>`
  return sectionRenderers[block.id]?.(block, context) ?? ''
}

// autoPrint es false en la vista previa de Configuraciones.
export function cigaretteShiftReceiptMarkup(close, suppliers, layout = createDefaultShiftTicketLayout(), { autoPrint = true } = {}) {
  const shiftName = close.shift === 'morning' ? 'MAÑANA' : 'TARDE'
  const businessDate = new Date(`${close.businessDate}T12:00:00`).toLocaleDateString('es-AR')
  // Reutiliza las fórmulas de pantalla para que ticket y sistema coincidan.
  const summary = getCloseFinancialSummary(close, suppliers)
  const context = { close, shiftName, businessDate, summary }
  const margin = (side) => Number(layout.margins[side]) || 0

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>Cierre cigarrillos ${shiftName} ${businessDate}</title>
  <style>
    @page { size: 80mm auto; margin: 0; }
    * { box-sizing: border-box; }
    body { width: 80mm; margin: 0; padding: ${margin('top')}mm ${margin('right')}mm ${margin('bottom')}mm ${margin('left')}mm; color: #000; font-family: Arial, sans-serif; font-size: 9pt; }
    header { padding-bottom: 5mm; border-bottom: 1px solid #000; text-align: center; }
    h1 { margin: 0; font-size: 16pt; }
    h2 { margin: 2mm 0 0; font-size: 11pt; }
    .meta { display: grid; gap: 1.5mm; padding: 4mm 0; border-bottom: 1px solid #000; }
    h3 { margin: 4mm 0 2mm; font-size: 10pt; }
    .item { padding: 2.5mm 0; border-bottom: 1px dashed #777; }
    .item-title, .calculation { display: flex; justify-content: space-between; gap: 3mm; }
    .item-title strong, .calculation span:last-child { white-space: nowrap; }
    .calculation { margin-top: 1.5mm; }
    .item small { display: block; margin-top: 1.5mm; color: #333; font-size: 7.5pt; }
    .total { display: flex; justify-content: space-between; margin-top: 5mm; padding: 4mm 0; border-top: 2px solid #000; border-bottom: 2px solid #000; font-size: 13pt; font-weight: bold; }
    .units { margin-top: 2mm; text-align: right; font-size: 8pt; }
    .cafeteria { margin-top: 5mm; padding-top: 3mm; border-top: 1px dashed #000; }
    .cafeteria h3 { margin-top: 0; }
    .cafeteria-item, .cafeteria-total { display: flex; justify-content: space-between; gap: 3mm; padding: 1.5mm 0; font-size: 8.5pt; }
    .cafeteria-total { margin-top: 2mm; border-top: 1px solid #000; font-size: 10pt; }
    .suppliers { margin-top: 5mm; padding-top: 3mm; border-top: 1px dashed #000; }
    .suppliers h3 { margin-top: 0; }
    .supplier-item { display: flex; justify-content: space-between; gap: 3mm; padding: 2mm 0; border-bottom: 1px dashed #777; font-size: 8.5pt; }
    .supplier-item span { display: flex; flex-direction: column; gap: 1mm; }
    .supplier-item small { color: #333; font-size: 7.5pt; }
    .supplier-item strong { white-space: nowrap; }
    .cash-drops { margin-top: 5mm; padding-top: 3mm; border-top: 1px dashed #000; }
    .cash-drops h3 { margin-top: 0; }
    .cash-drop-item, .cash-drop-total { display: flex; justify-content: space-between; gap: 3mm; padding: 1.5mm 0; }
    .cash-drop-total { margin-top: 2mm; border-top: 1px solid #000; font-weight: bold; }
    .cash-summary { margin-top: 5mm; padding-top: 3mm; border-top: 1px dashed #000; }
    .cash-summary h3 { margin-top: 0; }
    .cash-row, .cash-total { display: flex; justify-content: space-between; gap: 3mm; padding: 1.2mm 0; font-size: 8.5pt; }
    .cash-total { margin-top: 2mm; padding-top: 2mm; border-top: 1px solid #000; font-size: 10pt; }
    .shift-sales-start { margin-top: 3mm; padding-top: 2mm; border-top: 1px dashed #000; }
    .shift-sales-total { border-top-width: 2px; font-size: 11pt; }
    .custom-text { margin-top: 4mm; overflow-wrap: anywhere; }
    .custom-text h3 { margin-top: 0; }
    .custom-text p { margin: 0; line-height: 1.4; white-space: pre-line; }
    .signature { margin-top: 14mm; text-align: center; overflow-wrap: anywhere; }
    .signature span { display: block; border-top: 1px solid #000; }
    .signature p { margin: 1.5mm 0 0; font-size: 8pt; }
    footer { margin-top: 5mm; text-align: center; font-weight: bold; font-size: 9pt; }
  </style>
</head>
<body>
  ${layout.blocks.map((block) => renderBlock(block, context)).filter(Boolean).join('\n  ')}
  ${autoPrint ? `<script>window.addEventListener('load', () => setTimeout(() => { window.focus(); window.print(); }, 100)); window.addEventListener('afterprint', () => window.close());</script>` : ''}
</body>
</html>`
}
