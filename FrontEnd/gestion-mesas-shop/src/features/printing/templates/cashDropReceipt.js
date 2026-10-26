import { localTime } from '../../../shared/utils/date.js'
import { money as currency } from '../../../shared/utils/currency.js'

export function cashDropReceiptMarkup(drop) {
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

