import Jscanify from './vendor/jscanify.js'
import { defaultCorners, isValidQuad, outputSize } from './geometry.js'
import { enhanceDocument } from './processImage.js'

// OpenCV stays inside the worker. Only serializable pixels and normalized points
// cross the boundary; every WASM Mat is released even when processing fails.
export function createOpenCvScanner(cv) {
  const scanner = new Jscanify(cv)
  return {
    detect(image) {
      const source = cv.matFromImageData(image)
      const reduced = new cv.Mat()
      const gray = new cv.Mat()
      let contour
      try {
        const scale = Math.min(1, 1000 / Math.max(image.width, image.height))
        const width = Math.round(image.width * scale), height = Math.round(image.height * scale)
        cv.resize(source, reduced, new cv.Size(width, height), 0, 0, cv.INTER_AREA)
        cv.cvtColor(reduced, gray, cv.COLOR_RGBA2GRAY)
        contour = scanner.findPaperContour(gray)
        if (contour && cv.contourArea(contour) >= width * height * .08) {
          const points = scanner.getCornerPoints(contour)
          const corners = ['topLeftCorner', 'topRightCorner', 'bottomRightCorner', 'bottomLeftCorner'].map((name) => ({
            x: points[name]?.x / (width - 1), y: points[name]?.y / (height - 1),
          }))
          if (isValidQuad(corners)) return { corners, detection: 'automatic', engine: 'opencv' }
        }
        return { corners: defaultCorners(), detection: 'manual', engine: 'opencv' }
      } finally { contour?.delete(); source.delete(); reduced.delete(); gray.delete() }
    },
    scan(image, corners, mode = 'document') {
      if (!isValidQuad(corners)) throw new Error('Ajustá las esquinas para que no se crucen y abarquen el documento.')
      const { width, height } = outputSize(corners, image.width, image.height)
      const matrices = []
      const own = (mat) => { matrices.push(mat); return mat }
      try {
        const source = own(cv.matFromImageData(image))
        const from = own(cv.matFromArray(4, 1, cv.CV_32FC2, corners.flatMap(({ x, y }) => [x * (image.width - 1), y * (image.height - 1)])))
        const to = own(cv.matFromArray(4, 1, cv.CV_32FC2, [0, 0, width - 1, 0, width - 1, height - 1, 0, height - 1]))
        const transform = own(cv.getPerspectiveTransform(from, to))
        const result = own(new cv.Mat())
        cv.warpPerspective(source, result, transform, new cv.Size(width, height), cv.INTER_LINEAR, cv.BORDER_REPLICATE)
        // Copy out of the WASM heap before freeing the result or transferring it.
        const data = new Uint8ClampedArray(result.data)
        if (mode === 'document') enhanceDocument(data, width, height)
        return { width, height, data }
      } finally { for (const mat of matrices.reverse()) mat.delete() }
    },
  }
}
