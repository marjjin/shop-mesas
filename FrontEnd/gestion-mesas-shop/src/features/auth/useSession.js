// Estado de la sesión: restaura al recargar, inicia y cierra.
import { useEffect, useRef, useState } from 'react'
import { getSessionToken, saveSessionToken, clearSessionToken, onSessionExpired } from './sessionToken.js'

export default function useSession(api, setMessage) {
  const [user, setUser] = useState(null)
  const [login, setLogin] = useState({ username: '', password: '' })
  const [busy, setBusy] = useState(false)
  // Si hay un token guardado, arranca en modo restaurando en lugar de mostrar el login.
  const [restoring, setRestoring] = useState(() => Boolean(getSessionToken()))
  // Contador de operaciones: invalida respuestas viejas si el usuario hizo algo más mientras tanto.
  const operation = useRef(0)

  // Si el cliente HTTP detecta un 401, se vuelve al login.
  useEffect(() => onSessionExpired(() => {
    operation.current++
    setUser(null)
    setMessage('La sesión venció. Volvé a ingresar.')
  }), [setMessage])

  // Al recargar la página, valida el token con el servidor. Nunca confía solo en lo guardado.
  useEffect(() => {
    const token = getSessionToken()
    sessionStorage.removeItem('mesa-user')
    if (!token) return
    let cancelled = false
    const currentOperation = operation.current
    api('/session').then((result) => {
      if (!cancelled && currentOperation === operation.current && getSessionToken() === token) setUser(result.user)
    }).catch((error) => {
      if (!cancelled) setMessage(error.message)
    }).finally(() => { if (!cancelled) setRestoring(false) })
    return () => { cancelled = true }
  }, [api, setMessage])

  // Envío del formulario de login.
  const loginSubmit = async (event) => {
    event.preventDefault()
    if (busy || restoring) return
    const currentOperation = ++operation.current
    setBusy(true)
    setMessage('')
    try {
      const result = await api('/login', { method: 'POST', body: JSON.stringify(login) })
      if (currentOperation !== operation.current) return
      saveSessionToken(result.token)
      setUser(result.user)
      // La contraseña no queda en memoria después de ingresar.
      setLogin((current) => ({ ...current, password: '' }))
    } catch (error) {
      setMessage(error.message)
    } finally {
      setBusy(false)
    }
  }

  // Cierra la sesión en el servidor; devuelve true si se pudo.
  const signOut = async () => {
    if (busy) return false
    setBusy(true)
    try {
      await api('/logout', { method: 'POST' })
      operation.current++
      clearSessionToken()
      setUser(null)
      setMessage('')
      return true
    } catch (error) {
      // Un 401 significa que ya estaba cerrada: cuenta como éxito.
      if (error.status === 401) return true
      setMessage('No se pudo cerrar la sesión en el servidor. Volvé a intentar.')
      return false
    } finally {
      setBusy(false)
    }
  }
  return { user, login, setLogin, loginSubmit, signOut, busy, restoring }
}
