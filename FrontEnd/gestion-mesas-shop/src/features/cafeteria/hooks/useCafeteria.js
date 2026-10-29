import { useCallback, useEffect, useRef, useState } from 'react'
import { dateInputValue } from '../domain/cafeteriaView.js'

export default function useCafeteria({ api, onSummaryChange }) {
  const [dashboard, setDashboard] = useState(null)
  const [product, setProduct] = useState({ name: '', price: '' })
  const [editing, setEditing] = useState(null)
  const [pendingAction, setPendingAction] = useState('')
  const [message, setMessage] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const actionRef = useRef(false)
  const loadingRef = useRef(false)
  const businessDate = new Date(`${dashboard?.businessDate || dateInputValue()}T12:00:00`)
  const businessDateLabel = businessDate.toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })
  const monthLabel = businessDate.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })

  const load = useCallback(async () => {
    if (loadingRef.current) return false
    loadingRef.current = true
    setRefreshing(true)
    try {
      const loaded = await api('/cafeteria/dashboard')
      setDashboard(loaded)
      onSummaryChange(loaded.summary)
      setLoadError('')
      return true
    } catch {
      setLoadError('No se pudo actualizar Caja Cafetería. Volvé a intentar para consultar los datos actuales.')
      return false
    } finally {
      loadingRef.current = false
      setLoading(false)
      setRefreshing(false)
    }
  }, [api, onSummaryChange])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load() }, [load])

  const execute = async (operation, successMessage, action) => {
    if (actionRef.current || loadingRef.current || loadError) return false
    actionRef.current = true
    setPendingAction(action)
    setMessage(null)
    try {
      await operation()
      await load()
      setMessage({ type: 'success', text: successMessage })
      return true
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'No se pudo completar la operación.' })
      return false
    } finally {
      actionRef.current = false
      setPendingAction('')
    }
  }

  const addProduct = async (event) => {
    event.preventDefault()
    const saved = await execute(() => api('/cafeteria/products', { method: 'POST', body: JSON.stringify({ name: product.name.trim(), price: Number(product.price) }) }), 'Artículo agregado a las próximas ventas.', 'add')
    if (saved) setProduct({ name: '', price: '' })
    return saved
  }
  const saveProduct = async (event) => {
    event.preventDefault()
    const saved = await execute(() => api(`/cafeteria/products/${editing.id}`, { method: 'PUT', body: JSON.stringify({ name: editing.name.trim(), price: Number(editing.price) }) }), 'Artículo actualizado. Las ventas anteriores conservan su precio.', 'edit')
    if (saved) setEditing(null)
    return saved
  }
  const deleteProduct = (item) => execute(() => api(`/cafeteria/products/${item.id}`, { method: 'DELETE' }), 'Artículo quitado de las próximas ventas.', 'delete')

  return { dashboard, product, setProduct, editing, setEditing, busy: Boolean(pendingAction), pendingAction,
    message, dismissMessage: () => setMessage(null), loading, refreshing, loadError, load,
    businessDateLabel, monthLabel, addProduct, saveProduct, deleteProduct }
}
