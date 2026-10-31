// Resuelve y valida la URL de la API, tanto en el navegador como durante el build.
const productionApi = 'https://shop-mesas.onrender.com/api'
const developmentApi = 'http://localhost:5000/api'

// Lanza errores claros ante URLs inválidas en lugar de publicar un cliente roto.
export function resolveApiUrl({ configuredUrl, production = false } = {}) {
  const value = configuredUrl?.trim() || (production ? productionApi : developmentApi)
  let url
  try { url = new URL(value) } catch {
    throw new Error('VITE_API_URL debe ser una URL completa de la API, por ejemplo https://shop-mesas.onrender.com/api.')
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash)
    throw new Error('VITE_API_URL debe usar HTTP o HTTPS y no incluir credenciales, parámetros ni fragmentos.')
  const local = url.hostname === 'localhost' || url.hostname.endsWith('.localhost') || url.hostname.startsWith('127.') || url.hostname === '[::1]'
  // Producción exige HTTPS y una dirección pública.
  if (production && (local || url.protocol !== 'https:'))
    throw new Error('El deploy necesita una VITE_API_URL pública con HTTPS. No puede apuntar a localhost. Configurá la URL de Render y volvé a compilar.')
  // Quita barras finales. Si no hay ruta, usa /api.
  const pathname = url.pathname.replace(/\/+$/, '') || '/api'
  return url.origin + pathname
}
