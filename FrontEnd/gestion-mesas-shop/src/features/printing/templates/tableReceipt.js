import { localDate, localTime } from '../../../shared/utils/date.js'
import { escapeHtml } from '../../../shared/utils/html.js'

export function receiptMarkup(history) {
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

