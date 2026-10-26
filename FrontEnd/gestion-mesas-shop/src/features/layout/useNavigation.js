import { useEffect, useState } from 'react'

const sections = new Set(['salon', 'pending', 'catalog', 'cafeteria', 'cigarettes', 'suppliers', 'cash-drops', 'shift-close', 'history', 'settings'])

export default function useNavigation() {
  const [section, setSection] = useState(() => {
    const storedSection = sessionStorage.getItem('mesa-section')
    return sections.has(storedSection) ? storedSection : 'salon'
  })
  useEffect(() => { sessionStorage.setItem('mesa-section', section) }, [section])
  return { section, setSection }
}
