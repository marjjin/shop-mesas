import assert from 'node:assert/strict'
import test from 'node:test'
import cvModule from '@techstark/opencv-js'
import { initializeOpenCv } from './openCvRuntime.js'
import { defaultCorners, isValidQuad } from './geometry.js'

// Exercise the real WASM runtime and the document detector, not mocks.
const scanner = await initializeOpenCv(cvModule)
const rectangle = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }]
function image(width, height, pixel) {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) data.set([...pixel(x, y), 255], (y * width + x) * 4)
  return { width, height, data }
}

function photo(corners, background, overlay = () => null) {
  return image(401, 501, (x, y) => {
    const point = { x: x / 400, y: y / 500 }
    const covered = overlay(point.x, point.y)
    if (covered) return covered
    const inside = corners.every((a, i) => {
      const b = corners[(i + 1) % 4]
      return (b.x - a.x) * (point.y - a.y) - (b.y - a.y) * (point.x - a.x) >= 0
    })
    // A few dark printed lines inside the sheet must not replace its outline.
    if (inside && x > 150 && x < 250 && y > 200 && y < 300 && y % 20 < 3) return [25, 25, 25]
    return inside ? [240, 237, 232] : background(point.x, point.y)
  })
}
function assertCorners(source, corners) {
  const detection = scanner.detect(source)
  assert.equal(detection.engine, 'opencv')
  assert.equal(detection.detection, 'automatic')
  assert.ok(isValidQuad(detection.corners))
  detection.corners.forEach((point, i) => {
    assert.ok(Math.abs(point.x - corners[i].x) < .025, `corner ${i} x`)
    assert.ok(Math.abs(point.y - corners[i].y) < .025, `corner ${i} y`)
  })
}
const skewed = [{ x: .15, y: .1 }, { x: .85, y: .2 }, { x: .8, y: .9 }, { x: .1, y: .8 }]
const plain = () => [45, 50, 55]
const tiles = (x, y) => (x * 6) % 1 < .02 || (y * 8) % 1 < .02 ? [70, 70, 72] : [150, 148, 142]

test('locates the four corners of a skewed invoice on a contrasting surface', () => {
  assertCorners(photo(skewed, plain), skewed)
})

test('keeps the outline of a sheet rotated close to 45 degrees', () => {
  const rotated = [{ x: .42, y: .06 }, { x: .93, y: .42 }, { x: .58, y: .93 }, { x: .07, y: .57 }]
  assertCorners(photo(rotated, plain), rotated)
})

test('ignores tile seams that cross the whole photo', () => {
  assertCorners(photo(skewed, tiles), skewed)
})

test('fits the sheet when an object covers part of one side', () => {
  const hand = (x, y) => y > .5 && y < .62 && x < .22 ? [190, 140, 115] : null
  assertCorners(photo(skewed, plain, hand), skewed)
})

test('prefers the sheet over the outline of the table under it', () => {
  const table = (x, y) => x > .05 && x < .95 && y > .04 && y < .96 ? [120, 80, 50] : [230, 228, 222]
  assertCorners(photo(skewed, table), skewed)
})

test('a patterned surface without a document offers manual corners', () => {
  const detection = scanner.detect(image(401, 501, (x, y) => tiles(x / 400, y / 500)))
  assert.equal(detection.detection, 'manual')
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
