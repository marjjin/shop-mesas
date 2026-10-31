// Impresión de comprobantes: genera HTML en una ventana emergente que se imprime sola.
import { receiptMarkup } from './templates/tableReceipt.js'
import { welcomeReceiptMarkup } from './templates/welcomeReceipt.js'
import { cashDropReceiptMarkup } from './templates/cashDropReceipt.js'
import { cigaretteShiftReceiptMarkup } from './templates/shiftReceipt.js'
import { cigaretteDailyReceiptMarkup } from './templates/dailyReceipt.js'
import { normalizeShiftTicketLayout } from './shiftTicketLayout.js'
export { localDate, localTime } from '../../shared/utils/date.js'
export { downloadReceipt } from './downloadReceipt.js'

// Reemplaza el contenido de la ventana por el HTML del ticket.
function writeReceipt(printWindow, markup, ...args) {
  printWindow.document.open()
  printWindow.document.write(markup(...args))
  printWindow.document.close()
  return true
}

// Hay que abrirla durante el clic, antes de cualquier await, o el navegador la bloquea.
// Por eso primero se abre vacía y después se completa.
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
  return writeReceipt(printWindow, receiptMarkup, history)
}

// Valida el importe antes de imprimir.
export function printWelcomeReceipt(table, printWindow, settings) {
  if (!Number.isFinite(settings?.amount) || settings.amount < 0)
    throw new Error('No se pudo obtener el importe del mensaje de bienvenida.')
  if (!printWindow || printWindow.closed) return false
  return writeReceipt(printWindow, welcomeReceiptMarkup, table, settings)
}

export function printCashDropReceipt(drop, existingWindow = null) {
  const printWindow = existingWindow || openReceiptPrintWindow()
  if (!printWindow || printWindow.closed) return false
  return writeReceipt(printWindow, cashDropReceiptMarkup, drop)
}

export function printCigaretteShiftReceipt(close, suppliers = [], layout, existingWindow = null) {
  const printWindow = existingWindow || openReceiptPrintWindow()
  if (!printWindow || printWindow.closed) return false
  return writeReceipt(printWindow, cigaretteShiftReceiptMarkup, close, suppliers, layout)
}

// La ventana debe llegar abierta desde el clic. El diseño se lee del servidor en cada
// impresión para usar siempre el último guardado.
export async function printShiftTicket(close, suppliers, api, printWindow) {
  if (!printWindow || printWindow.closed) return false
  const { layout } = await api('/settings/shift-ticket', { cache: 'no-store' })
  return printCigaretteShiftReceipt(close, suppliers, normalizeShiftTicketLayout(layout), printWindow)
}

export function printCigaretteDailyReceipt(closes, suppliers, businessDate) {
  const printWindow = openReceiptPrintWindow()
  if (!printWindow) return false
  return writeReceipt(printWindow, cigaretteDailyReceiptMarkup, closes, suppliers, businessDate)
}

