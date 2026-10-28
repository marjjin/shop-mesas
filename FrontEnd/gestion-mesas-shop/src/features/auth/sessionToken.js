const tokenKey = 'mesa-session-token'
const expiredEvent = 'mesa-session-expired'

export function getSessionToken() {
  return sessionStorage.getItem(tokenKey)
}

export function saveSessionToken(token) {
  sessionStorage.setItem(tokenKey, token)
  sessionStorage.removeItem('mesa-user')
}

export function clearSessionToken(expectedToken = getSessionToken()) {
  if (getSessionToken() !== expectedToken) return false
  sessionStorage.removeItem(tokenKey)
  sessionStorage.removeItem('mesa-user')
  return true
}

export function expireSession(token) {
  if (clearSessionToken(token)) window.dispatchEvent(new Event(expiredEvent))
}

export function onSessionExpired(callback) {
  window.addEventListener(expiredEvent, callback)
  return () => window.removeEventListener(expiredEvent, callback)
}
