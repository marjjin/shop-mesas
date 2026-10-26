import { useEffect, useRef, useState } from 'react'
import { parseProductSearch } from '../../../shared/utils/productSearch.js'
import { isCoworkingService } from '../../../shared/utils/products.js'

export default function PendingOrderCard({ order, data, api, load, onChooseTable, shouldFocusSearch, onSearchFocused }) {
  const [search, setSearch] = useState('')
  const [selectedProductIndex, setSelectedProductIndex] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const searchInputRef = useRef(null)
  const productResultRefs = useRef([])
  const items = (data.pendingOrderItems || [])
    .filter((item) => item.pendingOrderId === order.id)
    .map((item) => ({ ...item, product: data.products.find((product) => product.id === item.productId) }))
    .filter((item) => item.product)
  const availableTables = data.tables.filter((table) => table.status === 'free')
  const { quantity, query } = parseProductSearch(search)
  const products = data.products.filter((product) => !isCoworkingService(product))
    .filter((product) => product.name.toLowerCase().includes(query.toLowerCase()))

  useEffect(() => {
    if (!shouldFocusSearch) return
    searchInputRef.current?.focus()
    onSearchFocused()
  }, [onSearchFocused, shouldFocusSearch])

  useEffect(() => {
    productResultRefs.current[selectedProductIndex]?.scrollIntoView({ block: 'nearest' })
  }, [selectedProductIndex])

  const addItem = async (productId) => {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      await api(`/pending-orders/${order.id}/items`, { method: 'POST', body: JSON.stringify({ productId, quantity }) })
      setSearch('')
      await load()
    } catch {
      setError('No se pudo agregar el artículo.')
    } finally {
      setBusy(false)
      searchInputRef.current?.focus()
    }
  }

  const removeItem = async (item) => {
    setError('')
    try {
      await api(`/pending-order-items/${item.id}`, { method: 'DELETE' })
      await load()
    } catch {
      setError('No se pudo quitar el artículo.')
    }
  }

  const cancelOrder = async () => {
    if (!window.confirm(`¿Cancelar el pedido de ${order.customerName}?`)) return
    setBusy(true)
    try {
      await api(`/pending-orders/${order.id}`, { method: 'DELETE' })
      await load()
    } catch {
      setError('No se pudo cancelar el pedido.')
    } finally {
      setBusy(false)
    }
  }

  return <article className="pending-card">
    <header className="pending-card-header">
      <div><small>PEDIDO #{order.id}</small><h2>{order.customerName}</h2></div>
      <button type="button" className="pending-cancel" disabled={busy} onClick={cancelOrder}>Cancelar</button>
    </header>

    <div className="pending-search">
      <label htmlFor={`pending-search-${order.id}`}>Agregar artículos</label>
      <input ref={searchInputRef} id={`pending-search-${order.id}`} value={search} onChange={(event) => { setSearch(event.target.value); setSelectedProductIndex(0) }} onKeyDown={(event) => {
        if (!products.length) return
        if (event.key === 'ArrowDown') { event.preventDefault(); setSelectedProductIndex((index) => Math.min(index + 1, products.length - 1)) }
        if (event.key === 'ArrowUp') { event.preventDefault(); setSelectedProductIndex((index) => Math.max(index - 1, 0)) }
        if (event.key === 'Enter') { event.preventDefault(); addItem((products[selectedProductIndex] || products[0]).id) }
      }} placeholder="Buscar artículo o 2*medialunas..." title="Usá ↑ ↓ para elegir y Enter para agregar" />
      {search.trim() && <div className="pending-results">
        {products.length ? products.map((product, index) => <button type="button" ref={(element) => { productResultRefs.current[index] = element }} className={index === selectedProductIndex ? 'selected' : ''} aria-selected={index === selectedProductIndex} key={product.id} onMouseEnter={() => setSelectedProductIndex(index)} onClick={() => addItem(product.id)}><span>{product.name}</span><b>{quantity === 1 ? 'Agregar' : `Agregar ${quantity}`}</b></button>) : <p>No se encontraron artículos.</p>}
      </div>}
    </div>

    <div className="pending-items">
      <h3>Pedido</h3>
      {items.length ? items.map((item) => <div key={item.id}><span><small>{item.quantity}×</small>{item.product.name}</span><button type="button" title="Quitar artículo" onClick={() => removeItem(item)}>×</button></div>) : <p>Todavía no agregaste artículos.</p>}
    </div>

    <div className="pending-assignment">
      <label>Asignar cuando elijan mesa</label>
      <button type="button" className="primary pending-plan-button" disabled={busy || !availableTables.length} onClick={() => onChooseTable(order.id)}>Elegir mesa en el plano →</button>
      {!items.length && <small>Podés asignar la mesa ahora y cargar los artículos después.</small>}
      {!availableTables.length && <small>No hay mesas libres en este momento.</small>}
    </div>
    {error && <p className="pending-error">{error}</p>}
  </article>
}
