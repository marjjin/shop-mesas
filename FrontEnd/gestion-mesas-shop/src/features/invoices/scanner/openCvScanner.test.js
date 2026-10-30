import assert from 'node:assert/strict'
import test from 'node:test'
import cvModule from '@techstark/opencv-js'
import { initializeOpenCv } from './openCvRuntime.js'
import { defaultCorners, isValidQuad } from './geometry.js'

// Exercise the real WASM runtime and the adapted jscanify detector, not mocks.
const scanner = await initializeOpenCv(cvModule)
const rectangle = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }]
function image(width, height, pixel) {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) data.set([...pixel(x, y), 255], (y * width + x) * 4)
  return { width, height, data }
}

test('jscanify locates the four corners of a skewed invoice on a contrasting surface', () => {
  const corners = [{ x: .15, y: .1 }, { x: .85, y: .2 }, { x: .8, y: .9 }, { x: .1, y: .8 }]
  const source = image(401, 501, (x, y) => {
    const point = { x: x / 400, y: y / 500 }
    const inside = corners.every((a, i) => {
      const b = corners[(i + 1) % 4]
      return (b.x - a.x) * (point.y - a.y) - (b.y - a.y) * (point.x - a.x) >= 0
    })
    // A few dark printed lines inside the sheet must not replace its outline.
    if (inside && x > 90 && x < 260 && y > 200 && y < 300 && y % 20 < 3) return [25, 25, 25]
    return inside ? [240, 237, 232] : [45, 50, 55]
  })
  const detection = scanner.detect(source)
  assert.equal(detection.engine, 'opencv')
  assert.equal(detection.detection, 'automatic')
  assert.ok(isValidQuad(detection.corners))
  detection.corners.forEach((point, i) => {
    assert.ok(Math.abs(point.x - corners[i].x) < .025, `corner ${i} x`)
    assert.ok(Math.abs(point.y - corners[i].y) < .025, `corner ${i} y`)
  })
})

test('empty frames and small objects offer manual corners instead of a false crop', () => {
  for (const source of [
    image(200, 200, () => [90, 90, 90]),
    image(200, 200, (x, y) => x > 80 && x < 110 && y > 80 && y < 110 ? [245, 245, 245] : [40, 40, 40]),
  ]) {
    const detection = scanner.detect(source)
    assert.equal(detection.detection, 'manual')
    assert.deepEqual(detection.corners, defaultCorners())
  }
})

test('OpenCV perspective correction preserves selected color corners without modifying the source', () => {
  const source = image(101, 101, (x, y) => [x * 2, y * 2, 30])
  const corners = [{ x: .2, y: .2 }, { x: .8, y: .1 }, { x: .9, y: .9 }, { x: .1, y: .8 }]
  const result = scanner.scan(source, corners, 'color')
  assert.ok(result.width < source.width)
  assert.deepEqual(Array.from(result.data.slice(0, 4)), [40, 40, 30, 255])
  assert.deepEqual(Array.from(result.data.slice(-4)), [180, 180, 30, 255])
  assert.equal(source.data[0], 0)
  assert.throws(() => scanner.scan(source, [...corners].reverse()), /esquinas/)
})

test('document enhancement after OpenCV correction retains text and lightens shadows', () => {
  const source = image(120, 120, (x, y) => {
    const value = x > 40 && x < 80 && y > 55 && y < 60 ? 20 : 150 + x / 3
    return [value, value, value]
  })
  const result = scanner.scan(source, rectangle, 'document')
  const paper = (20 * result.width + 20) * 4
  const text = (56 * result.width + 50) * 4
  assert.ok(result.data[paper] > 225)
  assert.ok(result.data[text] < 70)
  assert.equal(result.data[text], result.data[text + 1])
})
