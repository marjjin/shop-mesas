import { shifts } from './businessDate.js'

const closeDraftKey = (date, shift) => `mesa-cigarette-close-draft:${date}:${shift}`
export const closeContextKey = 'mesa-cigarette-close-context'

export function getCloseDraft(date, shift) {
  try {
    const draft = JSON.parse(localStorage.getItem(closeDraftKey(date, shift)) || 'null')
    return draft && (typeof draft.finalStocks === 'object' || typeof draft.endingBalances === 'object' || typeof draft.supplierAllocations === 'object') ? draft : null
  } catch {
    return null
  }
}

export function saveCloseDraft(date, shift, changes) {
  localStorage.setItem(closeDraftKey(date, shift), JSON.stringify({ ...getCloseDraft(date, shift), ...changes, savedAt: new Date().toISOString() }))
}

export function clearCloseDraft(date, shift) {
  localStorage.removeItem(closeDraftKey(date, shift))
}

export function getCloseContext() {
  try {
    const context = JSON.parse(sessionStorage.getItem(closeContextKey) || 'null')
    return context && /^\d{4}-\d{2}-\d{2}$/.test(context.date) && Object.hasOwn(shifts, context.shift) ? context : null
  } catch {
    return null
  }
}
