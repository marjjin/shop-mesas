import { useCallback, useEffect, useRef, useState } from 'react'
import { monthRange, previousShift } from '../domain/businessDate.js'
import { normalizeCigaretteDashboard, buildMonthlyRanking } from '../domain/dashboard.js'

export default function useCigaretteDashboard({ api, date, shift, setMessage }) {
  const [dashboard, setDashboard] = useState({ products: [], purchases: [], closes: [], cashDrops: [] })
  const [suppliers, setSuppliers] = useState([])
  const [cafeteriaSummary, setCafeteriaSummary] = useState(null)
  const [cafeteriaError, setCafeteriaError] = useState('')
  const [previousChangeCash, setPreviousChangeCash] = useState(null)
  const [monthlyRanking, setMonthlyRanking] = useState([])
  const [loadingRanking, setLoadingRanking] = useState(false)
  const [rankingError, setRankingError] = useState('')
  const dashboardLoadId = useRef(0)
  const load = useCallback(async () => {
    const currentLoadId = ++dashboardLoadId.current
    try {
      const [cigarettesResult, cafeteriaResult, suppliersResult] = await Promise.allSettled([
        api(`/cigarettes?date=${date}`),
        api('/cafeteria/dashboard'),
        api('/suppliers')
      ])
      if (cigarettesResult.status === 'rejected') throw cigarettesResult.reason
      if (currentLoadId !== dashboardLoadId.current) return
      setDashboard(normalizeCigaretteDashboard(cigarettesResult.value))
      if (cafeteriaResult.status === 'fulfilled') {
        setCafeteriaSummary(cafeteriaResult.value.summary)
        setCafeteriaError('')
      } else {
        setCafeteriaSummary(null)
        setCafeteriaError('No se pudo cargar la Caja Cafetería.')
      }
      const loadedSuppliers = suppliersResult.status === 'fulfilled' && Array.isArray(suppliersResult.value) ? suppliersResult.value : []
      setSuppliers(loadedSuppliers.filter((supplier) => supplier.isActive))
      setMessage('')
    } catch { setMessage('No se pudo cargar la información de cigarrillos.') }
  }, [api, date, setMessage])
  const loadMonthlyRanking = useCallback(async () => {
    setLoadingRanking(true)
    setRankingError('')
    try {
      const { from, to } = monthRange(date)
      const closes = await api(`/cigarettes/closes?from=${from}&to=${to}`)
      setMonthlyRanking(buildMonthlyRanking(Array.isArray(closes) ? closes : []))
    } catch {
      setRankingError('No se pudo cargar el ranking mensual.')
    } finally {
      setLoadingRanking(false)
    }
  }, [api, date])
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load() }, [load])
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadMonthlyRanking() }, [loadMonthlyRanking])
  useEffect(() => {
    let cancelled = false
    const previous = previousShift(date, shift)
    const setPreviousChange = (close) => {
      if (!cancelled) setPreviousChangeCash(close?.nextShiftChangeCash ?? 0)
    }
    if (previous.businessDate === date) {
      setPreviousChange(dashboard.closes.find((close) => close.shift === previous.shift))
      return () => { cancelled = true }
    }
    api(`/cigarettes?date=${previous.businessDate}`)
      .then((previousDashboard) => setPreviousChange(normalizeCigaretteDashboard(previousDashboard).closes.find((close) => close.shift === previous.shift)))
      .catch(() => {
        if (!cancelled) {
          setPreviousChangeCash(null)
          setMessage('No se pudo cargar el cambio dejado por el turno anterior.')
        }
      })
    return () => { cancelled = true }
  }, [api, dashboard.closes, date, shift, setMessage])

  return { dashboard, suppliers, cafeteriaSummary, cafeteriaError, previousChangeCash, monthlyRanking, loadingRanking, rankingError, load, loadMonthlyRanking }
}
