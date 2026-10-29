import { useCallback, useEffect, useState } from 'react'

export default function useCafeteria({ api, onSummaryChange }) {
  const [dashboard, setDashboard] = useState({ products: [], summary: { saleCount: 0, totalSales: 0, items: [] }, daySummary: { saleCount: 0, totalSales: 0 }, monthSummary: { saleCount: 0, totalSales: 0 }, recentShiftHistory: [] })
  const [product, setProduct] = useState({ name: '', price: '' })
  const [editing, setEditing] = useState(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const businessDate = new Date(`${dashboard.businessDate || new Date().toISOString().slice(0, 10)}T12:00:00`)
  const businessDateLabel = businessDate.toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })
  const monthLabel = businessDate.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })

  const load = useCallback(async () => {
    try {
      const loaded = await api('/cafeteria/dashboard')
      setDashboard(loaded)
      onSummaryChange(loaded.summary)
      setMessage('')
    } catch {
      setMessage('No se pudo cargar la Caja Cafetería.')
    } finally {
      setLoading(false)
    }
  }, [api, onSummaryChange])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load() }, [load])
  const execute = async (operation, successMessage) => {
    setBusy(true)
    setMessage('')
    try {
      await operation()
      await load()
      setMessage(successMessage)
      return true
    } catch (error) {
      setMessage(error.message || 'No se pudo completar la operación.')
      return false
    } finally {
      setBusy(false)
    }
  }

  const addProduct = async (event) => {
    event.preventDefault()
    const saved = await execute(() => api('/cafeteria/products', { method: 'POST', body: JSON.stringify({ name: product.name, price: Number(product.price) }) }), 'Artículo de cafetería agregado correctamente.')
    if (saved) setProduct({ name: '', price: '' })
  }
  const saveProduct = async (event) => {
    event.preventDefault()
    const saved = await execute(() => api(`/cafeteria/products/${editing.id}`, { method: 'PUT', body: JSON.stringify({ name: editing.name, price: Number(editing.price) }) }), 'Artículo actualizado correctamente.')
    if (saved) setEditing(null)
  }
  const deleteProduct = async (item) => {
    if (!window.confirm(`¿Quitar ${item.name} de las próximas ventas de cafetería? Las ventas ya registradas se conservarán.`)) return
    await execute(() => api(`/cafeteria/products/${item.id}`, { method: 'DELETE' }), 'Artículo quitado de la caja.')
  }


  return { dashboard, product, setProduct, editing, setEditing, busy, message, loading,
    businessDateLabel, monthLabel, addProduct, saveProduct, deleteProduct }
}
