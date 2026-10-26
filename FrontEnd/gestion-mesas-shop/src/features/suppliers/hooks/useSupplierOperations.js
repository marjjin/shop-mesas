import { useState } from 'react'
import { sumPaymentAmounts } from '../domain/transactions.js'

export default function useSupplierOperations({ api, load, setMessage }) {
  const [purchase, setPurchase] = useState({ amount: '', note: '', paymentMethod: 'reserved', cashAmount: '', mercadoPagoAmount: '' })
  const [payment, setPayment] = useState({})
  const [transfer, setTransfer] = useState({ targetSupplierId: '', cashAmount: '', mercadoPagoAmount: '', note: '' })
  const [exchange, setExchange] = useState({ amount: '', fromPaymentMethod: 'cash', note: '' })
  const [transferMode, setTransferMode] = useState('internal')
  const [operation, setOperation] = useState('purchase')
  const pay = async (event, supplier) => {
    event.preventDefault()
    const cashAmount = Number(payment[supplier.id]?.cashAmount || 0)
    const mercadoPagoAmount = Number(payment[supplier.id]?.mercadoPagoAmount || 0)
    const amount = cashAmount + mercadoPagoAmount
    if (!amount || amount <= 0) return setMessage('Ingresá un importe de pago válido.')
    if (amount > supplier.currentAccountBalance) return setMessage(`El pago no puede superar el saldo de cuenta corriente de ${supplier.name}.`)
    if (cashAmount > supplier.reservedCashBalance || mercadoPagoAmount > supplier.reservedMercadoPagoBalance) return setMessage(`El pago no puede superar los fondos reservados seleccionados de ${supplier.name}.`)
    try {
      await api(`/suppliers/${supplier.id}/payments`, { method: 'POST', body: JSON.stringify({ cashAmount, mercadoPagoAmount }) })
      setPayment({ ...payment, [supplier.id]: { cashAmount: '', mercadoPagoAmount: '' } })
      await load()
    } catch (error) { setMessage(error.message) }
  }
  const registerPurchase = async (event, supplier) => {
    event.preventDefault()
    const amount = Number(purchase.amount || 0)
    if (!amount || amount <= 0) return setMessage('Ingresá un importe de compra válido.')
    try {
      const cashAmount = Number(purchase.cashAmount || 0)
      const mercadoPagoAmount = Number(purchase.mercadoPagoAmount || 0)
      const splitAmount = Number(sumPaymentAmounts(purchase.cashAmount, purchase.mercadoPagoAmount) || 0)
      if (purchase.paymentMethod === 'reserved' && amount !== splitAmount) return setMessage('El efectivo y Mercado Pago deben sumar el importe de la compra.')
      if (cashAmount > supplier.reservedCashBalance || mercadoPagoAmount > supplier.reservedMercadoPagoBalance) return setMessage(`La compra no puede superar los fondos reservados seleccionados de ${supplier.name}.`)
      await api(`/suppliers/${supplier.id}/purchases`, { method: 'POST', body: JSON.stringify({ amount, note: purchase.note, paymentMethod: purchase.paymentMethod, cashAmount, mercadoPagoAmount }) })
      setPurchase({ amount: '', note: '', paymentMethod: 'reserved', cashAmount: '', mercadoPagoAmount: '' })
      await load()
    } catch (error) { setMessage(error.message) }
  }
  const transferReservedFunds = async (event, supplier) => {
    event.preventDefault()
    const cashAmount = Number(transfer.cashAmount || 0)
    const mercadoPagoAmount = Number(transfer.mercadoPagoAmount || 0)
    const amount = cashAmount + mercadoPagoAmount
    const targetSupplierId = Number(transfer.targetSupplierId)
    if (!targetSupplierId) return setMessage('Elegí el proveedor que recibirá los fondos.')
    if (!amount || amount <= 0) return setMessage('Ingresá un importe de transferencia válido.')
    if (cashAmount > supplier.reservedCashBalance || mercadoPagoAmount > supplier.reservedMercadoPagoBalance) return setMessage(`La transferencia no puede superar los fondos reservados seleccionados de ${supplier.name}.`)
    try {
      await api('/suppliers/transfers', { method: 'POST', body: JSON.stringify({ sourceSupplierId: supplier.id, targetSupplierId, cashAmount, mercadoPagoAmount, note: transfer.note }) })
      setTransfer({ targetSupplierId: '', cashAmount: '', mercadoPagoAmount: '', note: '' })
      await load()
    } catch (error) { setMessage(error.message) }
  }
  const exchangeReservedFunds = async (event, supplier) => {
    event.preventDefault()
    const amount = Number(exchange.amount || 0)
    const available = exchange.fromPaymentMethod === 'cash' ? supplier.reservedCashBalance : supplier.reservedMercadoPagoBalance
    if (!amount || amount <= 0) return setMessage('Ingresá un importe válido para mover.')
    if (amount > available) return setMessage('El importe no puede superar los fondos disponibles en el medio de origen.')
    try {
      await api(`/suppliers/${supplier.id}/exchanges`, { method: 'POST', body: JSON.stringify({ amount, fromPaymentMethod: exchange.fromPaymentMethod, note: exchange.note }) })
      setExchange({ amount: '', fromPaymentMethod: exchange.fromPaymentMethod, note: '' })
      await load()
    } catch (error) { setMessage(error.message) }
  }

  return {
    purchase,
    setPurchase,
    payment,
    setPayment,
    transfer,
    setTransfer,
    exchange,
    setExchange,
    transferMode,
    setTransferMode,
    operation,
    setOperation,
    pay,
    registerPurchase,
    transferReservedFunds,
    exchangeReservedFunds
  }
}
