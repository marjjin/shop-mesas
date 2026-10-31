// Guarda el token en sessionStorage: se borra al cerrar la pestaña.
// Separado de React para que el cliente HTTP pueda usarlo sin depender de componentes.
const tokenKey = 'mesa-session-token'
const expiredEvent = 'mesa-session-expired'

export function getSessionToken() {
  return sessionStorage.getItem(tokenKey)
}

export function saveSessionToken(token) {
  sessionStorage.setItem(tokenKey, token)
  sessionStorage.removeItem('mesa-user')
}

// Solo borra si es el token esperado: una respuesta tardía no debe eliminar una sesión más nueva.
export function clearSessionToken(expectedToken = getSessionToken()) {
  if (getSessionToken() !== expectedToken) return false
  sessionStorage.removeItem(tokenKey)
  sessionStorage.removeItem('mesa-user')
  return true
}

// Avisa con un evento del navegador, y useSession reacciona a ese evento.
export function expireSession(token) {
  if (clearSessionToken(token)) window.dispatchEvent(new Event(expiredEvent))
}

export function onSessionExpired(callback) {
  window.addEventListener(expiredEvent, callback)
  return () => window.removeEventListener(expiredEvent, callback)
}
