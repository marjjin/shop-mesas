import assert from 'node:assert/strict'
import test from 'node:test'
import { dateInputValue, moveHistoryDate, saleConfigurationTotal } from './cafeteriaView.js'

test('one cafeteria sale includes one unit of every active article and preserves cents', () => {
  assert.equal(saleConfigurationTotal([]), 0)
  assert.equal(saleConfigurationTotal([{ price: 1200.5 }, { price: 0.1 }, { price: 0.2 }]), 1200.8)
  assert.equal(saleConfigurationTotal([{ price: 1500 }, { price: '750.25' }]), 2250.25)
})

test('cafeteria date controls use the local calendar date even near midnight', () => {
  assert.equal(dateInputValue(new Date(2026, 9, 29, 23, 50)), '2026-10-29')
  assert.equal(dateInputValue(new Date(2026, 0, 1, 0, 10)), '2026-01-01')
})

test('history navigation crosses month, year and leap day boundaries correctly', () => {
  assert.equal(moveHistoryDate('2026-01-01', -1), '2025-12-31')
  assert.equal(moveHistoryDate('2026-12-31', 1), '2027-01-01')
  assert.equal(moveHistoryDate('2024-03-01', -1), '2024-02-29')
  assert.equal(moveHistoryDate('2026-03-01', -1), '2026-02-28')
})
