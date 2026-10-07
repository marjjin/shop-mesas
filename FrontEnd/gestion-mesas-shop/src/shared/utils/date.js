const utcDate = (value) => /(?:Z|[+-]\d{2}:\d{2})$/.test(value) ? value : `${value}Z`

export function clock(date, now = Date.now()) {
  if (!date) return '00:00:00'
  const seconds = Math.max(0, Math.floor((now - new Date(utcDate(date)).getTime()) / 1000))
  return [seconds / 3600, (seconds % 3600) / 60, seconds % 60]
    .map((number) => String(Math.floor(number)).padStart(2, '0')).join(':')
}

export function time(date) {
  if (!date) return '--:--'
  return new Intl.DateTimeFormat('es-AR', { hour: '2-digit', minute: '2-digit' }).format(new Date(utcDate(date)))
}

export function datetimeLocal(date) {
  if (!date) return ''
  const value = new Date(typeof date === 'number' ? date : utcDate(date))
  return new Date(value.getTime() - value.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}
