export const sectionPaths = Object.freeze({
  salon: '/mesas',
  pending: '/pedidos',
  catalog: '/articulos',
  cafeteria: '/cafeteria',
  cigarettes: '/cigarrillos',
  suppliers: '/proveedores',
  'cash-drops': '/tiradas',
  'shift-close': '/cierre-turno',
  history: '/historial',
  settings: '/configuracion',
})

const sectionsByPath = new Map(Object.entries(sectionPaths).map(([section, path]) => [path, section]))
const sectionKey = 'mesa-section'

export function createSectionNavigation(browser) {
  const listeners = new Set()
  const getSnapshot = () => {
    const pathname = browser.location.pathname.replace(/\/+$/, '') || '/'
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
    navigate: (section) => {
      if (!Object.hasOwn(sectionPaths, section)) return
      const path = sectionPaths[section]
      if (browser.location.pathname !== path) browser.history.pushState(null, '', path)
      remember(section)
      notify()
    },
  }
}
