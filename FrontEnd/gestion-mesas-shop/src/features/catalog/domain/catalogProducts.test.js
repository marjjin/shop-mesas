import assert from 'node:assert/strict'
import test from 'node:test'
import { filterCatalogProducts } from './catalogProducts.js'

const products = [
  { id: 1, name: 'Servicio Coworking 30 minutos' },
  { id: 2, name: 'Servicio Coworking 1 hora' },
  { id: 3, name: 'Café con leche' },
  { id: 4, name: 'Medialuna' },
  { id: 5, name: 'CAFÉ grande' },
]

test('catalog search finds names regardless of accents, case and surrounding spaces', () => {
  assert.deepEqual(filterCatalogProducts(products, { search: '  CAFE  ' }).map((item) => item.id), [5, 3])
  assert.deepEqual(filterCatalogProducts(products, { search: 'no existe' }), [])
})

test('catalog type filters separate articles from protected automatic services and combine with search', () => {
  assert.deepEqual(filterCatalogProducts(products, { filter: 'automatic' }).map((item) => item.id), [2, 1])
  assert.deepEqual(filterCatalogProducts(products, { filter: 'articles' }).map((item) => item.id), [5, 4, 3])
  assert.deepEqual(filterCatalogProducts(products, { filter: 'articles', search: 'coworking' }), [])
  assert.deepEqual(filterCatalogProducts(products, { filter: 'automatic', search: '30' }).map((item) => item.id), [1])
})

test('catalog ordering puts new articles first or sorts by Spanish names without changing source data', () => {
  const original = products.map((item) => item.id)
  assert.equal(filterCatalogProducts(products)[0].id, 5)
  assert.deepEqual(filterCatalogProducts(products, { filter: 'articles', sort: 'name' }).map((item) => item.name), ['Café con leche', 'CAFÉ grande', 'Medialuna'])
  assert.deepEqual(products.map((item) => item.id), original)
})
