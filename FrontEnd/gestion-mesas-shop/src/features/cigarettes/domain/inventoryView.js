// Estado del stock: 0 agotado, hasta 5 bajo.
export function stockStatus(stock) {
  return stock <= 0 ? 'out' : stock <= 5 ? 'low' : 'available'
}

const normalize = (value) => value.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es-AR')

// Filtra y ordena el inventario.
export function filterStockProducts(products, { search = '', status = 'all', sort = 'name' } = {}) {
  const query = normalize(search)
  return products.filter((item) => normalize(item.name).includes(query) && (status === 'all' || stockStatus(item.stock) === status))
    .sort((left, right) => {
      const byName = left.name.localeCompare(right.name, 'es-AR', { sensitivity: 'base', numeric: true })
      if (sort === 'stock') return left.stock - right.stock || byName
      if (sort === 'price') return right.price - left.price || byName
      return byName
    })
}

// Calcula en centavos enteros para no acumular errores de redondeo.
export function inventoryRetailValue(products) {
  return products.reduce((total, item) => total + Math.round(item.price * 100) * item.stock, 0) / 100
}
