import { SCAN_MAX_EDGE, SCAN_PAGE_TARGET_BYTES, SCAN_JPEG_QUALITIES } from './scanQuality.js'
import { createScanPageId } from './browserCapture.js'

export const canvasBlob = (canvas, quality) => new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('No se pudo preparar la imagen.')), 'image/jpeg', quality))

export async function readScanSource(file, signal, scanner) {
  if (file.size > 20 * 1024 * 1024) throw new Error('La imagen debe ocupar hasta 20 MB.')
  if (file.type && !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Usá una imagen JPG, PNG o WebP. Desde el celular podés tomar una foto nueva.')
  let bitmap
  try { bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' }) }
  catch { throw new Error('No se pudo abrir la imagen. Probá con una foto en formato JPG.') }
  try {
    if (bitmap.width * bitmap.height > 40000000 || Math.min(bitmap.width, bitmap.height) < 120) throw new Error('Usá una foto legible, de al menos 120 píxeles y hasta 40 megapíxeles.')
    const scale = Math.min(1, SCAN_MAX_EDGE / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale)
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close()
    bitmap = null
    const image = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const detection = await scanner.process('detect', image, {}, signal)
    const blob = await canvasBlob(canvas, .85)
    if (signal?.aborted) throw new DOMException('Operación cancelada', 'AbortError')
    return { image, ...detection, originalBytes: file.size, url: URL.createObjectURL(blob) }
  } finally { bitmap?.close() }
}

export async function createScannedPage(source, corners, mode, signal, scanner) {
  const result = await scanner.process('scan', source.image, { corners, mode }, signal)
  const canvas = document.createElement('canvas')
  canvas.width = result.width; canvas.height = result.height
  canvas.getContext('2d').putImageData(new ImageData(result.data, result.width, result.height), 0, 0)
  let blob
  for (const quality of SCAN_JPEG_QUALITIES) {
    blob = await canvasBlob(canvas, quality)
    if (blob.size <= SCAN_PAGE_TARGET_BYTES) break
  }
  if (signal?.aborted) throw new DOMException('Operación cancelada', 'AbortError')
  return { id: createScanPageId(), blob, width: result.width, height: result.height, originalBytes: source.originalBytes, url: URL.createObjectURL(blob) }
}
