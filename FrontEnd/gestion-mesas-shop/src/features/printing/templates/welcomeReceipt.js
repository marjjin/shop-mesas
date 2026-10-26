import { welcomeMessageContent } from '../../../shared/utils/welcomeMessage.js'
import { escapeHtml } from '../../../shared/utils/html.js'

export function welcomeReceiptMarkup(table, settings) {
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

