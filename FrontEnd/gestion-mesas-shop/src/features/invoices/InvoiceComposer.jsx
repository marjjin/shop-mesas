import { useEffect, useRef, useState } from 'react'
import InvoiceDialog from './ui/InvoiceDialog.jsx'
import InvoiceMetadataFields from './ui/InvoiceMetadataFields.jsx'
import ScannedPages from './ui/ScannedPages.jsx'
import CameraCapture from './scanner/CameraCapture.jsx'
import ScanCropEditor from './scanner/ScanCropEditor.jsx'
import { readScanSource, createScannedPage } from './scanner/scanClient.js'
import { createScanWorkerClient } from './scanner/scanWorkerClient.js'
import { buildInvoicePdf } from './documents/buildInvoicePdf.js'
import { displayFileSize, uploadInvoice } from './api/invoicesApi.js'
import { localDateInput } from '../../shared/utils/date.js'
import InvoiceIcon from './ui/InvoiceIcon.jsx'

export default function InvoiceComposer({ api, suppliers, initialSupplierId, onClose, onSaved }) {
  const [metadata, setMetadata] = useState({ supplierId: initialSupplierId || '', issueDate: localDateInput(), reference: '', note: '' })
  const [pages, setPages] = useState([])
  const [source, setSource] = useState(null)
  const [adding, setAdding] = useState(true)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const urls = useRef(new Set())
  const operation = useRef(null)
  const mounted = useRef(false)
  const lock = useRef(false)
  const scanner = useRef(null)
  useEffect(() => {
    mounted.current = true
    const client = createScanWorkerClient()
    scanner.current = client
    const ownedUrls = urls.current
    return () => { mounted.current = false; operation.current?.abort(); client.dispose(); for (const url of ownedUrls) URL.revokeObjectURL(url); ownedUrls.clear() }
  }, [])
  const release = (url) => { URL.revokeObjectURL(url); urls.current.delete(url) }
  const image = async (file) => {
    if (lock.current) return
    lock.current = true; setBusy(true); setError(''); setStatus('Preparando escáner y detectando bordes…')
    const controller = new AbortController(); operation.current = controller
    try {
      const value = await readScanSource(file, controller.signal, scanner.current)
      if (!mounted.current) { URL.revokeObjectURL(value.url); return }
      urls.current.add(value.url); setSource(value)
    } catch (failure) { if (mounted.current && failure.name !== 'AbortError') setError(failure.message) }
    finally { lock.current = false; if (mounted.current) { setBusy(false); setStatus('') } }
  }
  const apply = async (corners, mode) => {
    if (lock.current) return
    lock.current = true; setBusy(true); setError(''); setStatus('Corrigiendo perspectiva y comprimiendo la página…')
    const controller = new AbortController(); operation.current = controller
    try {
      const page = await createScannedPage(source, corners, mode, controller.signal, scanner.current)
      if (!mounted.current) { URL.revokeObjectURL(page.url); return }
      urls.current.add(page.url); setPages((current) => [...current, page]); release(source.url); setSource(null); setAdding(false)
    } catch (failure) { if (mounted.current && failure.name !== 'AbortError') setError(failure.message) }
    finally { lock.current = false; if (mounted.current) { setBusy(false); setStatus('') } }
  }
  const removePage = (page) => { release(page.url); const remaining = pages.filter((item) => item.id !== page.id); setPages(remaining); if (!remaining.length) setAdding(true) }
  const movePage = (index, offset) => { const next = [...pages]; [next[index], next[index + offset]] = [next[index + offset], next[index]]; setPages(next) }
  const close = () => { if (!busy && (!(pages.length || source) || window.confirm('¿Descartar este escaneo sin guardar?'))) onClose() }
  const save = async (event) => {
    event.preventDefault()
    if (lock.current || !pages.length) return
    lock.current = true; setBusy(true); setError(''); setStatus('Preparando PDF comprimido…')
    try {
      const blob = await buildInvoicePdf(pages)
      if (!mounted.current) return
      setStatus('Guardando factura…')
      const saved = await uploadInvoice(api, metadata, pages, blob)
      if (mounted.current) onSaved(saved)
    } catch (failure) { if (mounted.current) setError(failure.message || 'No se pudo guardar la factura. El escaneo se conserva para reintentar.') }
    finally { lock.current = false; if (mounted.current) { setBusy(false); setStatus('') } }
  }
  const compressed = pages.reduce((total, page) => total + page.blob.size, 0)
  const original = pages.reduce((total, page) => total + page.originalBytes, 0)
  return <InvoiceDialog title="Nueva factura" subtitle="Escaneá el documento, revisá las páginas y asigná un proveedor." onClose={close} busy={busy} wide>
    <ol className="invoice-steps" aria-label="Etapas del registro"><li aria-current={adding ? 'step' : undefined}><span>1</span>Escanear</li><li aria-current={!adding ? 'step' : undefined}><span>2</span>Revisar y asignar</li><li><span>3</span>Guardar PDF</li></ol>
    {error && <p className="invoice-error" role="alert">{error}</p>}
    {status && <p className="invoice-progress" role="status">{status}</p>}
    {adding ? source ? <ScanCropEditor key={source.url} source={source} busy={busy} onApply={apply} onCancel={() => { release(source.url); setSource(null); setError('') }} /> : <><CameraCapture onImage={image} busy={busy} />{pages.length > 0 && <button type="button" className="invoice-button secondary" disabled={busy} onClick={() => setAdding(false)}>Volver a las {pages.length} páginas escaneadas</button>}</> : <form onSubmit={save} className="invoice-review-form">
      <div className="invoice-review-grid"><div><ScannedPages pages={pages} busy={busy} onRemove={removePage} onMove={movePage} /><button type="button" className="invoice-button secondary invoice-add-page" disabled={busy || pages.length >= 10} onClick={() => { setAdding(true); setError('') }}><InvoiceIcon name="plus" />Agregar otra página</button></div><div className="invoice-review-data"><InvoiceMetadataFields value={metadata} onChange={setMetadata} suppliers={suppliers} disabled={busy} /><div className="invoice-compression"><InvoiceIcon name="storage" /><div><b>Páginas comprimidas: {displayFileSize(compressed)}</b><span>Imágenes originales: {displayFileSize(original)}</span><small>Se guardará un único PDF con {pages.length} {pages.length === 1 ? 'página' : 'páginas'}.</small></div></div></div></div>
      <footer className="invoice-dialog-actions"><button type="button" className="invoice-button secondary" disabled={busy} onClick={close}>Cancelar</button><button className="invoice-button primary" disabled={busy || !metadata.supplierId}><InvoiceIcon name="check" />{busy ? 'Guardando…' : 'Guardar factura'}</button></footer>
    </form>}
  </InvoiceDialog>
}
