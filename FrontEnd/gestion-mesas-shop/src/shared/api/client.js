import { resolveApiUrl } from '../utils/apiUrl.js'
import { createApiClient } from './createApiClient.js'
import { getSessionToken, expireSession } from '../../features/auth/sessionToken.js'

export const api = createApiClient(resolveApiUrl({
  configuredUrl: import.meta.env.VITE_API_URL, production: import.meta.env.PROD,
}), fetch, { getToken: getSessionToken, onUnauthorized: expireSession })
