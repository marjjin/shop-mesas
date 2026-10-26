import { localTime } from '../../../shared/utils/date.js'
import { escapeHtml } from '../../../shared/utils/html.js'
import { money as currency } from '../../../shared/utils/currency.js'
import { getCloseFinancialSummary } from '../../cigarettes/domain/closeFinancials.js'

export function cigaretteShiftReceiptMarkup(close, suppliers) {
  const shiftName = close.shift === 'morning' ? 'MAÑANA' : 'TARDE'
  const businessDate = new Date(`${close.businessDate}T12:00:00`).toLocaleDateString('es-AR')
  const items = close.items.filter((item) => item.soldQuantity > 0).map((item) => `<div class="item">
    <div class="item-title"><b>${escapeHtml(item.productName)}</b><strong>${currency.format(item.salesAmount)}</strong></div>
    <div class="calculation"><span>${item.soldQuantity} un. × ${currency.format(item.unitPrice)}</span><span>${currency.format(item.salesAmount)}</span></div>
    <small>Stock: ${item.initialStock} inicial + ${item.purchasedQuantity} compras − ${item.finalStock} final</small>
  </div>`).join('')
  const cafeteria = close.cafeteria
  const cafeteriaItems = cafeteria?.items?.map((item) => `<div class="cafeteria-item"><span>${escapeHtml(item.productName)} · ${item.quantity} × ${currency.format(item.unitPrice)}</span><b>${currency.format(item.totalSales)}</b></div>`).join('')
  const cafeteriaSummary = cafeteria?.saleCount ? `<section class="cafeteria"><h3>CAJA CAFETERÍA</h3>${cafeteriaItems}<div class="cafeteria-total"><span>${cafeteria.saleCount} ${cafeteria.saleCount === 1 ? 'venta rápida' : 'ventas rápidas'}</span><strong>${currency.format(cafeteria.totalSales)}</strong></div></section>` : ''
  const supplierAllocations = close.supplierAllocations || []
  const supplierSummary = supplierAllocations.length ? `<section class="suppliers"><h3>PROVEEDORES</h3>${supplierAllocations.map((allocation) => `<div class="supplier-item"><span><b>${escapeHtml(allocation.supplierName)}</b><small>Reservado: ${currency.format(allocation.amount)} · Efectivo: ${currency.format(allocation.cashAmount || 0)} · Mercado Pago: ${currency.format(allocation.mercadoPagoAmount || 0)}</small></span><strong>Saldo: ${currency.format(allocation.balance)}</strong></div>`).join('')}</section>` : ''
  const { cashDropsTotal, cashInBox, archaeologicalResult, normalSupplierReservations,
    separateCashBoxReservations, shiftSales: shiftSalesTotal } = getCloseFinancialSummary(close, suppliers)
  const cashDrops = close.cashDrops || []
  const cashDropsDetail = cashDrops.length ? `<section class="cash-drops"><h3>TIRADAS DE EFECTIVO</h3>${cashDrops.map((drop) => `<div class="cash-drop-item"><span>${localTime(drop.createdAt)}</span><strong>${currency.format(drop.amount)}</strong></div>`).join('')}<div class="cash-drop-total"><span>Total tiradas</span><strong>${currency.format(cashDropsTotal)}</strong></div></section>` : ''
  const cashResult = archaeologicalResult - close.totalSales - (cafeteria?.totalSales || 0) - normalSupplierReservations
  const cashSummary = `<section class="cash-summary"><h3>ARQUEO Y RESULTADOS</h3><div class="cash-row"><span>Efectivo en caja</span><b>${currency.format(cashInBox)}</b></div><div class="cash-row"><span>Mercado Pago final</span><b>${currency.format(close.endingMercadoPagoBalance || 0)}</b></div><div class="cash-row"><span>Total Posnet</span><b>${currency.format(close.posnetTotal || 0)}</b></div><div class="cash-row"><span>Cambio próximo turno</span><b>+ ${currency.format(close.nextShiftChangeCash || 0)}</b></div><div class="cash-row"><span>Cambio recibido</span><b>− ${currency.format(close.receivedChangeCash || 0)}</b></div><div class="cash-total"><span>Arqueo de caja</span><strong>${currency.format(archaeologicalResult)}</strong></div><div class="cash-row"><span>− Cigarrillos</span><b>${currency.format(close.totalSales)}</b></div><div class="cash-row"><span>− Caja Cafetería</span><b>${currency.format(cafeteria?.totalSales || 0)}</b></div><div class="cash-row"><span>− Proveedores sin caja aparte</span><b>${currency.format(normalSupplierReservations)}</b></div><div class="cash-total"><span>Caja</span><strong>${currency.format(cashResult)}</strong></div><div class="shift-sales-calculation"><div class="cash-row"><span>Arqueo de caja</span><b>${currency.format(archaeologicalResult)}</b></div><div class="cash-row"><span>+ Proveedores con caja aparte</span><b>${currency.format(separateCashBoxReservations)}</b></div></div><div class="cash-total shift-sales-total"><span>Ventas totales del turno</span><strong>${currency.format(shiftSalesTotal)}</strong></div></section>`

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>Cierre cigarrillos ${shiftName} ${businessDate}</title>
  <style>
    @page { size: 80mm auto; margin: 0; }
    * { box-sizing: border-box; }
    body { width: 80mm; margin: 0; padding: 8mm 6mm; color: #000; font-family: Arial, sans-serif; font-size: 9pt; }
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
    .shift-sales-calculation { margin-top: 3mm; padding-top: 2mm; border-top: 1px dashed #000; }
    .shift-sales-total { border-top-width: 2px; font-size: 11pt; }
    footer { margin-top: 5mm; text-align: center; font-weight: bold; font-size: 9pt; }
  </style>
</head>
<body>
  <header><h1>SHOP FAMILY</h1><h2>CIERRE DE CIGARRILLOS</h2></header>
  <div class="meta"><span>Fecha: ${businessDate}</span><span>Turno: ${shiftName}</span><span>Cierre: ${localTime(close.closedAt)}</span></div>
  <h3>DETALLE DE VENTAS</h3>
  ${items || '<p>Sin ventas registradas</p>'}
  <div class="total"><span>VENTAS CIGARRILLOS</span><span>${currency.format(close.totalSales)}</span></div>
  <div class="units">Unidades vendidas: ${close.totalSold}</div>
  ${cafeteriaSummary}
  ${supplierSummary}
  ${cashDropsDetail}
  ${cashSummary}
  <footer>COMPROBANTE DE CIERRE</footer>
  <script>window.addEventListener('load', () => setTimeout(() => { window.focus(); window.print(); }, 100)); window.addEventListener('afterprint', () => window.close());</script>
</body>
</html>`
}

