import { useCallback, useEffect, useState } from 'react'

export default function useQuickCoffeeSale(api, user, setMessage) {
  const [coffeeSummary, setCoffeeSummary] = useState({ saleCount: 0, totalSales: 0 })
  const [sellingCoffee, setSellingCoffee] = useState(false)
  const loadCoffeeSummary = useCallback((date) => api(`/cafeteria/dashboard${date ? `?date=${date}` : ''}`)
    .then((dashboard) => { setCoffeeSummary(dashboard.summary) }), [api])
  useEffect(() => { if (user) void loadCoffeeSummary().catch(() => {}) }, [user, loadCoffeeSummary])
  const registerCoffeeSale = async () => {
    if (sellingCoffee) return
    setSellingCoffee(true)
    setMessage('')
    try {
      const dashboard = await api('/cafeteria/sales', { method: 'POST' })
      setCoffeeSummary(dashboard.summary)
      setMessage('Venta de cafetería registrada.')
    } catch (error) {
      setMessage(error.message)
    } finally {
      setSellingCoffee(false)
    }
  }

  return { coffeeSummary, setCoffeeSummary, loadCoffeeSummary, sellingCoffee, registerCoffeeSale }
}
