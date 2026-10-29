import { useEffect, useRef, useState } from 'react'
import { parseProductSearch } from '../../../shared/utils/productSearch.js'
import { findPendingProducts } from '../domain/pendingOrders.js'
import PendingIcon from './PendingIcon.jsx'

export default function PendingOrderCard({ order, data, api, load, onChooseTable, shouldFocusSearch, onSearchFocused }) {
  const [search, setSearch] = useState('')
  const [selectedProductIndex, setSelectedProductIndex] = useState(0)
  const [searchOpen, setSearchOpen] = useState(false)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [cancelError, setCancelError] = useState('')
  const searchInputRef = useRef(null)
  const productResultRefs = useRef([])
  const dialogRef = useRef(null)
  const actionRef = useRef(false)
  const items = (data.pendingOrderItems || [])
    .filter((item) => item.pendingOrderId === order.id)
    .map((item) => ({ ...item, product: data.products.find((product) => product.id === item.productId) }))
    .filter((item) => item.product)
  const itemCount = items.reduce((total, item) => total + item.quantity, 0)
  const availableTables = data.tables.filter((table) => table.status === 'free')
  const { quantity, query } = parseProductSearch(search)
  const products = findPendingProducts(data.products, query)
  const showResults = searchOpen && Boolean(search.trim())
  const selectedIndex = Math.min(selectedProductIndex, Math.max(0, products.length - 1))
  const createdAt = new Date(order.createdAt)
  const createdLabel = Number.isNaN(createdAt.getTime()) ? '' : createdAt.toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

  useEffect(() => {
    if (!shouldFocusSearch) return
    searchInputRef.current?.focus()
    onSearchFocused()
  }, [onSearchFocused, shouldFocusSearch])

  useEffect(() => {
    if (showResults) productResultRefs.current[selectedIndex]?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex, showResults])

  const addItem = async (productId) => {
    if (actionRef.current) return
    actionRef.current = true
    setBusy('add')
    setError('')
    try {
      await api(`/pending-orders/${order.id}/items`, { method: 'POST', body: JSON.stringify({ productId, quantity }) })
      setSearch('')
      setSelectedProductIndex(0)
      await load()
    } catch {
      setError('No se pudo agregar el artículo. Volvé a intentarlo.')
    } finally {
      actionRef.current = false
      setBusy('')
      searchInputRef.current?.focus()
    }
  }

  const removeItem = async (item) => {
    if (actionRef.current) return
    actionRef.current = true
    setBusy(`remove-${item.id}`)
    setError('')
    try {
      await api(`/pending-order-items/${item.id}`, { method: 'DELETE' })
      await load()
    } catch {
      setError('No se pudo quitar el artículo. Volvé a intentarlo.')
    } finally {
      actionRef.current = false
      setBusy('')
      searchInputRef.current?.focus()
    }
  }

  const cancelOrder = async () => {
    if (actionRef.current) return
    actionRef.current = true
    setBusy('cancel')
    setCancelError('')
    try {
      await api(`/pending-orders/${order.id}`, { method: 'DELETE' })
      dialogRef.current?.close()
      await load()
    } catch {
      setCancelError('No se pudo cancelar el pedido. Volvé a intentarlo.')
    } finally {
      actionRef.current = false
      setBusy('')
    }
  }

  const handleSearchKey = (event) => {
    if (event.key === 'Escape') { event.preventDefault(); setSearchOpen(false); return }
    if (!products.length) return
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      setSearchOpen(true)
      setSelectedProductIndex(Math.max(0, Math.min(selectedIndex + (event.key === 'ArrowDown' ? 1 : -1), products.length - 1)))
    }
    if (event.key === 'Enter' && search.trim()) {
      event.preventDefault()
      if (showResults) addItem(products[selectedIndex].id)
      else setSearchOpen(true)
    }
  }

  return <article className="pending-card" aria-labelledby={`pending-name-${order.id}`} aria-busy={Boolean(busy)}>
    <div className="pending-card-header">
      <span className="pending-customer-avatar"><PendingIcon name="user" /></span>
      <div className="pending-card-identity"><span className="pending-order-number">PEDIDO #{order.id}</span><h3 id={`pending-name-${order.id}`}>{order.customerName}</h3></div>
      <span className="pending-waiting-badge"><i />En espera</span>
    </div>
    {createdLabel && <div className="pending-card-time"><PendingIcon name="clock" /><time dateTime={order.createdAt}>Creado el {createdLabel}</time></div>}

    <div className="pending-search" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setSearchOpen(false) }}>
      <label htmlFor={`pending-search-${order.id}`}>Agregar artículos</label>
      <div className="pending-search-control">
      <div className="pending-input-wrap"><PendingIcon name="search" /><input ref={searchInputRef} id={`pending-search-${order.id}`} role="combobox" aria-autocomplete="list" aria-expanded={showResults} aria-controls={`pending-results-${order.id}`} aria-activedescendant={showResults && products.length ? `pending-option-${order.id}-${products[selectedIndex].id}` : undefined} aria-describedby={`pending-search-help-${order.id}`} autoComplete="off" value={search} readOnly={Boolean(busy)} onFocus={() => setSearchOpen(true)} onChange={(event) => { setSearch(event.target.value); setSelectedProductIndex(0); setSearchOpen(true) }} onKeyDown={handleSearchKey} placeholder="Buscar en artículos…" />{search && <button className="pending-clear-search" type="button" aria-label="Limpiar búsqueda de artículos" disabled={Boolean(busy)} onClick={() => { setSearch(''); searchInputRef.current?.focus() }}><PendingIcon name="close" /></button>}</div>
      {showResults && <div className="pending-results-panel"><div className="pending-results-heading"><span>{busy === 'add' ? 'Agregando…' : `${products.length} ${products.length === 1 ? 'resultado' : 'resultados'}`}</span><span>{quantity} {quantity === 1 ? 'unidad' : 'unidades'}</span></div><div className="pending-results" role="listbox" id={`pending-results-${order.id}`} aria-label="Artículos disponibles" aria-busy={busy === 'add'}>
        {products.length ? products.map((product, index) => <button type="button" role="option" tabIndex={-1} id={`pending-option-${order.id}-${product.id}`} ref={(element) => { productResultRefs.current[index] = element }} className={index === selectedIndex ? 'selected' : ''} aria-selected={index === selectedIndex} disabled={Boolean(busy)} key={product.id} onMouseEnter={() => setSelectedProductIndex(index)} onMouseDown={(event) => event.preventDefault()} onClick={() => addItem(product.id)}><span>{product.name}</span><b><PendingIcon name="plus" />{quantity === 1 ? 'Agregar' : quantity}</b></button>) : <p>No hay artículos con ese nombre.</p>}
      </div></div>}
      </div>
      <p id={`pending-search-help-${order.id}`} className="pending-search-help">Para agregar varios, escribí <b>2*café</b>. Elegí con ↑ ↓ y Enter.</p>
    </div>

    <div className="pending-items">
      <div className="pending-items-heading"><h4>Artículos del pedido</h4><span role="status">{busy && busy !== 'cancel' ? 'Guardando…' : `${itemCount} ${itemCount === 1 ? 'unidad' : 'unidades'}`}</span></div>
      {items.length ? <ul>{items.map((item) => <li key={item.id}><span className="pending-item-quantity">{item.quantity}×</span><span className="pending-item-name">{item.product.name}</span><button type="button" className="pending-remove-item" disabled={Boolean(busy)} aria-label={`Quitar ${item.product.name} del pedido`} title="Quitar artículo del pedido" onClick={() => removeItem(item)}><PendingIcon name="trash" /></button></li>)}</ul> : <div className="pending-items-empty"><PendingIcon name="box" /><p>Este pedido todavía no tiene artículos.<span>Buscá uno arriba para agregarlo.</span></p></div>}
    </div>

    <div className="pending-assignment">
      {error && <p className="pending-error" role="alert">{error}</p>}
      <button type="button" className="pending-primary pending-plan-button" disabled={Boolean(busy) || !availableTables.length} onClick={() => onChooseTable(order.id)}><PendingIcon name="table" />Elegir mesa<PendingIcon name="arrow" /></button>
      <p>{!availableTables.length ? 'No hay mesas libres en este momento.' : !items.length ? 'También podés asignar la mesa y cargar los artículos después.' : 'Los artículos se transfieren a la mesa que elijas.'}</p>
      <button type="button" className="pending-cancel" disabled={Boolean(busy)} onClick={() => { setCancelError(''); dialogRef.current.showModal() }}><PendingIcon name="trash" />Cancelar pedido</button>
    </div>

    <dialog ref={dialogRef} className="pending-cancel-dialog" aria-labelledby={`pending-cancel-title-${order.id}`} aria-describedby={`pending-cancel-description-${order.id}`} onCancel={(event) => { if (busy) event.preventDefault() }}>
      <span className="pending-dialog-icon"><PendingIcon name="trash" /></span><h2 id={`pending-cancel-title-${order.id}`}>¿Cancelar este pedido?</h2><p id={`pending-cancel-description-${order.id}`}>Se eliminará el pedido de <b>{order.customerName}</b> y sus artículos. Esta acción no se puede deshacer.</p>
      {cancelError && <p className="pending-error" role="alert">{cancelError}</p>}
      <div className="pending-dialog-actions"><button type="button" className="pending-secondary" autoFocus disabled={Boolean(busy)} onClick={() => dialogRef.current.close()}>Conservar pedido</button><button type="button" className="pending-danger" disabled={Boolean(busy)} onClick={cancelOrder}>{busy === 'cancel' ? 'Cancelando…' : 'Sí, cancelar'}</button></div>
    </dialog>
  </article>
}
