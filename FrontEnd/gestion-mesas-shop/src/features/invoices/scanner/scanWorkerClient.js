import { defaultCorners } from './geometry.js'
import { scanImage } from './processImage.js'

const cancelled = () => new DOMException('Operación cancelada', 'AbortError')

export function createScanWorkerClient({
  workerFactory = () => typeof Worker === 'undefined' ? null : new Worker(new URL('./scan.worker.js', import.meta.url), { type: 'module' }),
  timeoutMs = 45000,
} = {}) {
  let worker = null, sequence = 0, disposed = false
  const pending = new Map()
  const stop = (error) => {
    worker?.terminate(); worker = null
    for (const request of [...pending.values()]) request.finish(error)
  }
  const start = () => {
    if (worker) return worker
    worker = workerFactory()
    if (worker) {
      const active = worker
      worker.onmessage = ({ data }) => { if (worker === active) pending.get(data.id)?.finish(data.error ? new Error(data.error) : null, data.result) }
      worker.onerror = () => { if (worker === active) stop(new Error('No se pudo iniciar el escáner. Volvé a elegir la imagen para reintentar.')) }
      worker.onmessageerror = () => { if (worker === active) stop(new Error('No se pudo leer el resultado del escaneo. Intentá de nuevo.')) }
    }
    return worker
  }
  return {
    process(operation, image, options = {}, signal) {
      if (disposed || signal?.aborted) return Promise.reject(cancelled())
      return new Promise((resolve, reject) => {
        let active
        try { active = start() }
        catch { reject(new Error('No se pudo iniciar el escáner. Recargá la página para reintentar.')); return }
        if (!active) {
          // Compatibility path for browsers without workers. Images stay local.
          try { resolve(operation === 'detect' ? { corners: defaultCorners(), detection: 'manual', engine: 'basic' } : scanImage(image, options.corners, options.mode)) }
          catch (error) { reject(error) }
          return
        }
        const id = ++sequence
        const abort = () => stop(cancelled())
        const timeout = setTimeout(() => stop(new Error('El escáner tardó demasiado en responder. Revisá la conexión y volvé a elegir la imagen.')), timeoutMs)
        pending.set(id, {
          finish(error, result) {
            clearTimeout(timeout); signal?.removeEventListener('abort', abort); pending.delete(id)
            if (error) reject(error)
            else resolve(result)
          },
        })
        signal?.addEventListener('abort', abort, { once: true })
        try { active.postMessage({ id, operation, image, ...options }) }
        catch { stop(new Error('No se pudo enviar la imagen al escáner. Intentá de nuevo.')) }
      })
    },
    dispose() { disposed = true; stop(cancelled()) },
  }
}
