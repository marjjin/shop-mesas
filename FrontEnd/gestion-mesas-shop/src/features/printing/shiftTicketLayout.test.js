import assert from 'node:assert/strict'
import test from 'node:test'
import { addCustomBlock, createDefaultShiftTicketLayout, moveBlock, moveRow, normalizeShiftTicketLayout, removeBlock, toShiftTicketRequest, updateBlock, updateRow, validateShiftTicketLayout } from './shiftTicketLayout.js'
import { cigaretteShiftReceiptMarkup } from './templates/shiftReceipt.js'
import { printShiftTicket } from './receipt.js'
import { sampleClose, sampleSuppliers } from '../settings/domain/shiftTicketSample.js'
import { money } from '../../shared/utils/currency.js'

const render = (layout) => cigaretteShiftReceiptMarkup(sampleClose, sampleSuppliers, layout)

test('the factory design prints every section in its original order with the same amounts', () => {
  const markup = render(createDefaultShiftTicketLayout())
  const order = ['SHOP FAMILY', 'Fecha:', 'DETALLE DE VENTAS', 'VENTAS CIGARRILLOS', 'RESERVA DE CIGARRILLOS', 'CAJA CAFETERÍA', 'PROVEEDORES', 'TIRADAS DE EFECTIVO', 'ARQUEO Y RESULTADOS', 'COMPROBANTE DE CIERRE']
  const positions = order.map((text) => markup.indexOf(text))
  assert.ok(positions.every((position) => position >= 0))
  assert.deepEqual(positions, [...positions].sort((a, b) => a - b))
  assert.ok(markup.includes('padding: 8mm 6mm 8mm 6mm'))
  // Arqueo 115.000; caja = 115.000 - 20.000 - 24.000 - 8.000; ventas = 115.000 + 5.000.
  for (const amount of [115000, 63000, 120000]) assert.ok(markup.includes(money.format(amount)))
  assert.ok(markup.includes('window.print()'))
})

test('blocks and rows follow the edited order', () => {
  let layout = moveBlock(createDefaultShiftTicketLayout(), 'cashSummary', -1)
  layout = moveRow(layout, 'cashSummary', 'posnet', -1)
  const markup = render(layout)
  assert.ok(markup.indexOf('ARQUEO Y RESULTADOS') < markup.indexOf('TIRADAS DE EFECTIVO'))
  assert.ok(markup.indexOf('Total Posnet') < markup.indexOf('Mercado Pago final'))
})

test('moves past the edges keep the design unchanged', () => {
  const layout = createDefaultShiftTicketLayout()
  assert.deepEqual(moveBlock(layout, 'header', -1).blocks.map(({ id }) => id), layout.blocks.map(({ id }) => id))
  assert.deepEqual(moveBlock(layout, 'unknown', 1).blocks.map(({ id }) => id), layout.blocks.map(({ id }) => id))
})

test('hidden blocks and rows disappear without changing the calculated results', () => {
  let layout = updateBlock(createDefaultShiftTicketLayout(), 'suppliers', { visible: false })
  layout = updateRow(layout, 'cashSummary', 'posnet', { visible: false })
  const markup = render(layout)
  assert.ok(!markup.includes('PROVEEDORES'))
  assert.ok(!markup.includes('Proveedor de ejemplo'))
  assert.ok(!markup.includes('Total Posnet'))
  assert.ok(markup.includes(money.format(115000)))
})

test('edited labels and custom blocks are printed as plain text', () => {
  let layout = updateRow(createDefaultShiftTicketLayout(), 'cashSummary', 'cash', { label: 'Plata <b>' })
  layout = addCustomBlock(layout, 'text', 'custom-a')
  layout = updateBlock(layout, 'custom-a', { title: 'Aviso', text: '<script>alert(1)</script>\nSegunda línea' })
  layout = addCustomBlock(layout, 'signature', 'custom-b')
  layout = updateBlock(layout, 'custom-b', { title: 'Firma del encargado' })
  const markup = render(layout)
  assert.ok(markup.includes('Plata &lt;b&gt;'))
  assert.ok(markup.includes('&lt;script&gt;alert(1)&lt;/script&gt;\nSegunda línea'))
  assert.ok(!markup.includes('<script>alert(1)'))
  assert.ok(markup.indexOf('Firma del encargado') < markup.indexOf('COMPROBANTE DE CIERRE'))
  assert.ok(!render(removeBlock(layout, 'custom-b')).includes('Firma del encargado'))
})

