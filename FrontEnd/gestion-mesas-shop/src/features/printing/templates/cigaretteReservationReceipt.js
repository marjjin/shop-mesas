// Fragmento de reservas de cigarrillos, usado en los tickets de turno y diario.
import { preciseMoney as money } from '../../../shared/utils/currency.js'
import { escapeHtml } from '../../../shared/utils/html.js'
import { defaultShiftTicketBlock } from '../shiftTicketLayout.js'

// block permite personalizar el ticket de turno; el resumen diario usa el diseño de fábrica.
export function cigaretteReservationReceiptMarkup(close, block = defaultShiftTicketBlock('reservation')) {
  const cash = close.cigaretteReservedCash
  const mercadoPago = close.cigaretteReservedMercadoPago
  const incomplete = cash == null || mercadoPago == null
  const values = {
    cash: cash == null ? 'Sin registrar' : money.format(cash),
    mercadoPago: mercadoPago == null ? 'Sin registrar' : money.format(mercadoPago),
    total: incomplete ? 'Incompleto' : money.format(cash + mercadoPago),
  }
  const rows = block.rows.filter((row) => row.visible)
    .map((row) => `<div class="${row.id === 'total' ? 'cash-total' : 'cash-row'}"><span>${escapeHtml(row.label)}</span><b>${values[row.id]}</b></div>`).join('')
  return `<section class="turn-block cigarette-reserve">${block.title ? `<h3>${escapeHtml(block.title)}</h3>` : ''}${rows}</section>`
}
