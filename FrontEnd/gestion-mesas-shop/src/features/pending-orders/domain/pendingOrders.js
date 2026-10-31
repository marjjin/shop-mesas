// Filtros de pedidos y artículos pendientes.
import { isCoworkingService } from '../../../shared/utils/products.js'

const normalize = (value) => value.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es-AR')

// Busca por nombre o por número, con o sin #.
export function filterPendingOrders(orders, search) {
  const query = normalize(search).replace(/^#/, '')
  return orders.filter((order) => normalize(order.customerName).includes(query) || String(order.id) === query)
}

// Excluye los servicios automáticos.
export function findPendingProducts(products, search) {
  const query = normalize(search)
  return products.filter((product) => !isCoworkingService(product) && normalize(product.name).includes(query))
}
