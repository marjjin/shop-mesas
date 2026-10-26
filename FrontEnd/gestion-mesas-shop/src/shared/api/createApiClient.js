export function createApiClient(baseUrl, request = fetch) {
  return async (path, options = {}) => {
    const headers = new Headers(options.headers)
    // Content-Type: application/json is not a CORS-safelisted header. Only
    // send it for requests that actually contain a JSON body, so GET requests
    // do not trigger an unnecessary preflight on the deployed API.
    if (options.body != null && !headers.has('Content-Type'))
      headers.set('Content-Type', 'application/json')
    const response = await request(`${baseUrl}${path}`, { ...options, headers })
    if (!response.ok) {
      const problem = await response.json().catch(() => null)
      if (response.status === 404 && path === '/settings/welcome-message')
        throw new Error('La API no tiene disponible la configuración de bienvenida. Reiniciá el backend actualizado en local o desplegá su nueva versión en Render.')
      throw new Error(response.status === 401 ? 'Usuario o contraseña incorrectos.' : problem?.detail || 'No se pudo completar la operación.')
    }
    return response.status === 204 ? null : response.json()
  }
}
