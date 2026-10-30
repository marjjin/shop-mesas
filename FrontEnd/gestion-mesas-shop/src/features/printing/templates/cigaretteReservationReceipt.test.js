import assert from 'node:assert/strict'
import test from 'node:test'
import { cigaretteShiftReceiptMarkup } from './shiftReceipt.js'
import { cigaretteDailyReceiptMarkup } from './dailyReceipt.js'
import { preciseMoney } from '../../../shared/utils/currency.js'

const close = { businessDate: '2026-10-30', shift: 'morning', closedAt: '2026-10-30T15:00:00Z', totalSales: 400,
  totalSold: 4, items: [], cigaretteReservedCash: 150.25, cigaretteReservedMercadoPago: 125.50 }

test('shift and daily receipts show each cigarette reservation with cents and preserve general cash calculations', () => {
  const snapshot = structuredClone(close)
  for (const markup of [cigaretteShiftReceiptMarkup(close, []), cigaretteDailyReceiptMarkup([close], [], close.businessDate)]) {
    assert.ok(markup.includes('RESERVA DE CIGARRILLOS'))
    assert.ok(markup.includes('Efectivo reservado'))
    assert.ok(markup.includes('Mercado Pago reservado'))
    assert.ok(markup.includes(preciseMoney.format(150.25)))
    assert.ok(markup.includes(preciseMoney.format(125.50)))
    assert.ok(markup.includes(preciseMoney.format(275.75)))
    assert.ok(markup.includes('window.print()'))
  }
  assert.deepEqual(close, snapshot)
})

test('legacy receipts distinguish unknown reservations from explicitly recorded zero', () => {
  const legacy = cigaretteShiftReceiptMarkup({ ...close, cigaretteReservedCash: null, cigaretteReservedMercadoPago: null }, [])
  assert.ok(legacy.includes('Sin registrar'))
  assert.ok(legacy.includes('Incompleto'))
  const zero = cigaretteShiftReceiptMarkup({ ...close, cigaretteReservedCash: 0, cigaretteReservedMercadoPago: 0 }, [])
  assert.ok(!zero.includes('Sin registrar'))
  assert.ok(!zero.includes('Incompleto'))
})
