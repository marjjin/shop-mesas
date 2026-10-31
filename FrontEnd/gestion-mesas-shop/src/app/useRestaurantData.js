// Datos compartidos del salón y sincronización periódica con el backend.
import { useCallback, useEffect, useState } from 'react'

// Devuelve los datos, la función load para refrescarlos y los indicadores de carga y error.
export default function useRestaurantData(api, user, section, setMessage) {
  const [data, setData] = useState({ tables: [], products: [], categories: [], orders: [], pendingOrders: [], pendingOrderItems: [] })
  const [histories, setHistories] = useState([])
  const [loadedUser, setLoadedUser] = useState(null)
  const [historyUser, setHistoryUser] = useState(null)
  const [dataError, setDataError] = useState('')
  const [historyError, setHistoryError] = useState('')
  // useCallback conserva la misma función entre renders: evita reiniciar el useEffect que la usa.
  const load = useCallback(() => api('/bootstrap')
    // Al recuperar la conexión borra solo el mensaje de error de conexión, no otros mensajes.
    .then((result) => { setData(result); setDataError(''); setMessage((current) => current === 'No hay conexión con la API.' ? '' : current) })
    .catch(() => { setDataError('No hay conexión con la API.'); setMessage('No hay conexión con la API.') })
    .finally(() => setLoadedUser(user)), [api, user, setMessage])
  const loadHistory = useCallback(() => api('/history')
    .then((result) => { setHistories(result); setHistoryError(''); setMessage((current) => current === 'No se pudo cargar el historial.' ? '' : current) })
    .catch(() => { setHistoryError('No se pudo cargar el historial.'); setMessage('No se pudo cargar el historial.') })
    .finally(() => setHistoryUser(user)), [api, user, setMessage])

  // Existing refresh cadence also keeps orders and the floor plan in sync.
  // Carga al iniciar sesión y repite cada 10 segundos. Así varios dispositivos ven lo mismo.
  useEffect(() => {
    if (!user) return
    void load()
    const timer = setInterval(load, 10000)
    // Limpieza: al salir o cambiar de usuario se detiene el temporizador.
    return () => clearInterval(timer)
  }, [user, load])
  // El historial solo se pide al entrar a esa sección.
  useEffect(() => { if (user && section === 'history') void loadHistory() }, [user, section, loadHistory])
  return { data, setData, histories, load, loadHistory, loading: !!user && loadedUser !== user,
    loadingHistory: !!user && historyUser !== user, dataError, historyError }
}
