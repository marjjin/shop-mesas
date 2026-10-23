import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveApiUrl } from './apiUrl.js'

test('development and production use their corresponding API by default', () => {
  assert.equal(resolveApiUrl(), 'http://localhost:5000/api')
  assert.equal(resolveApiUrl({ production: true }), 'https://shop-mesas.onrender.com/api')
  assert.equal(resolveApiUrl({ configuredUrl: '  ', production: true }), 'https://shop-mesas.onrender.com/api')
})

test('public API URLs normalize whitespace, trailing slashes and omitted /api', () => {
  assert.equal(resolveApiUrl({ configuredUrl: ' https://my-api.onrender.com/// ', production: true }), 'https://my-api.onrender.com/api')
  assert.equal(resolveApiUrl({ configuredUrl: 'https://my-api.onrender.com/api/', production: true }), 'https://my-api.onrender.com/api')
  assert.equal(resolveApiUrl({ configuredUrl: 'https://example.com/services/api/', production: true }), 'https://example.com/services/api')
})

test('a production build cannot use a local API or mixed content', () => {
  for (const configuredUrl of ['http://localhost:5000/api', 'https://localhost/api', 'https://127.0.0.1/api', 'https://127.12.3.4/api', 'https://[::1]/api', 'https://api.localhost/api', 'http://my-api.onrender.com/api'])
    assert.throws(() => resolveApiUrl({ configuredUrl, production: true }), /deploy necesita/)
  assert.equal(resolveApiUrl({ configuredUrl: 'http://localhost:6000/' }), 'http://localhost:6000/api')
})

test('malformed URLs cannot silently produce broken requests', () => {
  for (const configuredUrl of ['not-a-url', '/api', 'ftp://example.com/api', 'https://user:password@example.com/api', 'https://example.com/api?key=value', 'https://example.com/api#fragment'])
    assert.throws(() => resolveApiUrl({ configuredUrl, production: true }), /VITE_API_URL/)
})
