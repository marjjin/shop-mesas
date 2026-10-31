// Estado del editor del ticket de cierre. draft es la copia sin guardar; null significa sin cambios.
import { useEffect, useState } from 'react'
import { addCustomBlock, createDefaultShiftTicketLayout, moveBlock, moveRow, normalizeShiftTicketLayout, removeBlock, toShiftTicketRequest, updateBlock, updateRow, validateShiftTicketLayout } from '../../printing/shiftTicketLayout.js'

const customId = () => `custom-${Math.random().toString(36).slice(2, 10)}`

export default function useShiftTicketEditor(api) {
  const [saved, setSaved] = useState(null)
  const [draft, setDraft] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [revision, setRevision] = useState(0)
  const [notice, setNotice] = useState(null)
  const [saving, setSaving] = useState(false)
  const loading = !saved && !loadError

  useEffect(() => {
    let cancelled = false
    api('/settings/shift-ticket', { cache: 'no-store' })
      .then((result) => { if (!cancelled) { setSaved(normalizeShiftTicketLayout(result.layout)); setLoadError('') } })
      .catch((error) => { if (!cancelled) setLoadError(error.message) })
    return () => { cancelled = true }
  }, [api, revision])

  const layout = draft ?? saved
  const error = layout ? validateShiftTicketLayout(layout) : ''
  const dirty = Boolean(draft) && JSON.stringify(draft) !== JSON.stringify(saved)
  // Cada operación recibe el diseño actual y devuelve uno nuevo.
  const change = (operation) => { setDraft(operation(layout)); setNotice(null) }

  const save = async (event) => {
    event.preventDefault()
    if (saving || !dirty || error) return
    setSaving(true)
    setNotice(null)
    try {
      const result = await api('/settings/shift-ticket', { method: 'PUT', body: JSON.stringify(toShiftTicketRequest(layout)) })
      setSaved(normalizeShiftTicketLayout(result.layout))
      setDraft(null)
      setNotice({ type: 'success', text: 'Diseño guardado. Se aplicará a los próximos tickets de cierre.' })
    } catch (failure) {
      setNotice({ type: 'error', text: failure.message || 'No se pudo guardar. Tus cambios siguen disponibles para reintentar.' })
    } finally {
      setSaving(false)
    }
  }

  return {
    layout, loading, loadError, error, dirty, saving, notice, save,
    setNotice,
    retry: () => { setLoadError(''); setRevision((value) => value + 1) },
    discard: () => { setDraft(null); setNotice(null) },
    restoreDefaults: () => change(createDefaultShiftTicketLayout),
    setMargin: (side, value) => change((current) => ({ ...current, margins: { ...current.margins, [side]: value } })),
    addBlock: (type) => change((current) => addCustomBlock(current, type, customId())),
    updateBlock: (id, changes) => change((current) => updateBlock(current, id, changes)),
    updateRow: (blockId, rowId, changes) => change((current) => updateRow(current, blockId, rowId, changes)),
    moveBlock: (id, offset) => change((current) => moveBlock(current, id, offset)),
    moveRow: (blockId, rowId, offset) => change((current) => moveRow(current, blockId, rowId, offset)),
    removeBlock: (id) => change((current) => removeBlock(current, id)),
  }
}
