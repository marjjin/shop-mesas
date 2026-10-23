import assert from 'node:assert/strict'
import test from 'node:test'
import { printWelcomeReceipt } from './receipt.js'
import { welcomeMessageDefaults, requireWelcomeMessageSettings } from './shared/utils/welcomeMessage.js'

function ticketWindow() {
  let markup = ''
  return {
    get markup() { return markup },
    closed: false,
    document: {
      open() {},
      write(value) { markup = value },
      close() {},
    },
  }
}

test('welcome ticket uses the supplied amount, including zero and cents', () => {
  for (const [amount, formatted] of [[3500, '$3.500'], [0, '$0'], [4520.75, '$4.520,75']]) {
    const printWindow = ticketWindow()
    assert.equal(printWelcomeReceipt({ customerName: 'Cliente' }, printWindow, { ...welcomeMessageDefaults, amount }), true)
    assert.ok(printWindow.markup.includes(`Costo mínimo de consumo: ${formatted}</p>`))
    assert.ok(!printWindow.markup.includes('$3000'))
    assert.ok(!printWindow.markup.includes('$3.000'))
  }
})

test('missing or invalid amounts cannot silently print a default price', () => {
  for (const amount of [undefined, null, NaN, Infinity, -1, '3500']) {
    const printWindow = ticketWindow()
    assert.throws(() => printWelcomeReceipt({ customerName: 'Cliente' }, printWindow, { ...welcomeMessageDefaults, amount }), /importe/)
    assert.equal(printWindow.markup, '')
  }
})

test('all configured texts reach the printed welcome ticket safely', () => {
  const printWindow = ticketWindow()
  const settings = {
    amount: 4100,
    businessName: 'Café & Familias',
    greetingText: '¡Hola {nombre}!\nGracias, {nombre}.',
    messageText: '<script>alert("hola")</script>',
    conditionsText: 'Podés quedarte 90 minutos.\n\nConsultá para renovar.',
    minimumLabel: 'Tu consumo mínimo',
    footerText: '¡Volvé pronto!\nEquipo del café',
  }
  printWelcomeReceipt({ customerName: '$& <Ana>' }, printWindow, settings)
  assert.ok(printWindow.markup.includes('Café &amp; Familias'))
  assert.ok(printWindow.markup.includes('¡Hola $&amp; &lt;Ana&gt;!\nGracias, $&amp; &lt;Ana&gt;.'))
  assert.ok(printWindow.markup.includes('&lt;script&gt;alert(&quot;hola&quot;)&lt;/script&gt;'))
  assert.ok(!printWindow.markup.includes('<script>alert('))
  assert.ok(printWindow.markup.includes(settings.conditionsText))
  assert.ok(printWindow.markup.includes('Tu consumo mínimo: $4.100'))
  assert.ok(printWindow.markup.includes(settings.footerText))
})

test('optional empty text blocks are omitted from the ticket', () => {
  const printWindow = ticketWindow()
  printWelcomeReceipt({ customerName: 'Ana' }, printWindow, { ...welcomeMessageDefaults, amount: 3500, messageText: '', conditionsText: '', footerText: '' })
  assert.ok(!printWindow.markup.includes('Ya registramos tu pedido.'))
  assert.ok(!printWindow.markup.includes('<div class="conditions">'))
  assert.ok(!printWindow.markup.includes('<footer'))
})

test('an old API response cannot silently discard text edits', () => {
  assert.throws(() => requireWelcomeMessageSettings({ amount: 3500 }), /actualizarse/)
  const settings = { ...welcomeMessageDefaults, amount: 3500 }
  assert.equal(requireWelcomeMessageSettings(settings), settings)
})
