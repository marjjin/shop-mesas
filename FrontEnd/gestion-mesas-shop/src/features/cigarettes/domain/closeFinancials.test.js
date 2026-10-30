import assert from 'node:assert/strict'
import test from 'node:test'
import { getCloseFinancialSummary, getDraftFinancialSummary } from './closeFinancials.js'

const suppliers = [{ id: 1, isSeparateCashBox: false }, { id: 2, isSeparateCashBox: true }]
const close = {
  endingCashBalance: 10000,
  endingMercadoPagoBalance: 5000,
  posnetTotal: 2000,
  nextShiftChangeCash: 1000,
  receivedChangeCash: 500,
  cashDrops: [{ amount: 3000 }, { amount: 1000 }],
  totalSales: 4000,
  cafeteria: { totalSales: 1500 },
  supplierAllocations: [{ supplierId: 1, amount: 2000 }, { supplierId: 2, amount: 3000 }],
}

test('closed cash totals include withdrawals once and distinguish separate supplier cash boxes', () => {
  assert.deepEqual(getCloseFinancialSummary(close, suppliers), {
    archaeologicalResult: 21500,
    cashDropsTotal: 4000,
    cashInBox: 14000,
    normalSupplierReservations: 2000,
    separateCashBoxReservations: 3000,
    cashTotal: 14000,
    shiftSales: 24500,
  })
})

test('a recorded withdrawal total overrides its detail, including an explicit zero', () => {
  const saved = getCloseFinancialSummary({ ...close, cashDropsTotal: 0 }, suppliers)
  assert.equal(saved.cashDropsTotal, 0)
  assert.equal(saved.archaeologicalResult, 17500)
  assert.equal(saved.cashTotal, 10000)
  assert.equal(saved.shiftSales, 20500)
})

test('editing an equivalent close preserves the same cash and sales results', () => {
  const draft = getDraftFinancialSummary({
    endingBalances: { cash: '10000', mercadoPago: '5000', posnet: '2000', receivedChange: '500', change: '1000' },
    cashDrops: close.cashDrops,
    suppliers,
    allocations: { 1: { cashAmount: '1200', mercadoPagoAmount: '800' }, 2: { cashAmount: '3000', mercadoPagoAmount: '' } },
    cafeteriaTotal: 1500,
    totalSales: 4000,
  })
  assert.equal(draft.archaeologicalResult, 21500)
  assert.equal(draft.cashTotal, 14000)
  assert.equal(draft.dailySalesTotal, 24500)
  assert.equal(draft.separateCashBoxTotal, 3000)
})

test('an empty draft treats blank amounts as zero and keeps a cash deficit visible', () => {
  const draft = getDraftFinancialSummary({
    endingBalances: { cash: '', mercadoPago: '', posnet: '', receivedChange: '', change: '' },
    cashDrops: [], suppliers: [], allocations: {}, cafeteriaTotal: 50, totalSales: 100,
  })
  assert.equal(draft.archaeologicalResult, 0)
  assert.equal(draft.cashTotal, -150)
  assert.equal(draft.dailySalesTotal, 0)
})

test('legacy close records without optional balances still calculate their cash result', () => {
  assert.equal(getCloseFinancialSummary({ totalSales: 300 }, []).cashTotal, -300)
})

test('cigarette reservations do not deduct the same cigarette sales twice from general cash', () => {
  const reserved = { ...close, cigaretteReservedCash: 1500.25, cigaretteReservedMercadoPago: 2500.50 }
  assert.deepEqual(getCloseFinancialSummary(reserved, suppliers), getCloseFinancialSummary(close, suppliers))
})
