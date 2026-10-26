export const shifts = { morning: 'Mañana', afternoon: 'Tarde' }
export const quickAmounts = [10000, 20000, 50000, 100000]

export function localDateValue(date = new Date()) {
  const offset = date.getTimezoneOffset() * 60000
  return new Date(date.getTime() - offset).toISOString().slice(0, 10)
}

export function formatTime(value) {
  return new Intl.DateTimeFormat('es-AR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
}
