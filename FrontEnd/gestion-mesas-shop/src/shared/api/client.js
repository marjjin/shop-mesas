// Crea el cliente HTTP único que usa toda la aplicación.
import { resolveApiUrl } from '../utils/apiUrl.js'
import { createApiClient } from './createApiClient.js'
import { getSessionToken, expireSession } from '../../features/auth/sessionToken.js'

// En desarrollo usa el proxy de Vite; en producción, la URL pública de la API.
const apiUrl = import.meta.env.DEV ? '/api' : resolveApiUrl({
  configuredUrl: import.meta.env.VITE_API_URL, production: import.meta.env.PROD,
})

// Conecta el cliente con la sesión: de ahí obtiene el token y a quién avisar si venció.
export const api = createApiClient(apiUrl, fetch, { getToken: getSessionToken, onUnauthorized: expireSession })
