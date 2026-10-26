import { useEffect, useRef } from 'react'

export default function StockWarning({ rows, onClose }) {
  const dialogRef = useRef(null)
  useEffect(() => {
    const dialog = dialogRef.current
    dialog.showModal()
    return () => dialog.close()
  }, [])

  return <dialog ref={dialogRef} className="stock-warning-dialog" aria-labelledby="stock-warning-title" onCancel={onClose} onClose={onClose}>
    <button type="button" className="shift-alert-dismiss" aria-label="Cerrar aviso de stock" onClick={onClose}>×</button>
    <span className="stock-warning-badge">¡REVISÁ EL STOCK!</span>
    <h2 id="stock-warning-title">No se puede cerrar el turno</h2>
    <p>El stock final no puede superar el stock inicial más las compras del turno.</p>
    {rows.map((row) => <div className="stock-warning-product" key={row.id}><strong>{row.name}</strong><p>Stock final ingresado: <b>{row.final}</b>. Máximo permitido: <b>{row.initial + row.purchased}</b> (inicial {row.initial} + compras {row.purchased}).</p></div>)}
    <p>Corregí el stock final o registrá las compras faltantes. Los datos cargados no se borrarán.</p>
    <button type="button" className="primary" onClick={onClose}>Cerrar aviso y corregir</button>
  </dialog>
}
