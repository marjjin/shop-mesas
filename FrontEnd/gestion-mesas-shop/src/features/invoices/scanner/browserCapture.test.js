import assert from 'node:assert/strict'
import test from 'node:test'
import { canUseInlineCamera, createScanPageId } from './browserCapture.js'

test('a local HTTP address uses native capture even when a mediaDevices object exists', () => {
  assert.equal(canUseInlineCamera(false, { getUserMedia() {} }), false)
  assert.equal(canUseInlineCamera(false, undefined), false)
})

test('HTTPS and trusted localhost retain inline capture only when the browser supports it', () => {
  assert.equal(canUseInlineCamera(true, { getUserMedia() {} }), true)
  assert.equal(canUseInlineCamera(true, undefined), false)
  assert.equal(canUseInlineCamera(true, {}), false)
})

test('native captures on HTTP can create distinct draft pages without randomUUID', () => {
  for (const cryptoApi of [null, {}, { getRandomValues() {} }]) {
    const ids = Array.from({ length: 20 }, () => createScanPageId(cryptoApi))
    assert.equal(new Set(ids).size, 20)
    assert.ok(ids.every((id) => typeof id === 'string' && id.length > 0))
  }
  const cryptoApi = { randomUUID() { assert.equal(this, cryptoApi); return 'browser-generated-page' } }
  assert.equal(createScanPageId(cryptoApi), 'browser-generated-page')
})
