import { isCoworkingService } from '../../../shared/utils/products.js'

const normalize = (value) => value.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es-AR')

export function filterCatalogProducts(products, { search = '', filter = 'all', sort = 'recent' } = {}) {
  const query = normalize(search)
  return products.filter((item) => {
    const automatic = isCoworkingService(item)
    return (filter === 'all' || (filter === 'automatic' ? automatic : !automatic)) && normalize(item.name).includes(query)
  }).sort((first, second) => sort === 'name'
    ? first.name.localeCompare(second.name, 'es-AR', { sensitivity: 'base', numeric: true })
    : second.id - first.id)
}
