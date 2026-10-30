import assert from 'node:assert/strict'
import test from 'node:test'
import { createApiClient } from '../../../shared/api/createApiClient.js'
import { requireCigaretteCash, loadCigaretteCash } from './cigaretteCashApi.js'

const amounts = { sales: 100, purchases: 25.50, reservedCash: 30, reservedMercadoPago: 50,
  cashPurchases: 10, mercadoPagoPurchases: 15.50, cashBalance: 20, mercadoPagoBalance: 34.50,
  balance: 54.50, missingPurchaseAmounts: 0, missingReservations: 0, closedShifts: 1 }
const day = { businessDate: '2026-10-30', amounts, shifts: ['morning', 'afternoon'].map((shift) => ({ shift, amounts })) }
const response = { totals: amounts, selectedDay: day, days: [day], totalDays: 1, page: 1, pageSize: 12 }

test('a complete cash response preserves money, negative balances, missing amounts and empty history', () => {
  assert.equal(requireCigaretteCash(response), response)
  const empty = { ...response, totals: { ...amounts, balance: -10, missingPurchaseAmounts: 1 }, days: [], totalDays: 0 }
  assert.equal(requireCigaretteCash(empty), empty)
})

test('old or incomplete HTTP 200 responses are rejected before the cash screen reads totals', async () => {
  const legacy = { totalSales: 100, totalPurchases: 25, balance: 75, missingPurchaseAmounts: 0,
    selectedDay: { businessDate: '2026-10-30', sales: 100, purchases: 25, balance: 75, shifts: [] }, days: [] }
  for (const body of [legacy, null, {}, { ...response, totals: null }, { ...response, selectedDay: {} },
    { ...response, days: [legacy.selectedDay] }]) {
    const api = createApiClient('http://localhost:5000/api', async () => Response.json(body))
    await assert.rejects(loadCigaretteCash(api, '2026-10-30', 1), /Reiniciá el servidor/)
  }
})

test('missing numeric fields and duplicate or incomplete shifts cannot silently appear as zero balances', () => {
  for (const body of [
    { ...response, totals: { ...amounts, balance: undefined } },
    { ...response, totals: { ...amounts, reservedCash: '30' } },
    { ...response, totals: { ...amounts, missingPurchaseAmounts: -1 } },
    { ...response, selectedDay: { ...day, shifts: [{ shift: 'morning', amounts }, { shift: 'morning', amounts }] } },
    { ...response, pageSize: 0 },
  ]) assert.throws(() => requireCigaretteCash(body), /datos completos/)
})

test('cash requests retain authentication, cancellation, date and pagination', async () => {
  const controller = new AbortController()
  const api = createApiClient('http://localhost:5000/api', async (url, options) => {
    assert.equal(url, 'http://localhost:5000/api/cigarettes/cash?date=2026-10-30&page=2&pageSize=12')
    assert.equal(options.headers.get('Authorization'), 'Bearer test-token')
    assert.equal(options.signal, controller.signal)
    return Response.json(response)
  }, { getToken: () => 'test-token' })
  assert.deepEqual(await loadCigaretteCash(api, '2026-10-30', 2, controller.signal), response)
})

test('session expiration and network errors keep their existing handling', async () => {
  let expired = false
  const api = createApiClient('http://localhost:5000/api', async () => new Response(null, { status: 401 }),
    { onUnauthorized: () => { expired = true } })
  await assert.rejects(loadCigaretteCash(api, '2026-10-30', 1), /sesión venció/)
  assert.equal(expired, true)
  const failure = new Error('Sin conexión')
  await assert.rejects(loadCigaretteCash(async () => { throw failure }, '2026-10-30', 1), (error) => error === failure)
})