test('margins reach the ticket and the preview never prints', () => {
  const layout = { ...createDefaultShiftTicketLayout(), margins: { top: 1, right: 2.5, bottom: 3, left: 4 } }
  const markup = cigaretteShiftReceiptMarkup(sampleClose, sampleSuppliers, layout, { autoPrint: false })
  assert.ok(markup.includes('padding: 1mm 2.5mm 3mm 4mm'))
  assert.ok(!markup.includes('window.print()'))
})

test('a saved design keeps its choices and receives what the system added later', () => {
  const saved = toShiftTicketRequest(moveBlock(createDefaultShiftTicketLayout(), 'footer', -1))
  saved.blocks = saved.blocks.filter(({ id }) => id !== 'cashDrops')
  saved.blocks.find(({ id }) => id === 'cashSummary').rows = [{ id: 'caja', visible: false, label: 'Resultado' }]
  saved.blocks.push({ id: 'removed-from-system', type: 'section', visible: true, title: 'x', text: '', rows: [] })
  saved.blocks.push({ id: 'custom-a', type: 'text', visible: true, title: null, text: 'Nota', rows: null })

  const layout = normalizeShiftTicketLayout(saved)
  const ids = layout.blocks.map(({ id }) => id)
  assert.ok(ids.indexOf('footer') < ids.indexOf('cashSummary'))
  assert.ok(ids.includes('cashDrops'))
  assert.ok(!ids.includes('removed-from-system'))
  assert.equal(layout.blocks.find(({ id }) => id === 'custom-a').text, 'Nota')
  const rows = layout.blocks.find(({ id }) => id === 'cashSummary').rows
  assert.deepEqual(rows[0], { id: 'caja', visible: false, label: 'Resultado' })
  assert.equal(rows.length, createDefaultShiftTicketLayout().blocks.find(({ id }) => id === 'cashSummary').rows.length)
})

test('without a saved design the factory one is used', () => {
  assert.deepEqual(normalizeShiftTicketLayout(null), createDefaultShiftTicketLayout())
})

test('the request removes editor data and converts margins to numbers', () => {
  const layout = { ...createDefaultShiftTicketLayout(), margins: { top: '1.5', right: '2', bottom: '3', left: '4' } }
  const request = toShiftTicketRequest(layout)
  assert.deepEqual(request.margins, { top: 1.5, right: 2, bottom: 3, left: 4 })
  assert.ok(request.blocks.every((block) => !('name' in block)))
})

test('validation matches the limits of the API', () => {
  const layout = createDefaultShiftTicketLayout()
  assert.equal(validateShiftTicketLayout(layout), '')
  for (const margins of [{ ...layout.margins, top: '' }, { ...layout.margins, top: -1 }, { ...layout.margins, top: 21 }, { ...layout.margins, top: 1.25 }, { ...layout.margins, left: 20, right: 20.5 }])
    assert.notEqual(validateShiftTicketLayout({ ...layout, margins }), '')
  assert.notEqual(validateShiftTicketLayout(updateBlock(layout, 'sales', { title: 'x'.repeat(101) })), '')
  assert.notEqual(validateShiftTicketLayout(updateRow(layout, 'meta', 'date', { label: 'x'.repeat(101) })), '')
})

test('printing reads the saved design and reports a blocked window without calling the API', async () => {
  let markup = ''
  const printWindow = { closed: false, document: { open() {}, write(value) { markup = value }, close() {} } }
  const saved = toShiftTicketRequest(updateBlock(createDefaultShiftTicketLayout(), 'suppliers', { visible: false }))
  const calls = []
  const api = async (path) => { calls.push(path); return { layout: saved } }
  assert.equal(await printShiftTicket(sampleClose, sampleSuppliers, api, printWindow), true)
  assert.deepEqual(calls, ['/settings/shift-ticket'])
  assert.ok(!markup.includes('PROVEEDORES'))
  assert.equal(await printShiftTicket(sampleClose, sampleSuppliers, api, null), false)
  assert.equal(calls.length, 1)
})
