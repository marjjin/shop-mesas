import { useState } from 'react'
import { transactionFormValues, transactionLabel } from '../domain/transactions.js'

export default function useSupplierTransactions({ api, load, setMessage }) {
  const [editingTransaction, setEditingTransaction] = useState(null)
  const [transactionForm, setTransactionForm] = useState({ amount: '', cashAmount: '', mercadoPagoAmount: '', note: '' })
  const [transactionBusy, setTransactionBusy] = useState(false)
  const beginTransactionEdit = (transaction) => {
    setEditingTransaction(transaction)
    setTransactionForm(transactionFormValues(transaction))
  }
  const saveTransaction = async (event, supplier) => {
    event.preventDefault()
    const amount = Number(transactionForm.amount)
    const cashAmount = Number(transactionForm.cashAmount || 0)
    const mercadoPagoAmount = Number(transactionForm.mercadoPagoAmount || 0)
    setTransactionBusy(true)
    try {
      await api(`/suppliers/${supplier.id}/transactions/${editingTransaction.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ amount, cashAmount, mercadoPagoAmount, note: transactionForm.note })
      })
      setEditingTransaction(null)
      await load()
    } catch (error) { setMessage(error.message) } finally { setTransactionBusy(false) }
  }
  const deleteTransaction = async (transaction, supplier) => {
    if (!window.confirm(`¿Eliminar ${transactionLabel(transaction.type).toLowerCase()}? Esta acción ajustará los saldos del proveedor.`)) return
    setTransactionBusy(true)
    try {
      await api(`/suppliers/${supplier.id}/transactions/${transaction.id}`, { method: 'DELETE' })
      await load()
    } catch (error) { setMessage(error.message) } finally { setTransactionBusy(false) }
  }

  return { editingTransaction, setEditingTransaction, transactionForm, setTransactionForm, transactionBusy, beginTransactionEdit, saveTransaction, deleteTransaction }
}
