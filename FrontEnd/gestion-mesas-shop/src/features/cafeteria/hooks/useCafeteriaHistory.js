import { useEffect, useState } from 'react'

export default function useCafeteriaHistory(api) {
  const [selection, setSelection] = useState(() => ({ date: new Date().toISOString().slice(0, 10) }))
  const [result, setResult] = useState(null)
  const historyDate = selection.date
  const setHistoryDate = (date) => setSelection((current) => current.date === date ? current : { date })
  // Each selection identifies its request, including returning to a previous date.
  const current = result?.selection === selection && result.api === api
  const loadingHistory = !current
  const shiftHistory = current ? result.items : []
  const historyError = current ? result.error : ''

  useEffect(() => {
    let cancelled = false
    api('/cafeteria/history?date=' + selection.date)
      .then((items) => {
        if (!cancelled) setResult({ selection, api, items, error: '' })
      })
      .catch(() => {
        if (!cancelled) setResult({ selection, api, items: [], error: 'No se pudo cargar el historial de este día.' })
      })
    return () => { cancelled = true }
  }, [api, selection])

  return { historyDate, setHistoryDate, loadingHistory, shiftHistory, historyError }
}
