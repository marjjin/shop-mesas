// Editor del ticket de cierre de turno: orden, visibilidad, textos, márgenes y bloques propios.
import { useState } from 'react'
import useShiftTicketEditor from '../hooks/useShiftTicketEditor.js'
import { sampleClose, sampleSuppliers } from '../domain/shiftTicketSample.js'
import { cigaretteShiftReceiptMarkup } from '../../printing/templates/shiftReceipt.js'
import { defaultShiftTicketBlock } from '../../printing/shiftTicketLayout.js'
import { SettingsSkeleton } from '../../../shared/components/LoadingSkeleton.jsx'
import Icon from './SettingsIcon.jsx'
import './ShiftTicketSettings.css'

const marginFields = [['top', 'Superior'], ['right', 'Derecho'], ['bottom', 'Inferior'], ['left', 'Izquierdo']]
const customNames = { text: 'Texto libre', signature: 'Línea de firma' }
// Tamaño de la vista previa: el papel real no cambia.
const previewScale = 0.8

function MoveButtons({ name, disabled, first, last, onMove }) {
  return <span className="shift-ticket-move">
    <button type="button" aria-label={`Subir ${name}`} title="Subir" disabled={disabled || first} onClick={() => onMove(-1)}>↑</button>
    <button type="button" aria-label={`Bajar ${name}`} title="Bajar" disabled={disabled || last} onClick={() => onMove(1)}>↓</button>
  </span>
}

function BlockEditor({ block, editor, disabled }) {
  const custom = block.type !== 'section'
  const fixedTitle = block.id === 'header' || block.id === 'meta' || block.id === 'salesTotal' || block.id === 'footer'
  return <div className="shift-ticket-block-content">
    {!custom && !fixedTitle && <label className="settings-text-field">Título<input maxLength={100} disabled={disabled} value={block.title} placeholder="Sin título" onChange={(event) => editor.updateBlock(block.id, { title: event.target.value })} /></label>}
    {block.type === 'text' && <label className="settings-text-field">Título opcional<input maxLength={100} disabled={disabled} value={block.title} onChange={(event) => editor.updateBlock(block.id, { title: event.target.value })} /></label>}
    {block.type === 'signature' && <label className="settings-text-field">Texto debajo de la línea<input maxLength={100} disabled={disabled} value={block.title} onChange={(event) => editor.updateBlock(block.id, { title: event.target.value })} /></label>}
    {block.type === 'text' && <label className="settings-text-field">Texto<textarea rows="3" maxLength={1000} disabled={disabled} value={block.text} onChange={(event) => editor.updateBlock(block.id, { text: event.target.value })} /></label>}
    {block.rows.length > 0 && <ul className="shift-ticket-rows" aria-label={`Renglones de ${block.name ?? block.title}`}>{block.rows.map((row, index) => {
      const original = defaultShiftTicketBlock(block.id)?.rows.find(({ id }) => id === row.id)?.label ?? row.id
      return <li key={row.id} className={row.visible ? '' : 'is-hidden'}>
        <input type="checkbox" aria-label={`Mostrar ${original}`} title="Mostrar en el ticket" disabled={disabled} checked={row.visible} onChange={(event) => editor.updateRow(block.id, row.id, { visible: event.target.checked })} />
        <input type="text" aria-label={`Etiqueta de ${original}`} maxLength={100} disabled={disabled} value={row.label} placeholder={original} onChange={(event) => editor.updateRow(block.id, row.id, { label: event.target.value })} />
        <MoveButtons name={original} disabled={disabled} first={index === 0} last={index === block.rows.length - 1} onMove={(offset) => editor.moveRow(block.id, row.id, offset)} />
      </li>
    })}</ul>}
    {custom && <button type="button" className="shift-ticket-remove" disabled={disabled} onClick={() => editor.removeBlock(block.id)}>Quitar bloque</button>}
  </div>
}

