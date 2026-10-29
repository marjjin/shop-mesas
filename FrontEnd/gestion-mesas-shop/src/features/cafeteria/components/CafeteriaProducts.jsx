import { useEffect, useRef, useState } from 'react'
import { preciseMoney as money } from '../../../shared/utils/currency.js'
import { saleConfigurationTotal } from '../domain/cafeteriaView.js'
import CafeteriaIcon from './CafeteriaIcon.jsx'

export default function CafeteriaProducts({ cafeteria }) {
  const { dashboard, product, setProduct, editing, setEditing, busy, pendingAction, refreshing, loadError,
    addProduct, saveProduct, deleteProduct, message, dismissMessage } = cafeteria
  const [search, setSearch] = useState('')
  const [deleting, setDeleting] = useState(null)
  const nameRef = useRef(null)
  const editNameRef = useRef(null)
  const editButtons = useRef(new Map())
  const deleteDialogRef = useRef(null)
  const disabled = busy || refreshing || Boolean(loadError)
  const total = saleConfigurationTotal(dashboard.products)
  const normalize = (value) => value.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es-AR')
  const visibleProducts = dashboard.products.filter((item) => normalize(item.name).includes(normalize(search)))
  const validProduct = product.name.trim() && Number.isFinite(Number(product.price)) && Number(product.price) > 0
  const validEdit = editing?.name.trim() && Number.isFinite(Number(editing?.price)) && Number(editing?.price) > 0
  const editingId = editing?.id

  useEffect(() => { if (editingId != null) editNameRef.current?.focus() }, [editingId])

  const finishEditing = (id) => {
    setEditing(null)
    requestAnimationFrame(() => editButtons.current.get(id)?.focus())
  }
  const submitEdit = async (event) => {
    const id = editing.id
    if (await saveProduct(event)) {
      setSearch('')
      requestAnimationFrame(() => editButtons.current.get(id)?.focus())
    }
  }
  const submitNew = async (event) => {
    if (await addProduct(event)) { setSearch(''); requestAnimationFrame(() => nameRef.current?.focus()) }
  }
  const confirmDelete = async () => {
    if (busy || !deleting) return
    if (await deleteProduct(deleting)) {
      deleteDialogRef.current?.close()
      setDeleting(null)
    }
  }

  return <div className="cafeteria-products-layout">
    <section className="cafeteria-card cafeteria-products" aria-labelledby="cafeteria-products-title">
      <div className="cafeteria-section-heading"><span className="cafeteria-heading-icon"><CafeteriaIcon name="box" /></span><div><h2 id="cafeteria-products-title">Artículos incluidos</h2><p>Una unidad de cada artículo por venta.</p></div><span className="cafeteria-count">{dashboard.products.length} activos</span></div>
      <div className="cafeteria-sale-explainer"><span><CafeteriaIcon name="coffee" /></span><p>Cada clic en <b>Venta café</b>, desde el plano, registra todos los artículos de esta lista.</p></div>
      {dashboard.products.length > 0 && <div className="cafeteria-search"><CafeteriaIcon name="search" /><input type="search" aria-label="Buscar artículo de cafetería" placeholder="Buscar artículo…" value={search} onChange={(event) => setSearch(event.target.value)} disabled={Boolean(editing)} /></div>}
      <div className="cafeteria-product-list">
        {visibleProducts.map((item) => editing?.id === item.id ? <form className="cafeteria-edit" key={item.id} onSubmit={submitEdit} aria-label={`Editar ${item.name}`} aria-busy={pendingAction === 'edit'}>
          <div className="cafeteria-edit-fields"><label>Nombre del artículo<input ref={editNameRef} required maxLength="100" value={editing.name} disabled={disabled} onChange={(event) => setEditing({ ...editing, name: event.target.value })} /></label><label>Precio ($)<input required type="number" min="0.01" step="0.01" inputMode="decimal" value={editing.price} disabled={disabled} onChange={(event) => setEditing({ ...editing, price: event.target.value })} /></label></div>
          <div className="cafeteria-edit-actions"><button type="button" className="cafeteria-secondary" disabled={busy} onClick={() => finishEditing(item.id)}>Cancelar</button><button className="cafeteria-primary" disabled={disabled || !validEdit}><CafeteriaIcon name="check" />{pendingAction === 'edit' ? 'Guardando…' : 'Guardar cambios'}</button></div>
        </form> : <article className="cafeteria-product-row" key={item.id}><span className="cafeteria-product-icon"><CafeteriaIcon name="coffee" /></span><div className="cafeteria-product-name"><b>{item.name}</b><small>1 unidad por venta</small></div><strong>{money.format(item.price)}</strong><div className="cafeteria-row-actions"><button ref={(element) => { if (element) editButtons.current.set(item.id, element); else editButtons.current.delete(item.id) }} type="button" className="cafeteria-icon-button" disabled={disabled || Boolean(editing)} aria-label={`Editar ${item.name}`} title="Editar artículo" onClick={() => setEditing({ ...item })}><CafeteriaIcon name="edit" /></button><button type="button" className="cafeteria-icon-button danger" disabled={disabled || Boolean(editing)} aria-label={`Quitar ${item.name} de las próximas ventas`} title="Quitar artículo" onClick={() => { dismissMessage(); setDeleting(item); deleteDialogRef.current.showModal() }}><CafeteriaIcon name="trash" /></button></div></article>)}
        {!visibleProducts.length && <div className="cafeteria-empty"><CafeteriaIcon name={dashboard.products.length ? 'search' : 'coffee'} /><h3>{dashboard.products.length ? 'No encontramos ese artículo' : 'Todavía no hay artículos'}</h3><p>{dashboard.products.length ? 'Probá con otro nombre o limpiá la búsqueda.' : 'Agregá los artículos que se incluirán en cada venta de café.'}</p><button type="button" className="cafeteria-secondary" disabled={disabled} onClick={() => dashboard.products.length ? setSearch('') : nameRef.current?.focus()}>{dashboard.products.length ? 'Limpiar búsqueda' : 'Agregar primer artículo'}</button></div>}
      </div>
      <div className="cafeteria-sale-total"><div><b>Total por venta</b><span>{dashboard.products.length} {dashboard.products.length === 1 ? 'artículo incluido' : 'artículos incluidos'}</span></div><strong>{money.format(total)}</strong></div>
      <p className="cafeteria-footnote"><CafeteriaIcon name="info" />Los cambios se aplican a las próximas ventas. El historial conserva los importes originales.</p>
    </section>

    <section className="cafeteria-card cafeteria-create" aria-labelledby="cafeteria-create-title">
      <div className="cafeteria-section-heading"><span className="cafeteria-heading-icon accent"><CafeteriaIcon name="plus" /></span><div><h2 id="cafeteria-create-title">Agregar artículo</h2><p>Se incluirá en cada nueva venta.</p></div></div>
      <form onSubmit={submitNew} aria-busy={pendingAction === 'add'}><label htmlFor="cafeteria-new-name">Nombre del artículo</label><input ref={nameRef} id="cafeteria-new-name" required maxLength="100" autoComplete="off" placeholder="Ej.: Café con leche" value={product.name} disabled={disabled} onChange={(event) => setProduct({ ...product, name: event.target.value })} /><label htmlFor="cafeteria-new-price">Precio de venta</label><div className="cafeteria-price-input"><span>$</span><input id="cafeteria-new-price" required type="number" min="0.01" step="0.01" inputMode="decimal" placeholder="0,00" value={product.price} disabled={disabled} onChange={(event) => setProduct({ ...product, price: event.target.value })} /></div><p className="cafeteria-field-help">Importe por una unidad. No lleva control de stock.</p><button className="cafeteria-primary cafeteria-full-width" disabled={disabled || !validProduct}><CafeteriaIcon name="plus" />{pendingAction === 'add' ? 'Agregando…' : 'Agregar artículo'}</button></form>
      {validProduct && <div className="cafeteria-price-preview"><span>Nuevo total por venta</span><strong>{money.format(saleConfigurationTotal([...dashboard.products, { price: product.price }]))}</strong></div>}
    </section>

    <dialog ref={deleteDialogRef} className="cafeteria-dialog" aria-labelledby="cafeteria-delete-title" aria-describedby="cafeteria-delete-description" onCancel={(event) => { if (busy) event.preventDefault() }} onClose={() => setDeleting(null)}><span className="cafeteria-dialog-icon"><CafeteriaIcon name="trash" /></span><h2 id="cafeteria-delete-title">¿Quitar este artículo?</h2><p id="cafeteria-delete-description"><b>{deleting?.name}</b> dejará de incluirse en las próximas ventas de café. Las ventas ya registradas se conservarán.</p>{message?.type === 'error' && <div className="cafeteria-feedback error" role="alert"><CafeteriaIcon name="info" /><span>{message.text}</span></div>}<div className="cafeteria-dialog-actions"><button type="button" className="cafeteria-secondary" autoFocus disabled={busy} onClick={() => deleteDialogRef.current.close()}>Conservar artículo</button><button type="button" className="cafeteria-danger" disabled={disabled} onClick={confirmDelete}>{pendingAction === 'delete' ? 'Quitando…' : 'Quitar artículo'}</button></div></dialog>
  </div>
}
