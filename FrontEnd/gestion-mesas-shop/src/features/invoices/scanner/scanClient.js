import { detectDocument, scanImage } from './processImage.js'

export function processInWorker(operation, image, options = {}, signal) {
  if (signal?.aborted) return Promise.reject(new DOMException('Operación cancelada', 'AbortError'))
  if (typeof Worker === 'undefined') return Promise.resolve(operation === 'detect' ? detectDocument(image) : scanImage(image, options.corners, options.mode))
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./scan.worker.js', import.meta.url), { type: 'module' })
    const timeout = setTimeout(() => { cleanup(); reject(new Error('El procesamiento tardó demasiado. Probá con otra imagen.')) }, 30000)
    const cleanup = () => { clearTimeout(timeout); signal?.removeEventListener('abort', abort); worker.terminate() }
    const abort = () => { cleanup(); reject(new DOMException('Operación cancelada', 'AbortError')) }
    signal?.addEventListener('abort', abort, { once: true })
    worker.onmessage = ({ data }) => { cleanup(); if (data.error) reject(new Error(data.error)); else resolve(data.result) }
    worker.onerror = () => { cleanup(); reject(new Error('No se pudo procesar el escaneo. Intentá de nuevo.')) }
    worker.postMessage({ operation, image, ...options })
  })
}

export const canvasBlob = (canvas, quality) => new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('No se pudo preparar la imagen.')), 'image/jpeg', quality))

export async function readScanSource(file, signal) {
  if (file.size > 20 * 1024 * 1024) throw new Error('La imagen debe ocupar hasta 20 MB.')
  if (file.type && !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Usá una imagen JPG, PNG o WebP. Desde el celular podés tomar una foto nueva.')
  let bitmap
  try { bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' }) }
  catch { throw new Error('No se pudo abrir la imagen. Probá con una foto en formato JPG.') }
  try {
    if (bitmap.width * bitmap.height > 40000000 || Math.min(bitmap.width, bitmap.height) < 120) throw new Error('Usá una foto legible, de al menos 120 píxeles y hasta 40 megapíxeles.')
    const scale = Math.min(1, 1800 / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale)
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    const image = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const corners = await processInWorker('detect', image, {}, signal)
    const blob = await canvasBlob(canvas, .85)
    if (signal?.aborted) throw new DOMException('Operación cancelada', 'AbortError')
    return { image, corners, originalBytes: file.size, url: URL.createObjectURL(blob) }
  } finally { bitmap.close() }
}

export async function createScannedPage(source, corners, mode, signal) {
  const result = await processInWorker('scan', source.image, { corners, mode }, signal)
  const canvas = document.createElement('canvas')
  canvas.width = result.width; canvas.height = result.height
  canvas.getContext('2d').putImageData(new ImageData(result.data, result.width, result.height), 0, 0)
  let blob
  for (const quality of [.72, .58, .44]) { blob = await canvasBlob(canvas, quality); if (blob.size <= 420000) break }
  if (signal?.aborted) throw new DOMException('Operación cancelada', 'AbortError')
  return { id: crypto.randomUUID(), blob, width: result.width, height: result.height, originalBytes: source.originalBytes, url: URL.createObjectURL(blob) }
}
