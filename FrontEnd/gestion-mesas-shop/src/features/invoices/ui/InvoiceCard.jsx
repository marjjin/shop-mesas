import InvoiceIcon from './InvoiceIcon.jsx'
import { displayFileSize } from '../api/invoicesApi.js'

export default function InvoiceCard({ invoice, disabled, onRead, onEdit, onRemove }) {
  const name = invoice.reference || `Factura #${invoice.id}`
  const date = new Date(`${invoice.issueDate}T12:00:00`).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })
  return <article className="invoice-document-card">
    <div className="invoice-file-heading"><span className="invoice-file-icon"><InvoiceIcon name="file" /><small>PDF</small></span><span className="invoice-badge">{invoice.pageCount} {invoice.pageCount === 1 ? 'página' : 'páginas'}</span></div>
    <h3>{name}</h3>
    <p className="invoice-supplier-name"><InvoiceIcon name="supplier" />{invoice.supplierName}</p>
    <dl className="invoice-file-details"><div><dt>Fecha de factura</dt><dd>{date}</dd></div><div><dt>Tamaño</dt><dd>{displayFileSize(invoice.sizeBytes)}</dd></div></dl>
    <p className="invoice-note" title={invoice.note}>{invoice.note || 'Sin observaciones'}</p>
    <footer>
      <button type="button" className="invoice-button secondary" disabled={disabled} onClick={() => onRead(invoice)}><InvoiceIcon name="file" />Ver PDF</button>
      <button type="button" className="invoice-icon-button" disabled={disabled} title="Editar datos" aria-label={`Editar ${name}`} onClick={() => onEdit(invoice)}><InvoiceIcon name="edit" /></button>
      <button type="button" className="invoice-icon-button danger" disabled={disabled} title="Eliminar factura" aria-label={`Eliminar ${name}`} onClick={() => onRemove(invoice)}><InvoiceIcon name="trash" /></button>
    </footer>
  </article>
}
