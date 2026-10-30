import { useRef, useState } from 'react'
import InvoiceDialog from './InvoiceDialog.jsx'
import InvoiceMetadataFields from './InvoiceMetadataFields.jsx'

export default function EditInvoiceDialog({ invoice, suppliers, api, onClose, onSaved }) {
  const [value, setValue] = useState({ supplierId: invoice.supplierId, issueDate: invoice.issueDate, reference: invoice.reference, note: invoice.note })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const lock = useRef(false)
  const save = async (event) => {
    event.preventDefault()
    if (lock.current) return
    lock.current = true; setBusy(true); setError('')
    try { const saved = await api(`/invoices/${invoice.id}`, { method: 'PUT', body: JSON.stringify({ ...value, supplierId: Number(value.supplierId) }) }); onSaved(saved) }
    catch (failure) { setError(failure.message) }
    finally { lock.current = false; setBusy(false) }
  }
  return <InvoiceDialog title="Editar factura" subtitle="Podés corregir los datos o asignar otro proveedor." onClose={onClose} busy={busy}><form onSubmit={save}><InvoiceMetadataFields value={value} onChange={setValue} suppliers={suppliers} disabled={busy} />{error && <p className="invoice-error" role="alert">{error}</p>}<footer className="invoice-dialog-actions"><button type="button" className="invoice-button secondary" disabled={busy} onClick={onClose}>Cancelar</button><button className="invoice-button primary" disabled={busy}>{busy ? 'Guardando…' : 'Guardar cambios'}</button></footer></form></InvoiceDialog>
}
