// Borradores de cierre en localStorage, por fecha y turno: sobreviven a recargar la página.
import { shifts } from './businessDate.js'

const closeDraftKey = (date, shift) => `mesa-cigarette-close-draft:${date}:${shift}`
export const closeContextKey = 'mesa-cigarette-close-context'

// Devuelve null si el borrador falta o está dañado.
export function getCloseDraft(date, shift) {
  try {
    const draft = JSON.parse(localStorage.getItem(closeDraftKey(date, shift)) || 'null')
    return draft && (typeof draft.cigaretteReservation === 'object' || typeof draft.finalStocks === 'object' || typeof draft.endingBalances === 'object' || typeof draft.supplierAllocations === 'object') ? draft : null
  } catch {
    return null
  }
}

// Combina los cambios con lo guardado: cada campo se actualiza por separado.
export function saveCloseDraft(date, shift, changes) {
  localStorage.setItem(closeDraftKey(date, shift), JSON.stringify({ ...getCloseDraft(date, shift), ...changes, savedAt: new Date().toISOString() }))
}

export function clearCloseDraft(date, shift) {
  localStorage.removeItem(closeDraftKey(date, shift))
}

// Última fecha y turno usados en esta pestaña.
export function getCloseContext() {
  try {
    const context = JSON.parse(sessionStorage.getItem(closeContextKey) || 'null')
    return context && /^\d{4}-\d{2}-\d{2}$/.test(context.date) && Object.hasOwn(shifts, context.shift) ? context : null
  } catch {
    return null
  }
}
