export const editableTransactionTypes = new Set(['purchase', 'reserved_purchase', 'payment', 'reserved_adjustment', 'current_account_adjustment', 'reserved_exchange'])

export function transactionLabel(type) {
  return type === 'allocation' ? 'Reserva de cierre' : type === 'purchase' ? 'Compra a cuenta corriente' : type === 'reserved_purchase' ? 'Compra con fondos reservados' : type === 'reserved_transfer_in' ? 'Fondos recibidos de otro proveedor' : type === 'reserved_transfer_out' ? 'Fondos transferidos a otro proveedor' : type === 'reserved_exchange' ? 'Movimiento entre efectivo y Mercado Pago' : type === 'reserved_adjustment' ? 'Ajuste de fondos reservados' : type === 'current_account_adjustment' ? 'Ajuste de cuenta corriente' : 'Pago de cuenta corriente'
}

export function transactionFormValues(transaction) {
  const splitType = transaction.type === 'reserved_purchase' || transaction.type === 'payment'
  return {
    amount: String(transaction.amount),
    cashAmount: splitType ? String(Math.abs(transaction.cashAmount)) : String(transaction.cashAmount),
    mercadoPagoAmount: splitType ? String(Math.abs(transaction.mercadoPagoAmount)) : String(transaction.mercadoPagoAmount),
    note: transaction.note || ''
  }
}

export function normalizeSuppliers(value) {
  return (Array.isArray(value) ? value : []).map((supplier) => ({
    ...supplier,
    transactions: Array.isArray(supplier.transactions) ? supplier.transactions : []
  }))
}

export function sumPaymentAmounts(cashAmount, mercadoPagoAmount) {
  if (!cashAmount && !mercadoPagoAmount) return ''
  const total = Number(cashAmount || 0) + Number(mercadoPagoAmount || 0)
  return Number.isFinite(total) ? String(Math.round(total * 100) / 100) : ''
}
