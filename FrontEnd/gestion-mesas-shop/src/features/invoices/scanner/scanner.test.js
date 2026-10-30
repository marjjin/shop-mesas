import assert from 'node:assert/strict'
import test from 'node:test'
import { isValidQuad, quadProjection, outputSize } from './geometry.js'
import { scanImage, detectDocument } from './processImage.js'
import { pageDimensions } from '../documents/buildInvoicePdf.js'

const rectangle = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }]
function image(width, height, pixel) {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) data.set([...pixel(x, y), 255], (y * width + x) * 4)
  return { width, height, data }
}

test('crop rejects crossed, degenerate, reversed and out-of-image corners', () => {
  assert.equal(isValidQuad(rectangle), true)
  assert.equal(isValidQuad([rectangle[0], rectangle[2], rectangle[1], rectangle[3]]), false)
  assert.equal(isValidQuad([...rectangle].reverse()), false)
  assert.equal(isValidQuad(rectangle.map(() => ({ x: .5, y: .5 }))), false)
  assert.equal(isValidQuad([{ x: -.1, y: 0 }, ...rectangle.slice(1)]), false)
})

test('perspective projection maps every output corner to its selected source corner', () => {
  const corners = [{ x: .15, y: .1 }, { x: .9, y: .2 }, { x: .75, y: .95 }, { x: .05, y: .8 }]
  const project = quadProjection(corners)
  rectangle.forEach(({ x, y }, i) => {
    const point = project(x, y)
    assert.ok(Math.abs(point.x - corners[i].x) < 1e-9)
    assert.ok(Math.abs(point.y - corners[i].y) < 1e-9)
  })
  const mid = project(.5, .5)
  assert.ok(mid.x > .3 && mid.x < .6 && mid.y > .3 && mid.y < .7)
})

test('scan crops background and preserves color samples after perspective correction', () => {
  const source = image(101, 101, (x, y) => [x * 2, y * 2, 30])
  const corners = [{ x: .2, y: .2 }, { x: .8, y: .1 }, { x: .9, y: .9 }, { x: .1, y: .8 }]
  const result = scanImage(source, corners, 'color')
  assert.ok(result.width < source.width)
  const topLeft = Array.from(result.data.slice(0, 3))
  const bottomRight = Array.from(result.data.slice(-4, -1))
  assert.deepEqual(topLeft, [40, 40, 30])
  assert.deepEqual(bottomRight, [180, 180, 30])
  assert.equal(source.data[0], 0)
})

test('document treatment retains dark text and reduces gray paper shadows', () => {
  const source = image(120, 120, (x, y) => {
    const value = x > 40 && x < 80 && y > 55 && y < 60 ? 20 : 150 + x / 3
    return [value, value, value]
  })
  const result = scanImage(source, rectangle)
  const paper = (20 * result.width + 20) * 4
  const text = (56 * result.width + 50) * 4
  assert.ok(result.data[paper] > 225)
  assert.ok(result.data[text] < 70)
  assert.equal(result.data[text], result.data[text + 1])
})

test('automatic paper proposal excludes a contrasting background', () => {
  const source = image(200, 200, (x, y) => x >= 30 && x <= 170 && y >= 20 && y <= 180 ? [245, 245, 245] : [40, 35, 30])
  const corners = detectDocument(source)
  assert.ok(isValidQuad(corners))
  assert.ok(corners[0].x > .1 && corners[0].x < .2)
  assert.ok(corners[2].x > .8 && corners[2].x < .9)
})

test('long receipts and large photos keep bounded image and PDF dimensions', () => {
  const size = outputSize(rectangle, 4000, 6000)
  assert.equal(size.height, 2400)
  assert.ok(size.width <= 2400)
  assert.ok(size.width * size.height < 25000000)
  const small = outputSize(rectangle, 600, 900)
  assert.ok(small.width <= 600 && small.height <= 900)
  const [width, height] = pageDimensions({ width: 100, height: 1800 })
  assert.ok(height <= 1200 && width <= 210)
  assert.ok(Math.abs(width / height - 100 / 1800) < 1e-9)
})
