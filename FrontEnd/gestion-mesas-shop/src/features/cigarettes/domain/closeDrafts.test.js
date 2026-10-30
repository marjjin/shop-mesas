import assert from 'node:assert/strict'
import test from 'node:test'
import { clearCloseDraft, getCloseDraft, getCloseContext, saveCloseDraft, closeContextKey } from './closeDrafts.js'
import { previousShift, monthRange } from './businessDate.js'

test('saved drafts retain all form sections and isolate dates and shifts', (context) => {
  const values = new Map()
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  }
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage })
  context.after(() => previous ? Object.defineProperty(globalThis, 'localStorage', previous) : delete globalThis.localStorage)

  saveCloseDraft('2026-10-23', 'morning', { finalStocks: { 7: '12' } })
  saveCloseDraft('2026-10-23', 'morning', { endingBalances: { cash: '1000' }, supplierAllocations: { 1: { cashAmount: '500' } } })
  saveCloseDraft('2026-10-23', 'morning', { cigaretteReservation: { cash: '1200.50', mercadoPago: '800' } })
  saveCloseDraft('2026-10-23', 'afternoon', { finalStocks: { 7: '9' } })
  const restored = getCloseDraft('2026-10-23', 'morning')
  assert.deepEqual(restored.finalStocks, { 7: '12' })
  assert.deepEqual(restored.endingBalances, { cash: '1000' })
  assert.deepEqual(restored.supplierAllocations, { 1: { cashAmount: '500' } })
  assert.deepEqual(restored.cigaretteReservation, { cash: '1200.50', mercadoPago: '800' })
  assert.ok(Number.isFinite(Date.parse(restored.savedAt)))
  clearCloseDraft('2026-10-23', 'morning')
  assert.equal(getCloseDraft('2026-10-23', 'morning'), null)
  assert.deepEqual(getCloseDraft('2026-10-23', 'afternoon').finalStocks, { 7: '9' })
  assert.equal(getCloseDraft('2026-10-24', 'afternoon'), null)
  saveCloseDraft('2026-10-24', 'afternoon', { cigaretteReservation: { cash: '0', mercadoPago: '0' } })
  assert.deepEqual(getCloseDraft('2026-10-24', 'afternoon').cigaretteReservation, { cash: '0', mercadoPago: '0' })
  storage.setItem('mesa-cigarette-close-draft:2026-10-23:morning', '{invalid')
  assert.equal(getCloseDraft('2026-10-23', 'morning'), null)
})

test('the work context retains its existing storage key and rejects invalid saved shifts', (context) => {
  let stored = JSON.stringify({ date: '2026-10-23', shift: 'afternoon' })
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage')
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: { getItem: (key) => key === 'mesa-cigarette-close-context' ? stored : null } })
  context.after(() => previous ? Object.defineProperty(globalThis, 'sessionStorage', previous) : delete globalThis.sessionStorage)
  assert.equal(closeContextKey, 'mesa-cigarette-close-context')
  assert.deepEqual(getCloseContext(), { date: '2026-10-23', shift: 'afternoon' })
  stored = JSON.stringify({ date: '2026-10-23', shift: 'night' })
  assert.equal(getCloseContext(), null)
})

test('previous shift and monthly boundaries remain correct across years and leap days', () => {
  assert.deepEqual(previousShift('2026-01-01', 'morning'), { businessDate: '2025-12-31', shift: 'afternoon' })
  assert.deepEqual(previousShift('2026-01-01', 'afternoon'), { businessDate: '2026-01-01', shift: 'morning' })
  assert.deepEqual(monthRange('2024-02-12'), { from: '2024-02-01', to: '2024-02-29' })
})
