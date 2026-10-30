import { isValidQuad } from './geometry.js'

const MIN_AREA = .08, MAX_AREA = .985, MIN_FILL = .72, MIN_SIDE_SUPPORT = .4, MIN_CONTRAST = 9
const MIN_ANGLE = 45, MAX_ANGLE = 135, SIDE_SAMPLES = 48

const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y)

function polygonArea(points) {
  return Math.abs(points.reduce((sum, p, i) => { const q = points[(i + 1) % 4]; return sum + p.x * q.y - p.y * q.x }, 0)) / 2
}

// Clockwise on screen, starting at the corner closest to the top left of the photo.
export function orderCorners(points) {
  const center = { x: points.reduce((sum, p) => sum + p.x, 0) / 4, y: points.reduce((sum, p) => sum + p.y, 0) / 4 }
  const sorted = [...points].sort((a, b) => Math.atan2(a.y - center.y, a.x - center.x) - Math.atan2(b.y - center.y, b.x - center.x))
  const first = sorted.reduce((best, p, i) => p.x + p.y < sorted[best].x + sorted[best].y ? i : best, 0)
  return [...sorted.slice(first), ...sorted.slice(0, first)]
}

function hasPaperAngles(quad) {
  return quad.every((p, i) => {
    const a = quad[(i + 3) % 4], b = quad[(i + 1) % 4]
    const cos = ((a.x - p.x) * (b.x - p.x) + (a.y - p.y) * (b.y - p.y)) / (distance(a, p) * distance(b, p) || 1)
    const angle = Math.acos(Math.max(-1, Math.min(1, cos))) * 180 / Math.PI
    return angle >= MIN_ANGLE && angle <= MAX_ANGLE
  })
}

// A real sheet is lighter than what surrounds it along each side. Fraction of each
// side that shows that step; lines on the table or a printed box do not score.
export function sideSupport(gray, quad) {
  const { cols, rows, data } = gray
  const center = { x: quad.reduce((sum, p) => sum + p.x, 0) / 4, y: quad.reduce((sum, p) => sum + p.y, 0) / 4 }
  const offset = Math.max(3, Math.round(Math.max(cols, rows) * .008))
  const at = (x, y) => {
    const px = Math.round(x), py = Math.round(y)
    return px >= 0 && py >= 0 && px < cols && py < rows ? data[py * cols + px] : null
  }
  return quad.map((a, i) => {
    const b = quad[(i + 1) % 4], length = distance(a, b) || 1
    let nx = (b.y - a.y) / length, ny = (a.x - b.x) / length
    if (nx * (center.x - a.x) + ny * (center.y - a.y) < 0) { nx = -nx; ny = -ny }
    let supported = 0
    for (let s = 1; s <= SIDE_SAMPLES; s++) {
      const t = s / (SIDE_SAMPLES + 1), x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t
      const inner = at(x + nx * offset, y + ny * offset), outer = at(x - nx * offset, y - ny * offset)
      if (inner != null && outer != null && inner - outer >= MIN_CONTRAST) supported++
    }
    return supported / SIDE_SAMPLES
  })
}

function fitQuad(cv, contour) {
  const hull = new cv.Mat(), approximation = new cv.Mat()
  try {
    cv.convexHull(contour, hull, false, true)
    const perimeter = cv.arcLength(hull, true)
    for (let factor = .004; factor <= .12; factor += .004) {
      cv.approxPolyDP(hull, approximation, factor * perimeter, true)
      if (approximation.rows === 4) {
        const points = approximation.data32S
        return orderCorners([0, 1, 2, 3].map((i) => ({ x: points[i * 2], y: points[i * 2 + 1] })))
      }
      if (approximation.rows < 4) return null
    }
    return null
  } finally { hull.delete(); approximation.delete() }
}

function candidatesFrom(cv, mask, gray, frameArea) {
  const contours = new cv.MatVector(), hierarchy = new cv.Mat()
  const found = []
  try {
    // Nested shapes count: the sheet can sit inside a table that also has an outline.
    cv.findContours(mask, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE)
    for (let i = 0; i < contours.size(); i++) {
      const contour = contours.get(i)
      try {
        const contourArea = cv.contourArea(contour)
        if (contourArea < frameArea * MIN_AREA) continue
        const quad = fitQuad(cv, contour)
        if (!quad) continue
        const area = polygonArea(quad)
        if (area > frameArea * MAX_AREA || contourArea / area < MIN_FILL || !hasPaperAngles(quad)) continue
        const support = sideSupport(gray, quad)
        if (Math.min(...support) < MIN_SIDE_SUPPORT) continue
        const average = support.reduce((sum, value) => sum + value, 0) / 4
        found.push({ quad, score: area / frameArea * average * average * (contourArea / area) })
      } finally { contour.delete() }
    }
    return found
  } finally { contours.delete(); hierarchy.delete() }
}

export function findDocumentCorners(cv, rgba) {
  const { cols: width, rows: height } = rgba
  const owned = []
  const own = (mat) => { owned.push(mat); return mat }
  const channels = new cv.MatVector()
  try {
    const gray = own(new cv.Mat()), rgb = own(new cv.Mat()), hsv = own(new cv.Mat())
    const smooth = own(new cv.Mat()), neutral = own(new cv.Mat())
    cv.cvtColor(rgba, gray, cv.COLOR_RGBA2GRAY)
    cv.cvtColor(rgba, rgb, cv.COLOR_RGBA2RGB)
    cv.cvtColor(rgb, hsv, cv.COLOR_RGB2HSV)
    cv.split(hsv, channels)
    const saturation = own(channels.get(1))
    cv.GaussianBlur(gray, smooth, new cv.Size(5, 5), 0, 0, cv.BORDER_DEFAULT)
    cv.GaussianBlur(saturation, neutral, new cv.Size(5, 5), 0, 0, cv.BORDER_DEFAULT)
    // Wide enough to close lines of text and thin marks, without joining nearby objects.
    const size = Math.max(5, Math.round(Math.max(width, height) / 70)) | 1
    const kernel = own(cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(size, size)))
    const open = own(cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(size * 2 + 1, size * 2 + 1)))
    const masks = [
      (mask) => { cv.threshold(smooth, mask, 0, 255, cv.THRESH_BINARY | cv.THRESH_OTSU) },
      (mask) => { cv.threshold(neutral, mask, 0, 255, cv.THRESH_BINARY_INV | cv.THRESH_OTSU) },
      (mask) => { cv.adaptiveThreshold(smooth, mask, 255, cv.ADAPTIVE_THRESH_MEAN_C, cv.THRESH_BINARY, Math.max(width, height) / 3 | 1, -4) },
      (mask) => { cv.Canny(smooth, mask, 30, 120) },
    ]
    const candidates = []
    for (const build of masks) {
      const mask = own(new cv.Mat())
      build(mask)
      cv.morphologyEx(mask, mask, cv.MORPH_CLOSE, kernel)
      // Opening detaches thin shapes that touch the sheet, such as a pen or a cable.
      if (build !== masks[3]) cv.morphologyEx(mask, mask, cv.MORPH_OPEN, open)
      candidates.push(...candidatesFrom(cv, mask, smooth, width * height))
    }
    const best = candidates.reduce((top, item) => !top || item.score > top.score ? item : top, null)
    if (!best) return null
    const corners = best.quad.map(({ x, y }) => ({ x: x / (width - 1), y: y / (height - 1) }))
    return isValidQuad(corners) ? corners : null
  } finally { channels.delete(); for (const mat of owned.reverse()) mat.delete() }
}
