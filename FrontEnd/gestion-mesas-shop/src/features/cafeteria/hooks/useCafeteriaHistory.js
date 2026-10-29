import { useEffect, useState } from 'react'
import { dateInputValue } from '../domain/cafeteriaView.js'

export default function useCafeteriaHistory(api, businessDate, refreshKey) {
  const [selection, setSelection] = useState(() => ({ date: businessDate || dateInputValue() }))
  const [result, setResult] = useState(null)
  const historyDate = selection.date
  const setHistoryDate = (date) => {
    if (date) setSelection((current) => current.date === date ? current : { date })
  }
  const retryHistory = () => setSelection((current) => ({ ...current }))
  // Each selection and dashboard refresh identifies its own request.
  const current = result?.selection === selection && result.api === api && result.refreshKey === refreshKey
  const loadingHistory = !current
  const shiftHistory = current ? result.items : []
  const historyError = current ? result.error : ''

  useEffect(() => {
    let cancelled = false
    api('/cafeteria/history?date=' + selection.date)
      .then((items) => {
        if (!cancelled) setResult({ selection, api, refreshKey, items, error: '' })
      })
      .catch(() => {
        if (!cancelled) setResult({ selection, api, refreshKey, items: [], error: 'No se pudo cargar el historial de este día.' })
      })
    return () => { cancelled = true }
  }, [api, selection, refreshKey])

  return { historyDate, setHistoryDate, retryHistory, loadingHistory, shiftHistory, historyError }
}
