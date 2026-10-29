import { resolveApiUrl } from '../utils/apiUrl.js'
import { createApiClient } from './createApiClient.js'
import { getSessionToken, expireSession } from '../../features/auth/sessionToken.js'

const apiUrl = import.meta.env.DEV ? '/api' : resolveApiUrl({
  configuredUrl: import.meta.env.VITE_API_URL, production: import.meta.env.PROD,
})

export const api = createApiClient(apiUrl, fetch, { getToken: getSessionToken, onUnauthorized: expireSession })
