export function createApiClient(baseUrl, request = fetch, { getToken = () => null, onUnauthorized = () => {} } = {}) {
  return async (path, options = {}) => {
    const headers = new Headers(options.headers)
    const token = getToken()
    if (token) headers.set('Authorization', `Bearer ${token}`)
    // Content-Type: application/json is not a CORS-safelisted header. Only
    // send it for requests that actually contain a JSON body, so GET requests
    // do not trigger an unnecessary preflight on the deployed API.
    if (options.body != null && !headers.has('Content-Type'))
      headers.set('Content-Type', 'application/json')
    const response = await request(`${baseUrl}${path}`, { ...options, headers })
    if (!response.ok) {
      if (response.status === 401 && path !== '/login') onUnauthorized(token)
      const problem = await response.json().catch(() => null)
      if (response.status === 404 && path === '/settings/welcome-message')
        throw new Error('La API no tiene disponible la configuración de bienvenida. Reiniciá el backend actualizado en local o desplegá su nueva versión en Render.')
      const message = response.status === 401
        ? path === '/login' ? 'Usuario o contraseña incorrectos.' : 'La sesión venció. Volvé a ingresar.'
        : response.status === 403 ? 'No tenés permiso para realizar esta operación.'
          : response.status === 429 ? 'Demasiados intentos. Esperá un minuto y volvé a intentar.'
            : problem?.detail || 'No se pudo completar la operación.'
      throw Object.assign(new Error(message), { status: response.status })
    }
    return response.status === 204 ? null : response.json()
  }
}
