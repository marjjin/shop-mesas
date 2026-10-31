// Formateadores de dinero en pesos argentinos. money no muestra decimales.
export const money = new Intl.NumberFormat('es-AR', {
  style: 'currency', currency: 'ARS', maximumFractionDigits: 0,
})

// preciseMoney muestra hasta 2 decimales.
export const preciseMoney = new Intl.NumberFormat('es-AR', {
  style: 'currency', currency: 'ARS', minimumFractionDigits: 0, maximumFractionDigits: 2,
})
