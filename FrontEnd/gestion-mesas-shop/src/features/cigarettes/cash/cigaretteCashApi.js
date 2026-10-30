const amounts = ['sales', 'purchases', 'reservedCash', 'reservedMercadoPago', 'cashPurchases',
  'mercadoPagoPurchases', 'cashBalance', 'mercadoPagoBalance', 'balance']
const counts = ['missingPurchaseAmounts', 'missingReservations', 'closedShifts']
const isCount = (value) => Number.isSafeInteger(value) && value >= 0
const hasAmounts = (value) => value != null && amounts.every((field) => Number.isFinite(value[field]))
  && counts.every((field) => isCount(value[field]))
const isDay = (day) => day != null && /^\d{4}-\d{2}-\d{2}$/.test(day.businessDate)
  && hasAmounts(day.amounts) && Array.isArray(day.shifts) && day.shifts.length === 2
  && ['morning', 'afternoon'].every((shift) => day.shifts.some((item) => item?.shift === shift && hasAmounts(item.amounts)))

export function requireCigaretteCash(data) {
  if (!hasAmounts(data?.totals) || !isDay(data?.selectedDay) || !Array.isArray(data?.days)
    || !data.days.every(isDay) || !isCount(data?.totalDays) || !isCount(data?.page)
    || data.page < 1 || !isCount(data?.pageSize) || data.pageSize < 1) {
    throw new Error('No se recibieron los datos completos de la Caja de cigarrillos. Reiniciá el servidor con la versión actualizada y volvé a intentar.')
  }
  return data
}

export async function loadCigaretteCash(api, date, page, signal) {
  const data = await api(`/cigarettes/cash?date=${date}&page=${page}&pageSize=12`, { signal })
  return requireCigaretteCash(data)
}
