import { useEffect, useRef } from 'react'
import InventoryIcon from './InventoryIcon.jsx'

export default function InventoryConfirm({ title, children, busy, error, onConfirm, onDismiss }) {
  const dialogRef = useRef(null)
  useEffect(() => { dialogRef.current.showModal() }, [])
  return <dialog ref={dialogRef} className="inv-dialog" aria-labelledby="inv-confirm-title" aria-describedby="inv-confirm-description" onCancel={(event) => { if (busy) event.preventDefault() }} onClose={onDismiss}>
    <span className="inv-dialog-icon"><InventoryIcon name="trash" /></span><h2 id="inv-confirm-title">{title}</h2><p id="inv-confirm-description">{children}</p>
    {error && <p role="alert" className="inv-error">{error}</p>}
    <div className="inv-dialog-actions"><button type="button" className="inv-secondary" autoFocus disabled={busy} onClick={() => dialogRef.current.close()}>Cancelar</button><button type="button" className="inv-danger" disabled={busy} onClick={onConfirm}>{busy ? 'Quitando…' : 'Confirmar y quitar'}</button></div>
  </dialog>
}
