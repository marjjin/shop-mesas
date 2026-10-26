import assert from 'node:assert/strict'
import test from 'node:test'
import { createApiClient } from './createApiClient.js'

test('GET preserves no-store and does not add a JSON header that causes a CORS preflight', async () => {
  const controller = new AbortController()
  const client = createApiClient('https://example.com/api', async (url, options) => {
    assert.equal(url, 'https://example.com/api/settings/welcome-message')
    assert.equal(options.cache, 'no-store')
    assert.equal(options.signal, controller.signal)
    assert.equal(options.headers.has('Content-Type'), false)
    assert.equal(options.headers.get('Accept'), 'application/json')
    return Response.json({ amount: 3500 })
  })
  assert.deepEqual(await client('/settings/welcome-message', {
    cache: 'no-store', signal: controller.signal, headers: { Accept: 'application/json' },
  }), { amount: 3500 })
})

test('writes preserve the method, body and explicit content type; 204 has no JSON body', async () => {
  const requests = []
  const client = createApiClient('https://example.com/api', async (url, options) => {
    requests.push({ url, ...options })
    return new Response(null, { status: 204 })
  })
  const body = JSON.stringify({ amount: 4520.75, greetingText: 'Hola {nombre}' })
  assert.equal(await client('/settings/welcome-message', { method: 'PUT', body }), null)
  assert.equal(requests[0].method, 'PUT')
  assert.equal(requests[0].body, body)
  assert.equal(requests[0].headers.get('Content-Type'), 'application/json')
  await client('/custom', { method: 'POST', body: 'text', headers: { 'Content-Type': 'text/plain' } })
  assert.equal(requests[1].headers.get('Content-Type'), 'text/plain')
})

test('API errors keep authentication, unavailable settings and server details compatible', async () => {
  const scenarios = [
    [401, '/login', { detail: 'server text' }, 'Usuario o contraseña incorrectos.'],
    [404, '/settings/welcome-message', null, 'La API no tiene disponible la configuración de bienvenida. Reiniciá el backend actualizado en local o desplegá su nueva versión en Render.'],
    [400, '/tables/1', { detail: 'La mesa ya está ocupada.' }, 'La mesa ya está ocupada.'],
    [500, '/bootstrap', null, 'No se pudo completar la operación.'],
  ]
  for (const [status, path, body, message] of scenarios) {
    const client = createApiClient('https://example.com/api', async () => body
      ? Response.json(body, { status })
      : new Response('upstream unavailable', { status }))
    await assert.rejects(client(path), { message })
  }
})

test('network failures are passed to the calling feature', async () => {
  const failure = new TypeError('Network unavailable')
  const client = createApiClient('https://example.com/api', async () => { throw failure })
  await assert.rejects(client('/bootstrap'), (error) => error === failure)
})
