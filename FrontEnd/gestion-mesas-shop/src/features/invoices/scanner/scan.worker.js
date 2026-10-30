import { detectDocument, scanImage } from './processImage.js'

self.onmessage = ({ data }) => {
  try {
    if (data.operation === 'detect') self.postMessage({ result: detectDocument(data.image) })
    else {
      const result = scanImage(data.image, data.corners, data.mode)
      self.postMessage({ result }, [result.data.buffer])
    }
  } catch (error) { self.postMessage({ error: error.message }) }
}
