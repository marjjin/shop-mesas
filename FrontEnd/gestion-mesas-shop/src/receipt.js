import { welcomeMessageContent } from './shared/utils/welcomeMessage.js'

function parseUtc(value) {
  return /(?:Z|[+-]\d{2}:\d{2})$/.test(value) ? value : `${value}Z`
}

export function localDate(value) {
  return new Intl.DateTimeFormat('es-AR', { dateStyle: 'short' }).format(new Date(parseUtc(value)))
}

export function localTime(value) {
  return new Intl.DateTimeFormat('es-AR', { hour: '2-digit', minute: '2-digit' }).format(new Date(parseUtc(value)))
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function receiptMarkup(history) {
  const items = history.items.length
    ? history.items.map((item) => `<div class="item"><span><b>${item.quantity}x</b> ${escapeHtml(item.productName)}</span><time>${localTime(item.createdAt)}</time></div>`).join('')
    : '<p>Sin artículos cargados</p>'

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>Comanda ${escapeHtml(history.tableName)}</title>
  <style>
    @page { size: 80mm auto; margin: 0; }
    * { box-sizing: border-box; }
    body { width: 80mm; margin: 0; padding: 8mm 6mm; color: #000; font-family: Arial, sans-serif; font-size: 10pt; }
    header { border-bottom: 1px solid #000; padding-bottom: 5mm; text-align: center; }
    h1 { margin: 0; font-size: 16pt; }
    h2 { margin: 5mm 0 2mm; font-size: 12pt; }
    .meta { display: grid; gap: 1.5mm; padding: 4mm 0; border-bottom: 1px solid #000; }
    h3 { margin: 4mm 0 2mm; font-size: 10pt; }
    .item { display: flex; justify-content: space-between; gap: 3mm; padding: 1.5mm 0; }
    .item span { flex: 1; }
    time { white-space: nowrap; font-size: 8pt; }
    footer { margin-top: 4mm; padding-top: 3mm; border-top: 1px solid #000; text-align: center; font-weight: bold; font-size: 9pt; }
  </style>
</head>
<body>
  <header><h1>SHOP FAMILY</h1></header>
  <h2>${escapeHtml(history.tableName)}</h2>
  <div class="meta">
    <span>Fecha: ${localDate(history.closedAt)}</span>
    <span>Ingreso: ${localTime(history.openedAt)}</span>
    <span>Finalización: ${localTime(history.closedAt)}</span>
  </div>
  <h3>ARTÍCULOS</h3>
  ${items}
  <footer>COMANDA DE MESA</footer>
  <script>window.addEventListener('load', () => setTimeout(() => { window.focus(); window.print(); }, 100)); window.addEventListener('afterprint', () => window.close());</script>
</body>
</html>`
}

function welcomeReceiptMarkup(table, settings) {
  const content = welcomeMessageContent(settings, table.customerName)
  const minimum = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 }).format(settings.amount)
  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>Bienvenido/a ${escapeHtml(table.customerName)}</title>
  <style>
    @page { size: 80mm auto; margin: 0; }
    * { box-sizing: border-box; }
    body { width: 80mm; margin: 0; padding: 8mm 6mm; color: #000; font-family: Arial, sans-serif; font-size: 10pt; }
    header { border-bottom: 1px solid #000; padding-bottom: 5mm; text-align: center; }
    h1 { margin: 0; font-size: 16pt; }
    main { padding: 6mm 0 2mm; text-align: center; }
    h2 { margin: 0 0 5mm; font-size: 13pt; }
    p { margin: 0 0 4mm; line-height: 1.45; }
    .conditions { padding: 4mm 0; border-top: 1px dashed #000; border-bottom: 1px dashed #000; }
    .minimum { margin-top: 5mm; font-size: 12pt; font-weight: bold; }
    .ticket-text { white-space: pre-line; overflow-wrap: anywhere; }
    footer { margin-top: 5mm; padding-top: 4mm; border-top: 1px solid #000; text-align: center; font-weight: bold; font-size: 10pt; }
  </style>
</head>
<body>
  <header><h1 class="ticket-text">${escapeHtml(content.businessName)}</h1></header>
  <main>
    <h2 class="ticket-text">${escapeHtml(content.greetingText)}</h2>
    ${content.messageText ? `<p class="ticket-text">${escapeHtml(content.messageText)}</p>` : ''}
    ${content.conditionsText ? `<div class="conditions"><p class="ticket-text">${escapeHtml(content.conditionsText)}</p></div>` : ''}
    <p class="minimum ticket-text">${escapeHtml(content.minimumLabel)}: $${minimum}</p>
  </main>
  ${content.footerText ? `<footer class="ticket-text">${escapeHtml(content.footerText)}</footer>` : ''}
  <script>window.addEventListener('load', () => setTimeout(() => { window.focus(); window.print(); }, 100)); window.addEventListener('afterprint', () => window.close());</script>
</body>
</html>`
}

function cashDropReceiptMarkup(drop) {
  const currency = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })
  const shiftName = drop.shift === 'morning' ? 'MAÑANA' : 'TARDE'
  const businessDate = new Date(`${drop.businessDate}T12:00:00`).toLocaleDateString('es-AR')

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>Tirada de efectivo ${businessDate}</title>
  <style>
    @page { size: 80mm 250mm; margin: 0; }
    * { box-sizing: border-box; }
    html { width: 80mm; height: 250mm; }
    body { display: flex; width: 72mm; height: 250mm; max-height: 250mm; min-height: 250mm; flex-direction: column; margin: 0 auto; padding: 5mm 0; overflow: hidden; color: #000; font-family: Arial, sans-serif; font-size: 9pt; }
    header { padding-bottom: 3mm; border-bottom: 1px solid #000; text-align: center; }
    h1 { margin: 0; font-size: 14pt; }
    h2 { margin: 2mm 0 0; font-size: 10pt; }
    .meta { display: flex; justify-content: space-between; gap: 3mm; padding: 3mm 0; border-bottom: 1px dashed #000; font-size: 8pt; }
    .amount { margin-top: auto; padding: 3mm 0; border-bottom: 2px solid #000; text-align: center; font-size: 22pt; font-weight: bold; }
    .amount small { display: block; margin-bottom: 1mm; font-size: 8pt; font-weight: normal; letter-spacing: .4px; }
    .note { margin: 0; text-align: center; font-size: 8pt; }
    footer { margin-top: 3mm; padding-top: 2mm; border-top: 1px dashed #000; text-align: center; font-size: 8pt; font-weight: bold; }
  </style>
</head>
<body>
  <header><h1>SHOP FAMILY</h1><h2>TIRADA DE EFECTIVO</h2></header>
  <div class="meta"><span>Fecha: ${businessDate}</span><span>Hora: ${localTime(drop.createdAt)}</span></div>
  <p class="note">Turno: ${shiftName}<br>Conservar junto al efectivo.</p>
  <footer>COMPROBANTE DE TIRADA</footer>
  <div class="amount"><small>IMPORTE RETIRADO</small>${currency.format(drop.amount)}</div>
  <script>window.addEventListener('load', () => setTimeout(() => { window.focus(); window.print(); }, 100)); window.addEventListener('afterprint', () => window.close());</script>
</body>
</html>`
}

function cigaretteShiftReceiptMarkup(close, suppliers) {
  const currency = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })
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
  const cashDropsTotal = close.cashDropsTotal ?? (close.cashDrops || []).reduce((total, drop) => total + drop.amount, 0)
  const cashDrops = close.cashDrops || []
  const cashInBox = (close.endingCashBalance || 0) + cashDropsTotal
  const cashDropsDetail = cashDrops.length ? `<section class="cash-drops"><h3>TIRADAS DE EFECTIVO</h3>${cashDrops.map((drop) => `<div class="cash-drop-item"><span>${localTime(drop.createdAt)}</span><strong>${currency.format(drop.amount)}</strong></div>`).join('')}<div class="cash-drop-total"><span>Total tiradas</span><strong>${currency.format(cashDropsTotal)}</strong></div></section>` : ''
  const archaeologicalResult = (close.endingCashBalance || 0) + cashDropsTotal + (close.endingMercadoPagoBalance || 0) + (close.posnetTotal || 0) + (close.nextShiftChangeCash || 0) - (close.receivedChangeCash || 0)
  const separateSupplierIds = new Set(suppliers.filter((supplier) => supplier.isSeparateCashBox).map((supplier) => supplier.id))
  const normalSupplierReservations = supplierAllocations.filter((allocation) => !separateSupplierIds.has(allocation.supplierId)).reduce((total, allocation) => total + allocation.amount, 0)
  const separateCashBoxReservations = supplierAllocations.filter((allocation) => separateSupplierIds.has(allocation.supplierId)).reduce((total, allocation) => total + allocation.amount, 0)
  const cashResult = archaeologicalResult - close.totalSales - (cafeteria?.totalSales || 0) - normalSupplierReservations
  const shiftSalesTotal = archaeologicalResult + separateCashBoxReservations
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

export function openReceiptPrintWindow() {
  const printWindow = window.open('', '_blank', 'popup,width=420,height=720')
  if (printWindow) {
    printWindow.document.write('<!doctype html><html><body style="font-family:Arial;padding:24px">Preparando ticket…</body></html>')
    printWindow.document.close()
  }
  return printWindow
}

export function printReceipt(history, printWindow) {
  if (!printWindow || printWindow.closed) return false
  printWindow.document.open()
  printWindow.document.write(receiptMarkup(history))
  printWindow.document.close()
  return true
}

export function printWelcomeReceipt(table, printWindow, settings) {
  if (!Number.isFinite(settings?.amount) || settings.amount < 0)
    throw new Error('No se pudo obtener el importe del mensaje de bienvenida.')
  if (!printWindow || printWindow.closed) return false
  printWindow.document.open()
  printWindow.document.write(welcomeReceiptMarkup(table, settings))
  printWindow.document.close()
  return true
}

export function printCashDropReceipt(drop, existingWindow = null) {
  const printWindow = existingWindow || openReceiptPrintWindow()
  if (!printWindow || printWindow.closed) return false
  printWindow.document.open()
  printWindow.document.write(cashDropReceiptMarkup(drop))
  printWindow.document.close()
  return true
}

export function printCigaretteShiftReceipt(close, suppliers = []) {
  const printWindow = openReceiptPrintWindow()
  if (!printWindow) return false
  printWindow.document.open()
  printWindow.document.write(cigaretteShiftReceiptMarkup(close, suppliers))
  printWindow.document.close()
  return true
}

function cigaretteDailyReceiptMarkup(closes, suppliers, businessDate) {
  const currency = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })
  const formattedDate = new Date(`${businessDate}T12:00:00`).toLocaleDateString('es-AR')
  const separateSupplierIds = new Set(suppliers.filter((supplier) => supplier.isSeparateCashBox).map((supplier) => supplier.id))
  const summaries = closes.map((close) => {
    const cashDropsTotal = close.cashDropsTotal ?? (close.cashDrops || []).reduce((total, drop) => total + drop.amount, 0)
    const archaeologicalResult = (close.endingCashBalance || 0) + cashDropsTotal + (close.endingMercadoPagoBalance || 0) + (close.posnetTotal || 0) + (close.nextShiftChangeCash || 0) - (close.receivedChangeCash || 0)
    const normalSupplierReservations = (close.supplierAllocations || []).filter((allocation) => !separateSupplierIds.has(allocation.supplierId))
    const separateCashBoxes = (close.supplierAllocations || []).filter((allocation) => separateSupplierIds.has(allocation.supplierId))
    const normalReservationsTotal = normalSupplierReservations.reduce((total, allocation) => total + allocation.amount, 0)
    const separateCashBoxTotal = separateCashBoxes.reduce((total, allocation) => total + allocation.amount, 0)
    return {
      close,
      shiftName: close.shift === 'morning' ? 'MAÑANA' : 'TARDE',
      archaeologicalResult,
      cashDropsTotal,
      cashInBox: (close.endingCashBalance || 0) + cashDropsTotal,
      normalReservationsTotal,
      separateCashBoxes,
      separateCashBoxTotal,
      cashTotal: archaeologicalResult - normalReservationsTotal - close.totalSales - (close.cafeteria?.totalSales || 0),
      shiftSales: archaeologicalResult + separateCashBoxTotal
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
    return `<section class="turn"><h3>Turno ${summary.shiftName}</h3><section class="turn-block"><h4>ARQUEO DE CAJA</h4><div><span>Efectivo final</span><b>${currency.format(summary.cashInBox)}</b></div><div><span>Mercado Pago final</span><b>${currency.format(close.endingMercadoPagoBalance || 0)}</b></div><div><span>Total Posnet</span><b>${currency.format(close.posnetTotal || 0)}</b></div><div><span>+ Cambio próximo</span><b>${currency.format(close.nextShiftChangeCash || 0)}</b></div><div><span>− Cambio recibido</span><b>${currency.format(close.receivedChangeCash || 0)}</b></div><div class="block-total"><span>Resultado del arqueo</span><b>${currency.format(summary.archaeologicalResult)}</b></div></section><section class="turn-block cash-drops-detail"><h4>TIRADAS DE EFECTIVO</h4>${cashDropsDetail}<div class="block-total"><span>Total tiradas</span><b>${currency.format(summary.cashDropsTotal)}</b></div></section><section class="turn-block"><h4>CAJAS APARTE</h4>${separateCashBoxes}<div class="block-total"><span>Total cajas aparte</span><b>${currency.format(summary.separateCashBoxTotal)}</b></div></section><section class="turn-block"><h4>VENTAS DEL TURNO</h4><div><span>Ventas Cigarrillos · ${close.totalSold} ${close.totalSold === 1 ? 'unidad' : 'unidades'}</span><b>${currency.format(close.totalSales)}</b></div><div><span>Caja Cafetería</span><b>${currency.format(close.cafeteria?.totalSales || 0)}</b></div></section><section class="turn-result"><h4>RESULTADO FINAL</h4><div><span>Arqueo de caja</span><b>${currency.format(summary.archaeologicalResult)}</b></div><div><span>− Proveedores sin caja aparte</span><b>${currency.format(summary.normalReservationsTotal)}</b></div><div><span>− Ventas Cigarrillos</span><b>${currency.format(close.totalSales)}</b></div><div><span>− Caja Cafetería</span><b>${currency.format(close.cafeteria?.totalSales || 0)}</b></div><div class="result-total"><span>CAJA</span><b>${currency.format(summary.cashTotal)}</b></div><div><span>Arqueo de caja + cajas aparte</span><b>${currency.format(summary.archaeologicalResult)} + ${currency.format(summary.separateCashBoxTotal)}</b></div><div class="result-total"><span>VENTAS DEL TURNO</span><b>${currency.format(summary.shiftSales)}</b></div></section></section>`
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

export function printCigaretteDailyReceipt(closes, suppliers, businessDate) {
  const printWindow = openReceiptPrintWindow()
  if (!printWindow) return false
  printWindow.document.open()
  printWindow.document.write(cigaretteDailyReceiptMarkup(closes, suppliers, businessDate))
  printWindow.document.close()
  return true
}

export async function downloadReceipt(history) {
  const { jsPDF } = await import('jspdf')
  const itemHeights = history.items.map((item) => Math.max(8, Math.ceil(`${item.quantity}x ${item.productName}`.length / 32) * 4 + 3))
  const height = Math.max(75, 67 + itemHeights.reduce((sum, value) => sum + value, 0))
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [80, height] })
  let y = 9

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(16)
  pdf.text('SHOP FAMILY', 40, y, { align: 'center' })
  y += 5
  pdf.setLineWidth(.3)
  pdf.line(7, y, 70, y)
  y += 7

  pdf.setFontSize(11)
  pdf.text(history.tableName, 7, y)
  y += 6
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(9)
  pdf.text(`Fecha: ${localDate(history.closedAt)}`, 7, y)
  y += 5
  pdf.text(`Ingreso: ${localTime(history.openedAt)}`, 7, y)
  y += 5
  pdf.text(`Finalización: ${localTime(history.closedAt)}`, 7, y)
  y += 6
  pdf.line(7, y, 70, y)
  y += 6

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(10)
  pdf.text('ARTÍCULOS', 7, y)
  y += 6

  history.items.forEach((item, index) => {
    const lines = pdf.splitTextToSize(`${item.quantity}x ${item.productName}`, 52)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(9)
    pdf.text(lines, 7, y)
    pdf.setFontSize(8)
    pdf.text(localTime(item.createdAt), 68, y, { align: 'right' })
    y += itemHeights[index]
  })

  if (!history.items.length) {
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(9)
    pdf.text('Sin artículos cargados', 7, y)
    y += 8
  }

  pdf.line(7, y, 70, y)
  y += 7
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(9)
  pdf.text('COMANDA DE MESA', 40, y, { align: 'center' })
  const filename = `${history.tableName}-${localDate(history.closedAt).replaceAll('/', '-')}.pdf`
  pdf.save(filename)
}
