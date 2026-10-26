import assert from 'node:assert/strict'
import test from 'node:test'
import { sumPaymentAmounts, transactionFormValues } from './transactions.js'

test('splitting a purchase keeps cent precision and preserves an empty form', () => {
  assert.equal(sumPaymentAmounts('0.1', '0.2'), '0.3')
  assert.equal(sumPaymentAmounts('1000.25', '49.75'), '1050')
  assert.equal(sumPaymentAmounts('', ''), '')
  assert.equal(sumPaymentAmounts('0', ''), '0')
})

test('editing payments restores positive form amounts while adjustments retain their signs', () => {
  const transaction = { type: 'payment', amount: 150, cashAmount: -100, mercadoPagoAmount: -50 }
  assert.deepEqual(transactionFormValues(transaction), { amount: '150', cashAmount: '100', mercadoPagoAmount: '50', note: '' })
  assert.deepEqual(transactionFormValues({ ...transaction, type: 'reserved_adjustment', note: 'Corrección' }), { amount: '150', cashAmount: '-100', mercadoPagoAmount: '-50', note: 'Corrección' })
})
