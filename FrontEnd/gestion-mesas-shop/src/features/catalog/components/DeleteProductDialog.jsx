import { useEffect, useRef } from 'react'
import CatalogIcon from './CatalogIcon.jsx'

export default function DeleteProductDialog({ item, count, busy, error, onCancel, onConfirm }) {
  const dialogRef = useRef(null)
  const cancelRef = useRef(null)

  useEffect(() => {
    const dialog = dialogRef.current
    dialog.showModal()
    cancelRef.current.focus()
    return () => dialog.close()
  }, [])

  return <dialog ref={dialogRef} className="catalog-delete-dialog" aria-labelledby="catalog-delete-title" aria-describedby="catalog-delete-description" aria-busy={busy} onCancel={(event) => { event.preventDefault(); if (!busy) onCancel() }}>
    <span className="catalog-dialog-icon"><CatalogIcon name="trash" /></span>
    <h2 id="catalog-delete-title">{item.all ? '¿Eliminar todos los artículos?' : '¿Eliminar este artículo?'}</h2>
    <p id="catalog-delete-description">{item.all ? `Se eliminarán ${count} ${count === 1 ? 'artículo disponible' : 'artículos disponibles'} y se quitarán de los pedidos en curso. Los servicios automáticos de coworking se conservarán.` : `“${item.name}” dejará de estar disponible y se quitará de los pedidos en curso.`} Esta acción no se puede deshacer.</p>
    {error && <p className="catalog-dialog-error" role="alert">{error}</p>}
    <div className="catalog-dialog-actions"><button ref={cancelRef} type="button" disabled={busy} onClick={onCancel}>Cancelar</button><button type="button" className="catalog-confirm-delete" disabled={busy} onClick={onConfirm}>{busy ? 'Eliminando…' : item.all ? 'Eliminar artículos' : 'Eliminar artículo'}</button></div>
  </dialog>
}
