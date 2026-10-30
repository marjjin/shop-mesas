import { defaultCorners, isValidQuad, outputSize, quadProjection } from './geometry.js'

export function detectDocument(image) {
  const { data, width, height } = image
  const step = Math.max(1, Math.ceil(Math.max(width, height) / 500))
  const cols = Math.ceil(width / step), rows = Math.ceil(height / step)
  const mask = new Uint8Array(cols * rows)
  // A connected light region proposes the paper bounds; manual corners remain available.
  const histogram = new Uint32Array(256)
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    const i = (Math.min(height - 1, y * step) * width + Math.min(width - 1, x * step)) * 4
    histogram[Math.round(.299 * data[i] + .587 * data[i + 1] + .114 * data[i + 2])]++
  }
  let threshold = 200, count = 0
  for (let value = 255; value >= 80; value--) { count += histogram[value]; if (count >= cols * rows * .22) { threshold = Math.max(100, value - 25); break } }
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    const i = (Math.min(height - 1, y * step) * width + Math.min(width - 1, x * step)) * 4
    if (.299 * data[i] + .587 * data[i + 1] + .114 * data[i + 2] >= threshold) mask[y * cols + x] = 1
  }
  let largest = []
  const queue = new Int32Array(mask.length)
  for (let start = 0; start < mask.length; start++) {
    if (mask[start] !== 1) continue
    let head = 0, tail = 1
    queue[0] = start; mask[start] = 2
    while (head < tail) {
      const index = queue[head++], x = index % cols, y = Math.floor(index / cols)
      for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
        const next = ny * cols + nx
        if (nx >= 0 && nx < cols && ny >= 0 && ny < rows && mask[next] === 1) { mask[next] = 2; queue[tail++] = next }
      }
    }
    if (tail > largest.length) largest = Array.from(queue.subarray(0, tail))
  }
  if (largest.length < mask.length * .12) return defaultCorners()
  let topLeft, topRight, bottomRight, bottomLeft
  for (const index of largest) {
    const p = { x: Math.min(1, index % cols * step / (width - 1)), y: Math.min(1, Math.floor(index / cols) * step / (height - 1)) }
    if (!topLeft || p.x + p.y < topLeft.x + topLeft.y) topLeft = p
    if (!topRight || p.x - p.y > topRight.x - topRight.y) topRight = p
    if (!bottomRight || p.x + p.y > bottomRight.x + bottomRight.y) bottomRight = p
    if (!bottomLeft || p.x - p.y < bottomLeft.x - bottomLeft.y) bottomLeft = p
  }
  const corners = [topLeft, topRight, bottomRight, bottomLeft]
  return isValidQuad(corners) ? corners : defaultCorners()
}

export function scanImage(image, corners, mode = 'document') {
  if (!isValidQuad(corners)) throw new Error('Ajustá las esquinas para que no se crucen y abarquen el documento.')
  const size = outputSize(corners, image.width, image.height)
  const pixels = new Uint8ClampedArray(size.width * size.height * 4)
  const project = quadProjection(corners)
  for (let y = 0; y < size.height; y++) for (let x = 0; x < size.width; x++) {
    const p = project(x / (size.width - 1), y / (size.height - 1))
    const sx = Math.max(0, Math.min(image.width - 1, p.x * (image.width - 1)))
    const sy = Math.max(0, Math.min(image.height - 1, p.y * (image.height - 1)))
    const x0 = Math.floor(sx), y0 = Math.floor(sy), x1 = Math.min(image.width - 1, x0 + 1), y1 = Math.min(image.height - 1, y0 + 1)
    const tx = sx - x0, ty = sy - y0, target = (y * size.width + x) * 4
    for (let c = 0; c < 3; c++) {
      const at = (xx, yy) => image.data[(yy * image.width + xx) * 4 + c]
      pixels[target + c] = (at(x0, y0) * (1 - tx) + at(x1, y0) * tx) * (1 - ty) + (at(x0, y1) * (1 - tx) + at(x1, y1) * tx) * ty
    }
    pixels[target + 3] = 255
  }
  if (mode === 'document') enhanceDocument(pixels, size.width, size.height)
  return { ...size, data: pixels }
}

export function enhanceDocument(pixels, width, height) {
  const stride = width + 1, integral = new Float64Array((width + 1) * (height + 1))
  for (let y = 0; y < height; y++) {
    let rowSum = 0
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      const gray = .299 * pixels[i] + .587 * pixels[i + 1] + .114 * pixels[i + 2]
      pixels[i] = gray; rowSum += gray
      integral[(y + 1) * stride + x + 1] = integral[y * stride + x + 1] + rowSum
    }
  }
  const radius = Math.max(12, Math.round(Math.min(width, height) / 30))
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const left = Math.max(0, x - radius), right = Math.min(width, x + radius + 1)
    const top = Math.max(0, y - radius), bottom = Math.min(height, y + radius + 1)
    const mean = (integral[bottom * stride + right] - integral[top * stride + right] - integral[bottom * stride + left] + integral[top * stride + left]) / ((right - left) * (bottom - top))
    const i = (y * width + x) * 4
    const value = Math.max(0, Math.min(255, (pixels[i] / Math.max(40, mean) * 240 - 25) * 1.1))
    pixels[i] = pixels[i + 1] = pixels[i + 2] = value
  }
}
