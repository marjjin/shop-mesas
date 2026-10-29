import { useCallback, useEffect, useState } from 'react'

export default function useRestaurantData(api, user, section, setMessage) {
  const [data, setData] = useState({ tables: [], products: [], categories: [], orders: [], pendingOrders: [], pendingOrderItems: [] })
  const [histories, setHistories] = useState([])
  const [loadedUser, setLoadedUser] = useState(null)
  const [historyUser, setHistoryUser] = useState(null)
  const [dataError, setDataError] = useState('')
  const [historyError, setHistoryError] = useState('')
  const load = useCallback(() => api('/bootstrap')
    .then((result) => { setData(result); setDataError(''); setMessage('') })
    .catch(() => { setDataError('No hay conexión con la API.'); setMessage('No hay conexión con la API.') })
    .finally(() => setLoadedUser(user)), [api, user, setMessage])
  const loadHistory = useCallback(() => api('/history')
    .then((result) => { setHistories(result); setHistoryError(''); setMessage('') })
    .catch(() => { setHistoryError('No se pudo cargar el historial.'); setMessage('No se pudo cargar el historial.') })
    .finally(() => setHistoryUser(user)), [api, user, setMessage])

  // Existing refresh cadence also keeps orders and the floor plan in sync.
  useEffect(() => {
    if (!user) return
    void load()
    const timer = setInterval(load, 10000)
    return () => clearInterval(timer)
  }, [user, load])
  useEffect(() => { if (user && section === 'history') void loadHistory() }, [user, section, loadHistory])
  return { data, setData, histories, load, loadHistory, loading: !!user && loadedUser !== user,
    loadingHistory: !!user && historyUser !== user, dataError, historyError }
}
