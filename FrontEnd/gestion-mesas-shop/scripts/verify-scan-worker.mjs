// Smoke test the built worker in a browser-like VM (no Node process/require).
// This complements the real WASM unit tests; it is not a mobile camera test.
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import vm from 'node:vm'

const assets = new URL('../dist/assets/', import.meta.url)
const filename = (await readdir(assets)).find((name) => /^scan\.worker-.*\.js$/.test(name))
assert.ok(filename, 'Run npm run build first')
const replies = new Map()
const context = vm.createContext({
  console, setTimeout, clearTimeout, performance, atob, TextDecoder, TextEncoder, URL,
  location: { href: `https://example.test/assets/${filename}` },
  importScripts() { throw new Error('Scanner must not load external scripts') },
  postMessage(message) { replies.get(message.id)?.(message) },
})
context.self = context
vm.runInContext(await readFile(new URL(filename, assets), 'utf8'), context, { filename })

function request(message) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { replies.delete(message.id); reject(new Error('Built scanner runtime did not respond')) }, 15000)
    replies.set(message.id, (reply) => { clearTimeout(timeout); replies.delete(message.id); resolve(reply) })
    context.onmessage({ data: message })
  })
}

const data = new Uint8ClampedArray(200 * 200 * 4).fill(255)
for (let y = 0; y < 200; y++) for (let x = 0; x < 200; x++) {
  const value = x > 30 && x < 170 && y > 20 && y < 180 ? 240 : 30
  const index = (y * 200 + x) * 4
  data[index] = data[index + 1] = data[index + 2] = value
}
const image = { width: 200, height: 200, data }
const detection = await request({ id: 1, operation: 'detect', image })
assert.equal(detection.result?.engine, 'opencv')
assert.equal(detection.result?.detection, 'automatic')
const scan = await request({ id: 2, operation: 'scan', image, corners: detection.result.corners, mode: 'color' })
assert.equal(scan.error, undefined)
assert.ok(scan.result.width > 100 && scan.result.width < 200)
assert.ok(scan.result.height > 100 && scan.result.height < 200)
assert.equal(scan.result.data.length, scan.result.width * scan.result.height * 4)
console.log('Built worker: OpenCV ready, jscanify detection and perspective correction passed.')
