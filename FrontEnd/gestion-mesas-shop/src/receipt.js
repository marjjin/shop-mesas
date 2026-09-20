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

function welcomeReceiptMarkup(table) {
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
    footer { margin-top: 5mm; padding-top: 4mm; border-top: 1px solid #000; text-align: center; font-weight: bold; font-size: 10pt; }
  </style>
</head>
<body>
  <header><h1>SHOP FAMILY</h1></header>
  <main>
    <h2>Hola ${escapeHtml(table.customerName)}, bienvenido/a a Shop Family.</h2>
    <p>Ya registramos tu pedido.</p>
    <div class="conditions">
      <p>Tu tiempo de mesa es de <strong>1 hora</strong>.</p>
      <p>Pasado ese tiempo podrás renovar tu pedido o solo abonar el servicio de mesa sin consumición.</p>
    </div>
    <p class="minimum">Costo mínimo de consumo: $3000</p>
  </main>
  <footer>¡Gracias por elegirnos!</footer>
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

export function printWelcomeReceipt(table, printWindow) {
  if (!printWindow || printWindow.closed) return false
  printWindow.document.open()
  printWindow.document.write(welcomeReceiptMarkup(table))
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
