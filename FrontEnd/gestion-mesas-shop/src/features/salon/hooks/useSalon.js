import { useCallback, useMemo, useRef, useState } from 'react'
import { isCoworkingService } from '../../../shared/utils/products.js'
import { openReceiptPrintWindow, printReceipt, printWelcomeReceipt } from '../../printing/receipt.js'

export default function useSalon({ api, data, setData, load, loadHistory, setMessage, setSection }) {
  const [selectedId, setSelectedId] = useState(null)
  const [editingMode, setEditingMode] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [assigningPendingOrderId, setAssigningPendingOrderId] = useState(null)
  const [assigningTable, setAssigningTable] = useState(false)
  const assignmentLock = useRef(false)
  const selected = data.tables.find((table) => table.id === selectedId)
  const assigningPendingOrder = data.pendingOrders?.find((order) => order.id === assigningPendingOrderId)
  const orders = useMemo(() => data.orders
    .filter((order) => order.tableId === selectedId)
    .map((order) => ({ ...order, product: data.products.find((product) => product.id === order.productId) }))
    .filter((order) => order.product), [data, selectedId])
  const coworkingTableIds = useMemo(() => {
    const serviceIds = new Set(data.products.filter(isCoworkingService).map((product) => product.id))
    return new Set(data.orders.filter((order) => serviceIds.has(order.productId)).map((order) => order.tableId))
  }, [data])
  const coworkingTables = data.tables.filter((table) => coworkingTableIds.has(table.id))


  const saveTable = async (id, patch) => {
    setData((old) => ({ ...old, tables: old.tables.map((table) => table.id === id ? { ...table, ...patch } : table) }))
    const saved = await api(`/tables/${id}`, { method: 'PATCH', body: JSON.stringify(patch) })
    setData((old) => ({ ...old, tables: old.tables.map((table) => table.id === id ? saved : table) }))
  }
  const addTable = async () => {
    try {
      const table = await api('/tables', { method: 'POST', body: JSON.stringify({ seats: 4 }) })
      await load()
      setEditingId(table.id)
      setMessage('')
    } catch (error) {
      setMessage(error.message)
    }
  }
  const updateOpenedAt = async (id, openedAt) => {
    const saved = await api(`/tables/${id}`, { method: 'PATCH', body: JSON.stringify({ openedAt }) })
    setData((old) => ({ ...old, tables: old.tables.map((table) => table.id === id ? saved : table) }))
  }
  const closeTable = async (id) => {
    const printWindow = openReceiptPrintWindow()
    try {
      const result = await api(`/tables/${id}/close`, { method: 'POST' })
      setSelectedId(null)
      const printStarted = printReceipt(result.history, printWindow)
      await Promise.all([load(), loadHistory()])
      if (!printStarted) setMessage('Mesa cerrada. Habilitá las ventanas emergentes para imprimir el ticket automáticamente.')
    } catch (error) {
      printWindow?.close()
      setMessage(error.message)
    }
  }
  const deleteTable = async (table) => {
    const warning = table.status === 'occupied'
      ? `¿Eliminar ${table.name}? También se borrarán sus consumos actuales. Los cierres anteriores se conservarán.`
      : `¿Eliminar ${table.name} del salón?`
    if (!window.confirm(warning)) return false
    try {
      await api(`/tables/${table.id}`, { method: 'DELETE' })
      setSelectedId(null)
      setEditingId(null)
      await load()
      setMessage(`${table.name} fue eliminada.`)
      return true
    } catch (error) {
      setMessage(error.message)
      return false
    }
  }
  const changeSection = useCallback((nextSection) => {
    if (nextSection === 'pending') {
      setSelectedId(null)
      setEditingId(null)
      setAssigningPendingOrderId(null)
    }
    if (nextSection === 'catalog') {
      setSelectedId(null)
      setAssigningPendingOrderId(null)
    }
    if (nextSection === 'cigarettes') {
      setSelectedId(null)
      setEditingId(null)
      setAssigningPendingOrderId(null)
    }
    if (nextSection === 'shift-close' || nextSection === 'suppliers' || nextSection === 'cash-drops' || nextSection === 'invoices' || nextSection === 'settings') {
      setSelectedId(null)
      setEditingId(null)
      setAssigningPendingOrderId(null)
    }
    if (nextSection === 'cafeteria') {
      setSelectedId(null)
      setEditingId(null)
      setAssigningPendingOrderId(null)
    }
    if (nextSection === 'history') {
      setSelectedId(null)
      setAssigningPendingOrderId(null)
    }
  }, [])
  const chooseTableForPendingOrder = (pendingOrderId) => {
    setSection('salon')
    setAssigningPendingOrderId(pendingOrderId)
    setEditingMode(false)
    setEditingId(null)
    setSelectedId(null)
    setMessage('')
  }
  const assignPendingOrderToTable = async (tableId) => {
    if (!assigningPendingOrder || assigningTable || assignmentLock.current) return
    const table = data.tables.find((item) => item.id === tableId)
    if (!table || table.status !== 'free') return
    assignmentLock.current = true
    const printWindow = openReceiptPrintWindow()
    setAssigningTable(true)
    setMessage('')
    try {
      const ticketSettings = await api('/settings/welcome-message', { cache: 'no-store' })
      const result = await api(`/pending-orders/${assigningPendingOrder.id}/assign`, { method: 'POST', body: JSON.stringify({ tableId }) })
      const printStarted = printWelcomeReceipt(result.table, printWindow, ticketSettings)
      setAssigningPendingOrderId(null)
      await load()
      setSelectedId(result.table.id)
      if (!printStarted) setMessage('Pedido asignado. Habilitá las ventanas emergentes para imprimir el ticket de bienvenida.')
    } catch {
      printWindow?.close()
      await load()
      setMessage('No se pudo asignar esa mesa. Elegí otra mesa libre.')
    } finally {
      assignmentLock.current = false
      setAssigningTable(false)
    }
  }

  const reset = () => {
    setSelectedId(null)
    setEditingMode(false)
    setEditingId(null)
    setAssigningPendingOrderId(null)
  }
  return { selected, orders, selectedId, setSelectedId, editingMode, setEditingMode, editingId, setEditingId,
    assigningPendingOrder, assigningTable, setAssigningPendingOrderId, coworkingTableIds, coworkingTables,
    saveTable, addTable, updateOpenedAt, closeTable, deleteTable, changeSection, chooseTableForPendingOrder, assignPendingOrderToTable, reset }
}
