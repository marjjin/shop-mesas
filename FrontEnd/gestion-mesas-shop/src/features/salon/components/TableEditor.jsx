import { useState } from 'react'

export default function TableEditor({ table, saveTable, deleteTable, addTable, finishEditing }) {
  const [name, setName] = useState(() => table?.name || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const saveName = async (event) => {
    event.preventDefault()
    const value = name.trim()
    if (!table || !value) return
    setSaving(true)
    setError('')
    try {
      await saveTable(table.id, { name: value })
    } catch {
      setError('No se pudo guardar el nombre. Intentá nuevamente.')
    } finally {
      setSaving(false)
    }
  }

  return <aside className="table-edit-panel" aria-live="polite">
    <div className="table-edit-toolbar">
      <div className="table-edit-heading">
        <p className="eyebrow">EDICIÓN DEL SALÓN</p>
        <h2>{table ? table.name : 'Elegí una mesa'}</h2>
      </div>
      <div className="editing-actions">
        <button type="button" className="add-table-button" onClick={addTable}><span aria-hidden="true">+</span> Agregar mesa</button>
        <button type="button" className="finish-editing-button" onClick={finishEditing}><span aria-hidden="true">✓</span> Finalizar</button>
      </div>
    </div>
    {table ? <>
      <form className="table-rename-form" onSubmit={saveName}>
        <div className="table-rename-label">
          <label htmlFor={`table-name-${table.id}`}>Nombre de la mesa</label>
          <span>Podés moverla o cambiar su tamaño directamente en el plano.</span>
        </div>
        <div className="table-name-actions">
          <input id={`table-name-${table.id}`} maxLength="80" autoFocus value={name} onChange={(event) => setName(event.target.value)} />
          <button className="dark" disabled={!name.trim() || saving}>{saving ? 'Guardando…' : 'Guardar'}</button>
        </div>
        <button type="button" className="delete-table-button" onClick={() => deleteTable(table)}>Eliminar mesa</button>
      </form>
      {error && <p className="error">{error}</p>}
    </> : <p className="table-edit-help">Seleccioná una mesa en el plano para cambiar su nombre, moverla o eliminarla.</p>}
  </aside>
}
