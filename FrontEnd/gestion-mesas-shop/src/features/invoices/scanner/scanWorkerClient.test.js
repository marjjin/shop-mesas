import assert from 'node:assert/strict'
import test from 'node:test'
import { createScanWorkerClient } from './scanWorkerClient.js'

function workerFixture(options) {
  const workers = []
  const client = createScanWorkerClient({
    ...options,
    workerFactory: () => {
      const worker = { messages: [], terminated: false, postMessage(value) { this.messages.push(value) }, terminate() { this.terminated = true } }
      workers.push(worker)
      return worker
    },
  })
  return { client, workers }
}

test('detection and correction reuse the runtime and match responses to their request', async () => {
  const { client, workers } = workerFixture()
  try {
    const detection = client.process('detect', { width: 10 })
    const worker = workers[0]
    worker.onmessage({ data: { id: -1, result: 'stale' } })
    worker.onmessage({ data: { id: worker.messages[0].id, result: 'corners' } })
    assert.equal(await detection, 'corners')
    const correction = client.process('scan', {}, { mode: 'color' })
    assert.equal(workers.length, 1)
    assert.equal(worker.messages[1].mode, 'color')
    worker.onmessage({ data: { id: worker.messages[1].id, result: 'pixels' } })
    assert.equal(await correction, 'pixels')
    assert.equal(worker.terminated, false)
  } finally { client.dispose() }
  assert.equal(workers[0].terminated, true)
  await assert.rejects(client.process('detect', {}), { name: 'AbortError' })
})

test('cancelling releases the busy worker, ignores its late reply and permits a fresh attempt', async () => {
  const { client, workers } = workerFixture()
  const controller = new AbortController()
  const first = client.process('detect', {}, {}, controller.signal)
  controller.abort()
  await assert.rejects(first, { name: 'AbortError' })
  assert.equal(workers[0].terminated, true)
  const retry = client.process('detect', {})
  try {
    workers[0].onmessage({ data: { id: 1, result: 'late' } })
    workers[0].onerror()
    workers[1].onmessage({ data: { id: workers[1].messages[0].id, result: 'new' } })
    assert.equal(await retry, 'new')
  } finally { client.dispose() }
})

test('timeout and worker failures reject pending work and allow another attempt', async () => {
  const { client, workers } = workerFixture({ timeoutMs: 10 })
  try {
    await assert.rejects(client.process('detect', {}), /tardó demasiado/)
    assert.equal(workers[0].terminated, true)
    const retry = client.process('detect', {})
    workers[1].onerror()
    await assert.rejects(retry, /iniciar el escáner/)
    assert.equal(workers[1].terminated, true)
  } finally { client.dispose() }
})

test('browsers without workers retain a manual scanning path', async () => {
  const client = createScanWorkerClient({ workerFactory: () => null })
  try {
    const detection = await client.process('detect', {})
    assert.equal(detection.detection, 'manual')
    assert.equal(detection.engine, 'basic')
  } finally { client.dispose() }
})
