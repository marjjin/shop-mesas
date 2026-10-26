export const money = new Intl.NumberFormat('es-AR', {
  style: 'currency', currency: 'ARS', maximumFractionDigits: 0,
})

export const preciseMoney = new Intl.NumberFormat('es-AR', {
  style: 'currency', currency: 'ARS', minimumFractionDigits: 0, maximumFractionDigits: 2,
})
