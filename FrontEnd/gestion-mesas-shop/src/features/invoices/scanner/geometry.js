export const defaultCorners = () => [{ x: .03, y: .03 }, { x: .97, y: .03 }, { x: .97, y: .97 }, { x: .03, y: .97 }]

export function isValidQuad(points) {
  if (points.length !== 4 || points.some(({ x, y }) => !Number.isFinite(x) || !Number.isFinite(y) || x < 0 || x > 1 || y < 0 || y > 1)) return false
  const cross = points.map((p, i) => {
    const q = points[(i + 1) % 4], r = points[(i + 2) % 4]
    return (q.x - p.x) * (r.y - q.y) - (q.y - p.y) * (r.x - q.x)
  })
  const area = Math.abs(points.reduce((sum, p, i) => { const q = points[(i + 1) % 4]; return sum + p.x * q.y - p.y * q.x }, 0)) / 2
  return area > .025 && cross.every((v) => v > .0001)
}

export function outputSize(points, width, height, maxEdge = 1800) {
  const p = points.map((v) => ({ x: v.x * (width - 1), y: v.y * (height - 1) }))
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y)
  const w = Math.max(distance(p[0], p[1]), distance(p[3], p[2]))
  const h = Math.max(distance(p[0], p[3]), distance(p[1], p[2]))
  const scale = Math.min(1, maxEdge / Math.max(w, h))
  return { width: Math.max(2, Math.round(w * scale)), height: Math.max(2, Math.round(h * scale)) }
}

// Project the output rectangle onto the selected quadrilateral, including perspective.
export function quadProjection(points) {
  const [a, b, c, d] = points
  const dx1 = b.x - c.x, dx2 = d.x - c.x, dx3 = a.x - b.x + c.x - d.x
  const dy1 = b.y - c.y, dy2 = d.y - c.y, dy3 = a.y - b.y + c.y - d.y
  const determinant = dx1 * dy2 - dx2 * dy1
  const g = Math.abs(determinant) < 1e-12 ? 0 : (dx3 * dy2 - dx2 * dy3) / determinant
  const h = Math.abs(determinant) < 1e-12 ? 0 : (dx1 * dy3 - dx3 * dy1) / determinant
  return (u, v) => {
    const denominator = g * u + h * v + 1
    return { x: ((b.x - a.x + g * b.x) * u + (d.x - a.x + h * d.x) * v + a.x) / denominator,
      y: ((b.y - a.y + g * b.y) * u + (d.y - a.y + h * d.y) * v + a.y) / denominator }
  }
}
