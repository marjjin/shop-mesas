import assert from 'node:assert/strict'
import test from 'node:test'
import { filterStockProducts, inventoryRetailValue, stockStatus } from './inventoryView.js'

const products = [
  { id: 1, name: 'Clásico Box', price: 2000.25, stock: 6 },
  { id: 2, name: 'Mentolado', price: 3000, stock: 5 },
  { id: 3, name: 'Clásico KS', price: 2500, stock: 0 },
  { id: 4, name: 'Común', price: 1800.1, stock: 1 },
]

test('inventory status distinguishes exhausted, low and normal stock at the exact boundaries', () => {
  assert.equal(stockStatus(-1), 'out')
  assert.equal(stockStatus(0), 'out')
  assert.equal(stockStatus(1), 'low')
  assert.equal(stockStatus(5), 'low')
  assert.equal(stockStatus(6), 'available')
})

test('inventory search combines accents, case and stock filters without dropping exhausted matches', () => {
  assert.deepEqual(filterStockProducts(products, { search: '  CLASICO  ' }).map((item) => item.id), [1, 3])
  assert.deepEqual(filterStockProducts(products, { search: 'clasico', status: 'out' }).map((item) => item.id), [3])
  assert.deepEqual(filterStockProducts(products, { status: 'low' }).map((item) => item.id), [4, 2])
  assert.deepEqual(filterStockProducts(products, { status: 'available' }).map((item) => item.id), [1])
  assert.deepEqual(filterStockProducts(products, { search: 'otra marca' }), [])
})

test('stock and price sorting preserve the source products and their quantities', () => {
  const original = structuredClone(products)
  assert.deepEqual(filterStockProducts(products, { sort: 'stock' }).map((item) => item.id), [3, 4, 2, 1])
  assert.deepEqual(filterStockProducts(products, { sort: 'price' }).map((item) => item.id), [2, 3, 1, 4])
  assert.deepEqual(products, original)
})

test('inventory valuation multiplies each current stock by its unit price and preserves cents', () => {
  assert.equal(inventoryRetailValue([]), 0)
  assert.equal(inventoryRetailValue(products), 28801.6)
  assert.equal(inventoryRetailValue([{ price: 0.1, stock: 3 }, { price: 0.2, stock: 1 }]), 0.5)
})
