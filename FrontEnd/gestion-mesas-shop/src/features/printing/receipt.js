import { receiptMarkup } from './templates/tableReceipt.js'
import { welcomeReceiptMarkup } from './templates/welcomeReceipt.js'
import { cashDropReceiptMarkup } from './templates/cashDropReceipt.js'
import { cigaretteShiftReceiptMarkup } from './templates/shiftReceipt.js'
import { cigaretteDailyReceiptMarkup } from './templates/dailyReceipt.js'
export { localDate, localTime } from '../../shared/utils/date.js'
export { downloadReceipt } from './downloadReceipt.js'

function writeReceipt(printWindow, markup, ...args) {
  printWindow.document.open()
  printWindow.document.write(markup(...args))
  printWindow.document.close()
  return true
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
  return writeReceipt(printWindow, receiptMarkup, history)
}

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

export function printCigaretteShiftReceipt(close, suppliers = []) {
  const printWindow = openReceiptPrintWindow()
  if (!printWindow) return false
  return writeReceipt(printWindow, cigaretteShiftReceiptMarkup, close, suppliers)
}

export function printCigaretteDailyReceipt(closes, suppliers, businessDate) {
  const printWindow = openReceiptPrintWindow()
  if (!printWindow) return false
  return writeReceipt(printWindow, cigaretteDailyReceiptMarkup, closes, suppliers, businessDate)
}

