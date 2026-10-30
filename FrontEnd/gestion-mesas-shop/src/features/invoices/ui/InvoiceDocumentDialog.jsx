import { useEffect, useState } from 'react'
import InvoiceDialog from './InvoiceDialog.jsx'
import InvoiceIcon from './InvoiceIcon.jsx'
import { loadInvoiceDocument } from '../api/invoicesApi.js'

export default function InvoiceDocumentDialog({ api, invoice, onClose }) {
  const [result, setResult] = useState(null)
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    let active = true, url
    loadInvoiceDocument(api, invoice.id, controller.signal)
      .then((blob) => { if (active) { url = URL.createObjectURL(blob); setResult({ url, retry }) } })
      .catch((error) => { if (active) setResult({ error: error.message, retry }) })
    return () => { active = false; controller.abort(); if (url) URL.revokeObjectURL(url) }
  }, [api, invoice.id, retry])
  const current = result?.retry === retry
  return <InvoiceDialog title={invoice.reference || `Factura #${invoice.id}`} subtitle={invoice.supplierName} onClose={onClose} wide>
    {!current ? <p className="invoice-progress" role="status">Cargando documento…</p> : result.error ? <div className="invoice-error" role="alert"><p>{result.error}</p><button type="button" className="invoice-button secondary" onClick={() => setRetry((value) => value + 1)}>Reintentar</button></div> : <><div className="invoice-document-actions"><a className="invoice-button secondary" href={result.url} target="_blank" rel="noopener noreferrer">Abrir PDF</a><a className="invoice-button primary" href={result.url} download={`factura-${invoice.id}.pdf`}><InvoiceIcon name="download" />Descargar PDF</a></div><iframe className="invoice-document-view" src={result.url} title={`Documento ${invoice.reference || invoice.id}`} /></>}
  </InvoiceDialog>
}
