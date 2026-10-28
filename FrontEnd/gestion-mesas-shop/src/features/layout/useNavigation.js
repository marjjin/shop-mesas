import { useEffect, useSyncExternalStore } from 'react'
import { createSectionNavigation } from './sectionNavigation.js'

const navigation = createSectionNavigation(window)

export default function useNavigation() {
  const section = useSyncExternalStore(navigation.subscribe, navigation.getSnapshot)
  useEffect(() => { navigation.initialize() }, [])
  return { section, setSection: navigation.navigate, subscribeToSectionChanges: navigation.subscribe }
}
