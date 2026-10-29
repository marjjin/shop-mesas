import { printWelcomeReceipt } from '../../printing/receipt.js'

export async function reprintWelcome(table, api, printWindow) {
  if (table.status !== 'occupied' || !printWindow || printWindow.closed) return false
  const settings = await api('/settings/welcome-message', { cache: 'no-store' })
  return printWelcomeReceipt(table, printWindow, settings)
}
