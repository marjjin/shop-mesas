import { useState } from 'react'
import InvoiceIcon from './InvoiceIcon.jsx'
import { displayFileSize } from '../api/invoicesApi.js'

export default function ScannedPages({ pages, busy, onRemove, onMove }) {
  const [selected, setSelected] = useState(null)
  const preview = pages.find((page) => page.id === selected) || pages[0]
  return <section className="invoice-pages" aria-label="Revisión de las páginas escaneadas">
    <div className="invoice-section-title"><div><h3>Revisar escaneo</h3><p>Comprobá que el texto se lea completo antes de guardar.</p></div><span className="invoice-badge">{pages.length} / 10 páginas</span></div>
    <div className="invoice-page-preview"><img src={preview.url} alt={`Página ${pages.indexOf(preview) + 1} escaneada`} /></div>
    <ol className="invoice-thumbnails">{pages.map((page, index) => <li key={page.id} className={preview.id === page.id ? 'selected' : ''}><button type="button" className="invoice-thumbnail" aria-label={`Ver página ${index + 1}`} aria-pressed={preview.id === page.id} onClick={() => setSelected(page.id)}><img src={page.url} alt="" /><span>Página {index + 1}<small>{displayFileSize(page.blob.size)}</small></span></button><div><button type="button" className="invoice-icon-button" disabled={busy || index === 0} aria-label={`Mover página ${index + 1} antes`} onClick={() => onMove(index, -1)}><InvoiceIcon name="up" /></button><button type="button" className="invoice-icon-button" disabled={busy || index === pages.length - 1} aria-label={`Mover página ${index + 1} después`} onClick={() => onMove(index, 1)}><InvoiceIcon name="down" /></button><button type="button" className="invoice-icon-button danger" disabled={busy} aria-label={`Quitar página ${index + 1}`} onClick={() => onRemove(page)}><InvoiceIcon name="trash" /></button></div></li>)}</ol>
  </section>
}
