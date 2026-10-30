import { createOpenCvScanner } from './openCvScanner.js'

export function initializeOpenCv(module) {
  return new Promise((resolve, reject) => {
    const ready = (cv) => {
      try { resolve(createOpenCvScanner(cv)) }
      catch (error) { reject(error) }
    }
    if (typeof module.Mat === 'function') ready(module)
    // Older Emscripten modules are self-resolving thenables, not real Promises.
    // Awaiting that object recursively adopts itself and never finishes.
    else if (typeof module.then === 'function') { module.then(ready, reject) }
    else { module.onRuntimeInitialized = () => ready(module); module.onAbort = reject }
  })
}
