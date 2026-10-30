/* Derived from jscanify 1.4.3 (browser source header: v1.4.0).
 * Copyright (c) 2023 ColonelParrot and other contributors. MIT license.
 * See jscanify.LICENSE.txt. Adapted to ES modules, injected OpenCV and workers;
 * unused DOM methods omitted and temporary contour handles explicitly freed.
 */
export default class Jscanify {
  constructor(cv) { this.cv = cv }

  findPaperContour(image) {
    const cv = this.cv
    const edges = new cv.Mat()
    const blurred = new cv.Mat()
    const threshold = new cv.Mat()
    const contours = new cv.MatVector()
    const hierarchy = new cv.Mat()
    try {
      cv.Canny(image, edges, 50, 200)
      cv.GaussianBlur(edges, blurred, new cv.Size(3, 3), 0, 0, cv.BORDER_DEFAULT)
      cv.threshold(blurred, threshold, 0, 255, cv.THRESH_OTSU)
      cv.findContours(threshold, contours, hierarchy, cv.RETR_CCOMP, cv.CHAIN_APPROX_SIMPLE)
      let maxArea = 0, maxIndex = -1
      for (let i = 0; i < contours.size(); i++) {
        const contour = contours.get(i)
        try {
          const area = cv.contourArea(contour)
          if (area > maxArea) { maxArea = area; maxIndex = i }
        } finally { contour.delete() }
      }
      return maxIndex >= 0 ? contours.get(maxIndex) : null
    } finally {
      edges.delete(); blurred.delete(); threshold.delete(); contours.delete(); hierarchy.delete()
    }
  }

  getCornerPoints(contour) {
    const center = this.cv.minAreaRect(contour).center
    const points = {}, distances = {}
    for (let i = 0; i < contour.data32S.length; i += 2) {
      const point = { x: contour.data32S[i], y: contour.data32S[i + 1] }
      const distance = Math.hypot(point.x - center.x, point.y - center.y)
      let name
      if (point.x < center.x && point.y < center.y) name = 'topLeftCorner'
      else if (point.x > center.x && point.y < center.y) name = 'topRightCorner'
      else if (point.x < center.x && point.y > center.y) name = 'bottomLeftCorner'
      else if (point.x > center.x && point.y > center.y) name = 'bottomRightCorner'
      if (name && distance > (distances[name] || 0)) { points[name] = point; distances[name] = distance }
    }
    return points
  }
}
