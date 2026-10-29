import assert from 'node:assert/strict'
import test from 'node:test'
import { reprintWelcome } from './reprintWelcome.js'
import { welcomeMessageDefaults } from '../../../shared/utils/welcomeMessage.js'

function ticketWindow() {
  let markup = ''
  return {
    closed: false,
    get markup() { return markup },
    document: { open() {}, write(value) { markup = value }, close() {} },
  }
}

test('reprinting an open table uses current settings without reopening it or changing its session', async () => {
  const table = { id: 2, name: 'Mesa 2', status: 'occupied', customerName: 'Ana', openedAt: '2026-10-29T12:00:00Z', lastConsumptionAt: '2026-10-29T12:30:00Z', coworkingDisabled: true }
  const original = structuredClone(table)
  const settings = { ...welcomeMessageDefaults, amount: 4900, greetingText: 'Bienvenida {nombre}', businessName: 'Encabezado actualizado' }
  const requests = []
  const api = async (url, options) => {
    requests.push({ url, options })
    return settings
  }
  const printWindow = ticketWindow()
  assert.equal(await reprintWelcome(table, api, printWindow), true)
  assert.deepEqual(requests, [{ url: '/settings/welcome-message', options: { cache: 'no-store' } }])
  assert.ok(printWindow.markup.includes('Bienvenida Ana'))
  assert.ok(printWindow.markup.includes('Encabezado actualizado'))
  assert.ok(printWindow.markup.includes('$4.900'))
  assert.ok(printWindow.markup.includes('window.print()'))
  assert.deepEqual(table, original)
})

test('free tables and blocked print windows cannot request or print another welcome ticket', async () => {
  const api = () => assert.fail('No debe consultar ni modificar datos')
  const printWindow = ticketWindow()
  assert.equal(await reprintWelcome({ status: 'free' }, api, printWindow), false)
  assert.equal(await reprintWelcome({ status: 'occupied' }, api, null), false)
  assert.equal(await reprintWelcome({ status: 'occupied' }, api, { closed: true }), false)
  assert.equal(printWindow.markup, '')
})

test('unavailable settings leave the welcome receipt empty and report the failure', async () => {
  const printWindow = ticketWindow()
  await assert.rejects(reprintWelcome({ status: 'occupied' }, async () => { throw new Error('Sin conexión') }, printWindow), /Sin conexión/)
  assert.equal(printWindow.markup, '')
})
