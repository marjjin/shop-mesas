export const shifts = { morning: 'Mañana', afternoon: 'Tarde' }

export function localDateValue(date = new Date()) {
  const offset = date.getTimezoneOffset() * 60000
  return new Date(date.getTime() - offset).toISOString().slice(0, 10)
}

export function previousDateValue(date) {
  const value = new Date(`${date}T12:00:00`)
  value.setDate(value.getDate() - 1)
  return localDateValue(value)
}

export function previousShift(date, shift) {
  return shift === 'afternoon'
    ? { businessDate: date, shift: 'morning' }
    : { businessDate: previousDateValue(date), shift: 'afternoon' }
}

export function monthRange(date) {
  const [year, month] = date.split('-').map(Number)
  const lastDay = new Date(year, month, 0).getDate()
  return { from: `${year}-${String(month).padStart(2, '0')}-01`, to: `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}` }
}
