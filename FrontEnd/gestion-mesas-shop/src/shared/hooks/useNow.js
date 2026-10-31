// Devuelve la hora actual y se actualiza cada segundo: mueve los relojes de las mesas.
import { useEffect, useState } from 'react'

export default function useNow() {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])
  return now
}
