// Suma en centavos enteros: evita errores de redondeo de los decimales de JavaScript.
export function saleConfigurationTotal(products) {
  return products.reduce((cents, product) => cents + Math.round(Number(product.price) * 100), 0) / 100
}

export function dateInputValue(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

// Usar mediodía evita que un cambio de horario salte de día.
export function moveHistoryDate(value, days) {
  const date = new Date(`${value}T12:00:00`)
  date.setDate(date.getDate() + days)
  return dateInputValue(date)
}
