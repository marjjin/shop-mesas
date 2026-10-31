// Router propio: relaciona cada sección con una URL sin usar una librería externa.
export const sectionPaths = Object.freeze({
  salon: '/mesas',
  pending: '/pedidos',
  catalog: '/articulos',
  cafeteria: '/cafeteria',
  cigarettes: '/cigarrillos',
  suppliers: '/proveedores',
  invoices: '/facturas',
  'cash-drops': '/tiradas',
  'shift-close': '/cierre-turno',
  history: '/historial',
  settings: '/configuracion',
})

// Mapa inverso: de ruta a sección.
const sectionsByPath = new Map(Object.entries(sectionPaths).map(([section, path]) => [path, section]))
const sectionKey = 'mesa-section'

// Recibe browser por parámetro para poder probarlo con un navegador simulado.
export function createSectionNavigation(browser) {
  const listeners = new Set()
  // Decide la sección actual leyendo la URL.
  const getSnapshot = () => {
    const pathname = browser.location.pathname.replace(/\/+$/, '') || '/'
    // En la raíz recupera la última sección de la sesión.
    if (pathname === '/') {
      try {
        const stored = browser.sessionStorage.getItem(sectionKey)
        if (Object.hasOwn(sectionPaths, stored)) return stored
      } catch { /* Navigation also works when browser storage is unavailable. */ }
    }
    return sectionsByPath.get(pathname) ?? 'salon'
  }
  const remember = (section) => {
    try { browser.sessionStorage.setItem(sectionKey, section) } catch { /* The URL remains the source of truth. */ }
  }
  // Corrige la URL si no coincide con la sección, sin sumar una entrada al historial.
  const normalizeLocation = () => {
    const section = getSnapshot()
    const pathname = sectionPaths[section]
    if (browser.location.pathname !== pathname)
      browser.history.replaceState(browser.history.state, '', pathname + browser.location.search + browser.location.hash)
    remember(section)
    return section
  }
  const notify = () => {
    const section = getSnapshot()
    for (const listener of listeners) listener(section)
  }
  // Se dispara con los botones atrás y adelante del navegador.
  const handlePopState = () => {
    normalizeLocation()
    notify()
  }
  return {
    getSnapshot,
    initialize: normalizeLocation,
    subscribe: (listener) => {
      if (listeners.size === 0) browser.addEventListener('popstate', handlePopState)
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
        if (listeners.size === 0) browser.removeEventListener('popstate', handlePopState)
      }
    },
    // pushState cambia la URL sin recargar la página.
    navigate: (section) => {
      if (!Object.hasOwn(sectionPaths, section)) return
      const path = sectionPaths[section]
      if (browser.location.pathname !== path) browser.history.pushState(null, '', path)
      remember(section)
      notify()
    },
  }
}
