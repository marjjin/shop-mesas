// Tema claro, oscuro o del sistema, guardado en localStorage.
import { useCallback, useEffect, useState } from 'react'

const storageKey = 'mesa-theme'
const preferences = ['light', 'dark', 'system']
const systemQuery = '(prefers-color-scheme: dark)'

function readPreference() {
  try {
    const saved = localStorage.getItem(storageKey)
    return preferences.includes(saved) ? saved : 'system'
  } catch {
    return 'system'
  }
}

function resolveTheme(preference) {
  return preference === 'system'
    ? (window.matchMedia(systemQuery).matches ? 'dark' : 'light')
    : preference
}

// El CSS reacciona al atributo data-theme de la etiqueta html.
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme
  document.documentElement.style.colorScheme = theme
}

// preference es lo elegido; resolvedTheme, lo que realmente se aplica.
export default function useTheme() {
  const [preference, setPreference] = useState(readPreference)
  const [systemDark, setSystemDark] = useState(() => window.matchMedia(systemQuery).matches)
  const resolvedTheme = preference === 'system' ? (systemDark ? 'dark' : 'light') : preference

  const changeTheme = useCallback((next) => {
    if (!preferences.includes(next)) return
    applyTheme(resolveTheme(next))
    setPreference(next)
    try { localStorage.setItem(storageKey, next) } catch { /* Keep the selection for this session. */ }
  }, [])

  useEffect(() => {
    applyTheme(resolvedTheme)
  }, [resolvedTheme])

  // Sigue los cambios del sistema operativo y de otras pestañas.
  useEffect(() => {
    const media = window.matchMedia(systemQuery)
    const onSystemChange = (event) => setSystemDark(event.matches)
    const onStorageChange = (event) => {
      if (event.key !== storageKey && event.key !== null) return
      const next = readPreference()
      applyTheme(resolveTheme(next))
      setPreference(next)
    }
    media.addEventListener('change', onSystemChange)
    window.addEventListener('storage', onStorageChange)
    return () => {
      media.removeEventListener('change', onSystemChange)
      window.removeEventListener('storage', onStorageChange)
    }
  }, [])

  return { preference, resolvedTheme, changeTheme }
}
