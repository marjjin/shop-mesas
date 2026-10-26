import { useCallback, useEffect, useState } from 'react'

export default function useRestaurantData(api, user, section, setMessage) {
  const [data, setData] = useState({ tables: [], products: [], categories: [], orders: [], pendingOrders: [], pendingOrderItems: [] })
  const [histories, setHistories] = useState([])
  const load = useCallback(() => api('/bootstrap')
    .then((result) => { setData(result); setMessage('') })
    .catch(() => { setMessage('No hay conexión con la API.') }), [api, setMessage])
  const loadHistory = useCallback(() => api('/history')
    .then((result) => { setHistories(result); setMessage('') })
    .catch(() => { setMessage('No se pudo cargar el historial.') }), [api, setMessage])

  // Existing refresh cadence also keeps orders and the floor plan in sync.
  useEffect(() => {
    if (!user) return
    void load()
    const timer = setInterval(load, 10000)
    return () => clearInterval(timer)
  }, [user, load])
  useEffect(() => { if (user && section === 'history') void loadHistory() }, [user, section, loadHistory])
  return { data, setData, histories, load, loadHistory }
}
