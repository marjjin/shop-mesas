const productionApi = 'https://shop-mesas.onrender.com/api'
const developmentApi = 'http://localhost:5000/api'

export function resolveApiUrl({ configuredUrl, production = false } = {}) {
  const value = configuredUrl?.trim() || (production ? productionApi : developmentApi)
  let url
  try { url = new URL(value) } catch {
    throw new Error('VITE_API_URL debe ser una URL completa de la API, por ejemplo https://shop-mesas.onrender.com/api.')
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash)
    throw new Error('VITE_API_URL debe usar HTTP o HTTPS y no incluir credenciales, parámetros ni fragmentos.')
  const local = url.hostname === 'localhost' || url.hostname.endsWith('.localhost') || url.hostname.startsWith('127.') || url.hostname === '[::1]'
  if (production && (local || url.protocol !== 'https:'))
    throw new Error('El deploy necesita una VITE_API_URL pública con HTTPS. No puede apuntar a localhost. Configurá la URL de Render y volvé a compilar.')
  const pathname = url.pathname.replace(/\/+$/, '') || '/api'
  return url.origin + pathname
}
