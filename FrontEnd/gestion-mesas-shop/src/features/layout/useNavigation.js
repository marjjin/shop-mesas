// Conecta el router propio con React.
import { useEffect, useSyncExternalStore } from 'react'
import { createSectionNavigation } from './sectionNavigation.js'

// Una sola instancia para toda la aplicación.
const navigation = createSectionNavigation(window)

export default function useNavigation() {
  // useSyncExternalStore vuelve a dibujar cuando cambia un valor externo a React, acá la URL.
  const section = useSyncExternalStore(navigation.subscribe, navigation.getSnapshot)
  useEffect(() => { navigation.initialize() }, [])
  return { section, setSection: navigation.navigate, subscribeToSectionChanges: navigation.subscribe }
}
