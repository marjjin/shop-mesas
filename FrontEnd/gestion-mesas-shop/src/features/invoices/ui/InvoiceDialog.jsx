import { useEffect, useRef } from 'react'
import InvoiceIcon from './InvoiceIcon.jsx'

export default function InvoiceDialog({ title, subtitle, busy = false, onClose, children, wide = false }) {
  const ref = useRef(null)
  useEffect(() => {
    const dialog = ref.current
    const previousOverflow = document.body.style.overflow
    dialog.showModal(); document.body.style.overflow = 'hidden'
    return () => { dialog.close(); document.body.style.overflow = previousOverflow }
  }, [])
  return <dialog ref={ref} className={`invoice-dialog${wide ? ' wide-dialog' : ''}`} aria-labelledby="invoice-dialog-title" onCancel={(event) => { event.preventDefault(); if (!busy) onClose() }}>
    <header className="invoice-dialog-heading"><div><h2 id="invoice-dialog-title">{title}</h2>{subtitle && <p>{subtitle}</p>}</div><button type="button" className="invoice-icon-button" aria-label="Cerrar" disabled={busy} onClick={onClose}><InvoiceIcon name="close" /></button></header>
    {children}
  </dialog>
}
