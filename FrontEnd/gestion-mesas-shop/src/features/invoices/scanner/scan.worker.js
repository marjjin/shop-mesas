import { defaultCorners } from './geometry.js'
import { scanImage } from './processImage.js'
import { initializeOpenCv } from './openCvRuntime.js'
import cvModule from '@techstark/opencv-js'

// Load once per composer, only after a photo is selected. The distribution is
// bundled locally and does not send images to an external scanning service.
// A static import inside this lazy worker avoids Promise-adopting Emscripten's
// self-resolving `then` export through a dynamic-import namespace.
const engine = initializeOpenCv(cvModule).catch(() => null)

self.onmessage = async ({ data }) => {
  try {
    const scanner = await engine
    if (data.operation === 'detect') {
      let result
      try { result = scanner?.detect(data.image) }
      catch { /* A manual crop remains available if automatic detection fails. */ }
      self.postMessage({ id: data.id, result: result || { corners: defaultCorners(), detection: 'manual', engine: 'basic' } })
    } else {
      const result = scanner ? scanner.scan(data.image, data.corners, data.mode) : scanImage(data.image, data.corners, data.mode)
      self.postMessage({ id: data.id, result }, [result.data.buffer])
    }
  } catch (error) { self.postMessage({ id: data.id, error: typeof error === 'string' ? 'No se pudo corregir la imagen. Revisá las esquinas.' : error.message }) }
}
