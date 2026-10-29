import assert from 'node:assert/strict'
import test from 'node:test'
import { filterSalonTables, fitFloorToWidth, getFloorBounds, getSalonSummary } from './salonPresentation.js'

const tables = [
  { id: 1, name: 'Mesa 1', status: 'free', customerName: null, x: 40, y: 60, width: 138, height: 96 },
  { id: 2, name: 'Terraza', status: 'occupied', customerName: 'José Pérez', x: 960, y: 620, width: 160, height: 120 },
  { id: 3, name: 'Mesa 3', status: 'free', customerName: null, x: 300, y: 60, width: 138, height: 96 },
]

test('salon summary reports occupancy and handles an empty room without a percentage error', () => {
  assert.deepEqual(getSalonSummary(tables), { total: 3, occupied: 1, free: 2, occupancy: 33 })
  assert.deepEqual(getSalonSummary([]), { total: 0, occupied: 0, free: 0, occupancy: 0 })
  assert.equal(getSalonSummary(tables.map((table) => ({ ...table, status: 'occupied' }))).occupancy, 100)
})

test('salon search finds tables and customers regardless of accents or case, combined with table status', () => {
  assert.deepEqual(filterSalonTables(tables, { search: '  JOSE PEREZ  ' }).map((table) => table.id), [2])
  assert.deepEqual(filterSalonTables(tables, { search: 'terraza', status: 'occupied' }).map((table) => table.id), [2])
  assert.deepEqual(filterSalonTables(tables, { search: 'jose', status: 'free' }), [])
  assert.deepEqual(filterSalonTables(tables, { status: 'free' }).map((table) => table.id), [1, 3])
})

test('floor bounds contain distant tables and filtering never changes persisted table geometry', () => {
  const original = structuredClone(tables)
  assert.deepEqual(getFloorBounds(tables), { width: 1180, height: 800 })
  assert.deepEqual(getFloorBounds([]), { width: 760, height: 560 })
  filterSalonTables(tables, { search: 'Mesa' })
  fitFloorToWidth(680, getFloorBounds(tables).width)
  assert.deepEqual(tables, original)
})

test('fit-to-width leaves space around the plan, avoids enlargement and keeps zoom usable on narrow screens', () => {
  assert.equal(fitFloorToWidth(808, 760), 1)
  assert.equal(fitFloorToWidth(448, 800), .5)
  assert.equal(fitFloorToWidth(1800, 800), 1)
  assert.equal(fitFloorToWidth(200, 2000), .25)
  assert.equal(fitFloorToWidth(0, 800), 1)
})
