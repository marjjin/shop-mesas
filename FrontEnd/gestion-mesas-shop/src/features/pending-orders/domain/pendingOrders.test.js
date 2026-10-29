import assert from 'node:assert/strict'
import test from 'node:test'
import { parseProductSearch } from '../../../shared/utils/productSearch.js'
import { filterPendingOrders, findPendingProducts } from './pendingOrders.js'

test('pending orders can be found by customer name without accents or by their exact number', () => {
  const orders = [{ id: 12, customerName: 'Martín' }, { id: 120, customerName: 'María' }]
  assert.deepEqual(filterPendingOrders(orders, '  MARTIN  '), [orders[0]])
  assert.deepEqual(filterPendingOrders(orders, '#12'), [orders[0]])
  assert.deepEqual(filterPendingOrders(orders, '12'), [orders[0]])
  assert.deepEqual(filterPendingOrders(orders, 'otro cliente'), [])
  assert.deepEqual(filterPendingOrders(orders, ''), orders)
})

test('pending article search ignores accents while excluding automatic coworking services', () => {
  const products = [{ id: 1, name: 'Café grande' }, { id: 2, name: 'Servicio Coworking 30 minutos' }, { id: 3, name: 'Medialuna' }]
  assert.deepEqual(findPendingProducts(products, ' CAFE '), [products[0]])
  assert.deepEqual(findPendingProducts(products, ''), [products[0], products[2]])
  assert.deepEqual(findPendingProducts(products, 'coworking'), [])
})

test('quantity shortcuts preserve the quantity and find the matching article', () => {
  const products = [{ id: 1, name: 'Café grande' }, { id: 2, name: 'Medialuna' }]
  const { quantity, query } = parseProductSearch('3* cafe')
  assert.equal(quantity, 3)
  assert.deepEqual(findPendingProducts(products, query), [products[0]])
})
