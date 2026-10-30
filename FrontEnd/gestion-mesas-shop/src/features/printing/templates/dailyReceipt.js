import { cigaretteReservationReceiptMarkup } from './cigaretteReservationReceipt.js'
import { localTime } from '../../../shared/utils/date.js'
import { escapeHtml } from '../../../shared/utils/html.js'
import { money as currency } from '../../../shared/utils/currency.js'
import { getCloseFinancialSummary } from '../../cigarettes/domain/closeFinancials.js'

export function cigaretteDailyReceiptMarkup(closes, suppliers, businessDate) {
  const formattedDate = new Date(`${businessDate}T12:00:00`).toLocaleDateString('es-AR')
  const separateSupplierIds = new Set(suppliers.filter((supplier) => supplier.isSeparateCashBox).map((supplier) => supplier.id))
  const summaries = closes.map((close) => {
    const summary = getCloseFinancialSummary(close, suppliers)
    const separateCashBoxes = (close.supplierAllocations || []).filter((allocation) => separateSupplierIds.has(allocation.supplierId))
    return {
      ...summary,
      close,
      shiftName: close.shift === 'morning' ? 'MAÑANA' : 'TARDE',
      normalReservationsTotal: summary.normalSupplierReservations,
      separateCashBoxes,
      separateCashBoxTotal: summary.separateCashBoxReservations,
    }
  })
  const totalCash = summaries.reduce((total, summary) => total + summary.cashTotal, 0)
  const totalArchaeological = summaries.reduce((total, summary) => total + summary.archaeologicalResult, 0)
  const totalSales = summaries.reduce((total, summary) => total + summary.shiftSales, 0)
  const turns = summaries.map((summary) => {
    const { close } = summary
    const cashDrops = close.cashDrops || []
    const cashDropsDetail = cashDrops.length
      ? cashDrops.map((drop) => `<div><span>${localTime(drop.createdAt)}</span><b>${currency.format(drop.amount)}</b></div>`).join('')
      : '<p>Sin tiradas registradas.</p>'
    const separateCashBoxes = summary.separateCashBoxes.length
      ? summary.separateCashBoxes.map((allocation) => `<div><span>${escapeHtml(allocation.supplierName)}<small>Efectivo ${currency.format(allocation.cashAmount)} · Mercado Pago ${currency.format(allocation.mercadoPagoAmount)}</small></span><b>${currency.format(allocation.amount)}</b></div>`).join('')
      : '<p>Sin reservas en cajas aparte.</p>'
    return `<section class="turn"><h3>Turno ${summary.shiftName}</h3><section class="turn-block"><h4>ARQUEO DE CAJA</h4><div><span>Efectivo final</span><b>${currency.format(summary.cashInBox)}</b></div><div><span>Mercado Pago final</span><b>${currency.format(close.endingMercadoPagoBalance || 0)}</b></div><div><span>Total Posnet</span><b>${currency.format(close.posnetTotal || 0)}</b></div><div><span>+ Cambio próximo</span><b>${currency.format(close.nextShiftChangeCash || 0)}</b></div><div><span>− Cambio recibido</span><b>${currency.format(close.receivedChangeCash || 0)}</b></div><div class="block-total"><span>Resultado del arqueo</span><b>${currency.format(summary.archaeologicalResult)}</b></div></section><section class="turn-block cash-drops-detail"><h4>TIRADAS DE EFECTIVO</h4>${cashDropsDetail}<div class="block-total"><span>Total tiradas</span><b>${currency.format(summary.cashDropsTotal)}</b></div></section><section class="turn-block"><h4>CAJAS APARTE</h4>${separateCashBoxes}<div class="block-total"><span>Total cajas aparte</span><b>${currency.format(summary.separateCashBoxTotal)}</b></div></section><section class="turn-block"><h4>VENTAS DEL TURNO</h4><div><span>Ventas Cigarrillos · ${close.totalSold} ${close.totalSold === 1 ? 'unidad' : 'unidades'}</span><b>${currency.format(close.totalSales)}</b></div><div><span>Caja Cafetería</span><b>${currency.format(close.cafeteria?.totalSales || 0)}</b></div></section>${cigaretteReservationReceiptMarkup(close)}<section class="turn-result"><h4>RESULTADO FINAL</h4><div><span>Arqueo de caja</span><b>${currency.format(summary.archaeologicalResult)}</b></div><div><span>− Proveedores sin caja aparte</span><b>${currency.format(summary.normalReservationsTotal)}</b></div><div><span>− Ventas Cigarrillos</span><b>${currency.format(close.totalSales)}</b></div><div><span>− Caja Cafetería</span><b>${currency.format(close.cafeteria?.totalSales || 0)}</b></div><div class="result-total"><span>CAJA</span><b>${currency.format(summary.cashTotal)}</b></div><div><span>Arqueo de caja + cajas aparte</span><b>${currency.format(summary.archaeologicalResult)} + ${currency.format(summary.separateCashBoxTotal)}</b></div><div class="result-total"><span>VENTAS DEL TURNO</span><b>${currency.format(summary.shiftSales)}</b></div></section></section>`
  }).join('')

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>Resumen diario ${formattedDate}</title>
  <style>
    @page { size: 80mm auto; margin: 0; }
    * { box-sizing: border-box; }
    body { width: 80mm; margin: 0; padding: 8mm 6mm; color: #000; font-family: Arial, sans-serif; font-size: 9pt; }
    header { padding-bottom: 5mm; border-bottom: 1px solid #000; text-align: center; }
    h1 { margin: 0; font-size: 16pt; }
    h2 { margin: 2mm 0 0; font-size: 11pt; }
    .meta { padding: 4mm 0; border-bottom: 1px solid #000; text-align: center; }
    .turn { padding: 4mm 0; border-bottom: 2px solid #000; }
    .turn h3 { margin: 0 0 2mm; font-size: 10pt; }
    .turn-block, .turn-result { margin-top: 3mm; padding-top: 2mm; border-top: 1px dashed #777; }
    .turn h4 { margin: 0 0 1.5mm; font-size: 8pt; letter-spacing: .4mm; }
    .turn div, .total div { display: flex; justify-content: space-between; gap: 3mm; padding: 1.2mm 0; }
    .turn span { display: flex; flex-direction: column; gap: 1mm; }
    .turn small { color: #333; font-size: 7.5pt; }
    .turn p { margin: 1mm 0; color: #333; font-size: 8pt; }
    .cash-drops-detail div { font-size: 8.5pt; }
    .block-total { margin-top: 1.5mm; padding-top: 1.5mm!important; border-top: 1px solid #000; font-weight: bold; }
    .turn-result { border-top: 2px solid #000; }
    .result-total { margin-top: 1.5mm; padding-top: 1.5mm!important; border-top: 1px solid #000; font-size: 10pt; font-weight: bold; }
    .total { margin-top: 4mm; padding: 3mm 0; border-top: 2px solid #000; border-bottom: 2px solid #000; }
    .total div:last-child { font-size: 12pt; font-weight: bold; }
    footer { margin-top: 5mm; text-align: center; font-weight: bold; font-size: 9pt; }
  </style>
</head>
<body>
  <header><h1>SHOP FAMILY</h1><h2>RESUMEN DIARIO DE CIERRES</h2></header>
  <div class="meta">Fecha de trabajo: ${formattedDate}<br>${summaries.length} ${summaries.length === 1 ? 'turno cerrado' : 'turnos cerrados'}</div>
  ${turns || '<p>Sin cierres registrados.</p>'}
  <section class="total"><div><span>Caja total</span><b>${currency.format(totalCash)}</b></div><div><span>Arqueo total</span><b>${currency.format(totalArchaeological)}</b></div><div><span>Ventas totales del día</span><b>${currency.format(totalSales)}</b></div></section>
  <footer>COMPROBANTE DE RESUMEN DIARIO</footer>
  <script>window.addEventListener('load', () => setTimeout(() => { window.focus(); window.print(); }, 100)); window.addEventListener('afterprint', () => window.close());</script>
</body>
</html>`
}

