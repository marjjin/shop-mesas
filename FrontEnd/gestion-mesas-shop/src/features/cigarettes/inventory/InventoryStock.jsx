import { useEffect, useRef, useState } from 'react'
import { preciseMoney as money } from '../../../shared/utils/currency.js'
import { stockStatus } from '../domain/inventoryView.js'
import InventoryIcon from './InventoryIcon.jsx'
import InventoryConfirm from './InventoryConfirm.jsx'

const statusLabels = { available: 'Disponible', low: 'Bajo stock', out: 'Agotado' }
const filters = [['all', 'Todas'], ['available', 'Stock normal'], ['low', 'Bajo stock'], ['out', 'Agotadas']]

export default function InventoryStock({ dashboard, stockSearch, setStockSearch, setVisibleProductCount, visibleProducts,
  editing, saveProduct, setEditing, busy, deleteProduct, filteredProducts, visibleProductCount, addProduct, product, setProduct,
  stockFilter, setStockFilter, stockSort, setStockSort, message }) {
  const [removing, setRemoving] = useState(null)
  const [removeFailed, setRemoveFailed] = useState(false)
  const nameRef = useRef(null)
  const searchRef = useRef(null)
  const editRef = useRef(null)
  const editingId = editing?.id
  const counts = { all: dashboard.products.length, available: 0, low: 0, out: 0 }
  dashboard.products.forEach((item) => { counts[stockStatus(item.stock)] += 1 })
  const validNew = product.name.trim() && Number(product.price) > 0 && product.initialStock !== '' && Number.isInteger(Number(product.initialStock)) && Number(product.initialStock) >= 0
  const validEdit = editing?.name.trim() && Number(editing.price) > 0 && editing.stock !== '' && Number.isInteger(Number(editing.stock)) && Number(editing.stock) >= 0

  useEffect(() => { if (editingId != null) editRef.current?.focus() }, [editingId])
  const clearFilters = () => { setStockSearch(''); setStockFilter('all'); setVisibleProductCount(10) }
  const submitNew = async (event) => {
    if (await addProduct(event)) requestAnimationFrame(() => nameRef.current?.focus())
  }
  const submitEdit = async (event) => {
    if (await saveProduct(event)) requestAnimationFrame(() => searchRef.current?.focus())
  }
  const confirmRemoval = async () => {
    if (busy) return
    setRemoveFailed(false)
    if (await deleteProduct(removing)) {
      setRemoving(null)
      requestAnimationFrame(() => searchRef.current?.focus())
    } else setRemoveFailed(true)
  }

  return <div className="inv-workspace">
    <section className="inv-card inv-stock-card" aria-labelledby="inv-stock-heading">
      <div className="inv-section-heading"><span className="inv-heading-icon"><InventoryIcon name="box" /></span><div><h2 id="inv-stock-heading">Inventario actual</h2><p>Precios de venta y existencias por variedad.</p></div><span className="inv-count">{dashboard.products.length} variedades</span></div>
      <div className="inv-toolbar"><div className="inv-search"><InventoryIcon name="search" /><input ref={searchRef} type="search" autoComplete="off" aria-label="Buscar variedad de cigarrillos" placeholder="Buscar marca o presentación…" value={stockSearch} disabled={Boolean(editing)} onChange={(event) => { setStockSearch(event.target.value); setVisibleProductCount(10) }} /></div><label className="inv-sort"><span>Ordenar por</span><select value={stockSort} disabled={Boolean(editing)} onChange={(event) => { setStockSort(event.target.value); setVisibleProductCount(10) }}><option value="name">Nombre</option><option value="stock">Menor stock</option><option value="price">Mayor precio</option></select></label></div>
      <div className="inv-filters" role="group" aria-label="Filtrar por disponibilidad">{filters.map(([value, label]) => <button type="button" key={value} className={value} aria-pressed={stockFilter === value} disabled={Boolean(editing)} onClick={() => { setStockFilter(value); setVisibleProductCount(10) }}>{value !== 'all' && <i />}{label}<span>{counts[value]}</span></button>)}</div>
      {visibleProducts.length > 0 && <div className="inv-list-columns" aria-hidden="true"><span>Variedad</span><span>Precio unitario</span><span>Stock</span><span>Acciones</span></div>}
      <ul className="inv-stock-list">{visibleProducts.map((item) => editing?.id === item.id ? <li key={item.id}><form className="inv-edit" onSubmit={submitEdit} aria-label={`Editar ${item.name}`} aria-busy={busy}><h3>Editar variedad</h3><label>Marca y presentación<input ref={editRef} required maxLength="100" value={editing.name} disabled={busy} onChange={(event) => setEditing({ ...editing, name: event.target.value })} /></label><div className="inv-form-row"><label>Precio de venta ($)<input required type="number" min="0.01" step="0.01" inputMode="decimal" value={editing.price} disabled={busy} onChange={(event) => setEditing({ ...editing, price: event.target.value })} /></label><label>Stock actual<input required type="number" min="0" step="1" inputMode="numeric" value={editing.stock} disabled={busy} onChange={(event) => setEditing({ ...editing, stock: event.target.value })} /></label></div><p className="inv-footnote"><InventoryIcon name="info" />Editá el stock para corregir existencias. Las reposiciones se registran desde Compras.</p><div className="inv-edit-actions"><button type="button" className="inv-secondary" disabled={busy} onClick={() => { setEditing(null); requestAnimationFrame(() => searchRef.current?.focus()) }}>Cancelar</button><button className="inv-primary" disabled={busy || !validEdit}><InventoryIcon name="check" />{busy ? 'Guardando…' : 'Guardar cambios'}</button></div></form></li> : <li className="inv-stock-row" key={item.id}><div className="inv-product"><span className="inv-product-icon"><InventoryIcon name="stock" /></span><div><b>{item.name}</b><span className={`inv-status ${stockStatus(item.stock)}`}><i />{statusLabels[stockStatus(item.stock)]}</span></div></div><span className="inv-product-price">{money.format(item.price)}<small>por unidad</small></span><span className={`inv-product-stock ${stockStatus(item.stock)}`}><b>{item.stock}</b><small>unidades</small></span><div className="inv-row-actions"><button type="button" className="inv-icon-button" disabled={busy || Boolean(editing)} aria-label={`Editar ${item.name}`} title="Editar variedad" onClick={() => setEditing({ ...item })}><InventoryIcon name="edit" /></button><button type="button" className="inv-icon-button danger" disabled={busy || Boolean(editing)} aria-label={`Quitar ${item.name} del inventario`} title="Quitar variedad" onClick={() => { setRemoveFailed(false); setRemoving(item) }}><InventoryIcon name="trash" /></button></div></li>)}</ul>
      {!filteredProducts.length && <div className="inv-empty"><InventoryIcon name={dashboard.products.length ? 'search' : 'box'} /><h3>{dashboard.products.length ? 'No hay variedades que coincidan' : 'Todavía no hay variedades cargadas'}</h3><p>{dashboard.products.length ? 'Cambiá el filtro o buscá otra marca y presentación.' : 'Cargá el nombre, el precio y las unidades con las que comenzás.'}</p><button type="button" className="inv-secondary" onClick={() => dashboard.products.length ? clearFilters() : nameRef.current?.focus()}>{dashboard.products.length ? 'Limpiar filtros' : 'Cargar primera variedad'}</button></div>}
      {filteredProducts.length > 0 && <div className="inv-list-footer"><span role="status">Mostrando {visibleProducts.length} de {filteredProducts.length} variedades</span>{visibleProductCount < filteredProducts.length && <button type="button" className="inv-secondary" disabled={Boolean(editing)} onClick={() => setVisibleProductCount((count) => count + 10)}>Mostrar 10 más</button>}</div>}
    </section>
    <section className="inv-card inv-create" aria-labelledby="inv-create-heading"><div className="inv-section-heading"><span className="inv-heading-icon accent"><InventoryIcon name="plus" /></span><div><h2 id="inv-create-heading">Nueva variedad</h2><p>Agregá un producto al inventario.</p></div></div><form className="inv-form" onSubmit={submitNew} aria-busy={busy}><label>Marca y presentación<input ref={nameRef} required maxLength="100" autoComplete="off" placeholder="Ej.: Marlboro Box 20" value={product.name} disabled={busy} onChange={(event) => setProduct({ ...product, name: event.target.value })} /></label><div className="inv-form-row"><label>Precio de venta ($)<input required type="number" min="0.01" step="0.01" inputMode="decimal" placeholder="0,00" value={product.price} disabled={busy} onChange={(event) => setProduct({ ...product, price: event.target.value })} /></label><label>Stock inicial<input required type="number" min="0" step="1" inputMode="numeric" placeholder="0" value={product.initialStock} disabled={busy} onChange={(event) => setProduct({ ...product, initialStock: event.target.value })} /></label></div><button className="inv-primary inv-full" disabled={busy || !validNew}><InventoryIcon name="plus" />{busy ? 'Guardando…' : 'Agregar al inventario'}</button></form><p className="inv-footnote"><InventoryIcon name="info" />El stock inicial indica las unidades disponibles. Para ingresar nuevas compras, usá la sección Compras.</p></section>
    {removing && <InventoryConfirm title="¿Quitar esta variedad?" busy={busy} error={removeFailed ? message : ''} onDismiss={() => setRemoving(null)} onConfirm={confirmRemoval}><b>{removing.name}</b> dejará de aparecer entre las variedades activas. Revisá que sea el producto que querés quitar.</InventoryConfirm>}
  </div>
}