export default function ShiftTicketSettings({ api }) {
  const editor = useShiftTicketEditor(api)
  const { layout, loading, loadError, error, dirty, saving, notice } = editor
  const [openBlock, setOpenBlock] = useState(null)
  const [previewHeight, setPreviewHeight] = useState(900)

  return <section className="settings-card shift-ticket-card" aria-labelledby="shift-ticket-title" aria-busy={loading || saving}>
    <div className="settings-card-heading">
      <span className="settings-icon"><Icon name="receipt" /></span>
      <div><h2 id="shift-ticket-title">Ticket de cierre de turno</h2><p>Ordená, ocultá y renombrá los datos del ticket. Los importes salen siempre del cierre.</p></div>
      <span className="settings-card-badge">PERSONALIZACIÓN</span>
    </div>
    {loading ? <SettingsSkeleton /> : !layout ? <div className="settings-editor"><div className="settings-notice error" role="alert"><Icon name="info" /><div><p>{loadError}</p><button type="button" onClick={editor.retry}>Volver a cargar</button></div></div></div> : <>
      <div className="settings-workspace">
        <form id="shift-ticket-form" className="settings-editor" onSubmit={editor.save} noValidate>
          <div className="settings-editor-heading"><span className="settings-overline">MÁRGENES EN MILÍMETROS</span><span className={'settings-status' + (dirty ? ' pending' : '')} role="status">{saving ? 'Guardando…' : dirty ? 'Sin guardar' : 'Todo guardado'}</span></div>
          <div className="shift-ticket-margins">{marginFields.map(([side, label]) => <label key={side}>{label}<input type="number" min="0" max="20" step="0.5" inputMode="decimal" disabled={saving} value={layout.margins[side]} onChange={(event) => editor.setMargin(side, event.target.value)} /></label>)}</div>
          <div className="settings-editor-heading shift-ticket-blocks-heading"><span className="settings-overline">BLOQUES DEL TICKET</span><div className="shift-ticket-add"><button type="button" disabled={saving} onClick={() => editor.addBlock('text')}>+ Texto</button><button type="button" disabled={saving} onClick={() => editor.addBlock('signature')}>+ Firma</button></div></div>
          <div className="settings-section-list">{layout.blocks.map((block, index) => {
            const name = block.name ?? customNames[block.type]
            const open = openBlock === block.id
            return <div key={block.id} className={'settings-section' + (open ? ' is-open' : '') + (block.visible ? '' : ' shift-ticket-hidden')}>
              <div className="shift-ticket-block-header">
                <input type="checkbox" aria-label={`Mostrar ${name}`} title="Mostrar en el ticket" disabled={saving} checked={block.visible} onChange={(event) => editor.updateBlock(block.id, { visible: event.target.checked })} />
                <button type="button" className="shift-ticket-block-toggle" aria-expanded={open} onClick={() => setOpenBlock(open ? null : block.id)}><strong>{name}</strong><span>{open ? 'Ocultar opciones' : 'Editar'}</span></button>
                <MoveButtons name={name} disabled={saving} first={index === 0} last={index === layout.blocks.length - 1} onMove={(offset) => editor.moveBlock(block.id, offset)} />
              </div>
              {open && <BlockEditor block={block} editor={editor} disabled={saving} />}
            </div>
          })}</div>
          <p className="settings-editor-note"><Icon name="info" />Cafetería, Proveedores y Tiradas no se imprimen en los turnos sin esos movimientos.</p>
        </form>
        <aside className="settings-preview" aria-label="Vista previa del ticket de cierre"><div className="settings-preview-content">
          <div className="settings-preview-heading"><span><Icon name="eye" /> TU TICKET</span><small>Datos de ejemplo</small></div>
          {/* Sin allow-scripts: el contenido no puede ejecutar código. allow-same-origin permite medir su altura. */}
          <div className="shift-ticket-paper"><div className="shift-ticket-sheet" style={{ '--preview-scale': previewScale, height: (previewHeight + 2) * previewScale }}><iframe title="Vista previa del ticket de cierre" sandbox="allow-same-origin" scrolling="no" tabIndex={-1} style={{ height: previewHeight }} srcDoc={cigaretteShiftReceiptMarkup(sampleClose, sampleSuppliers, layout, { autoPrint: false })} onLoad={(event) => setPreviewHeight(event.currentTarget.contentDocument.body.scrollHeight)} /></div></div>
          <p className="settings-preview-caption">{dirty ? 'Vista previa · cambios todavía sin guardar' : 'Así se verá el próximo ticket de cierre.'}</p>
        </div></aside>
      </div>
      <div className={'settings-actionbar' + (dirty ? ' has-changes' : '')}>
        <div className={'settings-action-status' + (notice?.type === 'error' || error ? ' error' : notice?.type === 'success' ? ' success' : '')} role={notice?.type === 'error' || error ? 'alert' : 'status'}>
          <Icon name={notice?.type === 'error' || error ? 'info' : 'check'} />
          <div><strong>{error || notice?.text || (dirty ? 'Hay cambios sin guardar' : 'Sin cambios pendientes')}</strong></div>
        </div>
        <div className="settings-form-actions">
          <button type="button" className="settings-discard" disabled={saving} onClick={editor.restoreDefaults}>Restablecer</button>
          <button type="button" className="settings-discard" disabled={!dirty || saving} onClick={editor.discard}>Descartar</button>
          <button type="submit" form="shift-ticket-form" className="settings-save" disabled={!dirty || Boolean(error) || saving}><Icon name="check" />{saving ? 'Guardando…' : 'Guardar cambios'}</button>
        </div>
      </div>
    </>}
  </section>
}
