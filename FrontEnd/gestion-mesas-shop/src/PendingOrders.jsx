import { useState } from 'react'
import { openReceiptPrintWindow, printWelcomeReceipt } from './receipt.js'
import './PendingOrders.css'

const isCoworkingService = (product) => product.name.startsWith('Servicio Coworking ')

function PendingOrderCard({ order, data, api, load, onAssigned }) {
  const [search, setSearch] = useState('')
  const [tableId, setTableId] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const items = (data.pendingOrderItems || [])
    .filter((item) => item.pendingOrderId === order.id)
    .map((item) => ({ ...item, product: data.products.find((product) => product.id === item.productId) }))
    .filter((item) => item.product)
  const availableTables = data.tables.filter((table) => table.status === 'free')
  const products = data.products.filter((product) => !isCoworkingService(product))
    .filter((product) => product.name.toLowerCase().includes(search.trim().toLowerCase()))

  const addItem = async (productId) => {
    setError('')
    try {
      await api(`/pending-orders/${order.id}/items`, { method: 'POST', body: JSON.stringify({ productId, quantity: 1 }) })
      setSearch('')
      await load()
    } catch {
      setError('No se pudo agregar el artículo.')
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

  const assignTable = async () => {
    if (!tableId || !items.length) return
    const printWindow = openReceiptPrintWindow()
    setBusy(true)
    setError('')
    try {
      const result = await api(`/pending-orders/${order.id}/assign`, { method: 'POST', body: JSON.stringify({ tableId: Number(tableId) }) })
      const printStarted = printWelcomeReceipt(result.table, printWindow)
      await load()
      onAssigned(result.table.id, printStarted)
    } catch {
      printWindow?.close()
      setError('La mesa ya no está disponible o el pedido no pudo asignarse.')
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
      <input id={`pending-search-${order.id}`} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar artículo..." />
      {search.trim() && <div className="pending-results">
        {products.length ? products.map((product) => <button type="button" key={product.id} onClick={() => addItem(product.id)}><span>{product.name}</span><b>Agregar</b></button>) : <p>No se encontraron artículos.</p>}
      </div>}
    </div>

    <div className="pending-items">
      <h3>Pedido</h3>
      {items.length ? items.map((item) => <div key={item.id}><span><small>{item.quantity}×</small>{item.product.name}</span><button type="button" title="Quitar artículo" onClick={() => removeItem(item)}>×</button></div>) : <p>Todavía no agregaste artículos.</p>}
    </div>

    <div className="pending-assignment">
      <label htmlFor={`pending-table-${order.id}`}>Asignar cuando elijan mesa</label>
      <div>
        <select id={`pending-table-${order.id}`} value={tableId} onChange={(event) => setTableId(event.target.value)}>
          <option value="">Seleccionar mesa libre</option>
          {availableTables.map((table) => <option key={table.id} value={table.id}>{table.name} · {table.seats} lugares</option>)}
        </select>
        <button type="button" className="primary" disabled={busy || !tableId || !items.length} onClick={assignTable}>{busy ? 'Asignando…' : 'Asignar e imprimir'}</button>
      </div>
      {!availableTables.length && <small>No hay mesas libres en este momento.</small>}
    </div>
    {error && <p className="pending-error">{error}</p>}
  </article>
}

export default function PendingOrders({ data, api, load, onAssigned }) {
  const [customerName, setCustomerName] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const pendingOrders = data.pendingOrders || []

  const createOrder = async (event) => {
    event.preventDefault()
    const name = customerName.trim()
    if (!name) return
    setCreating(true)
    setError('')
    try {
      await api('/pending-orders', { method: 'POST', body: JSON.stringify({ customerName: name }) })
      setCustomerName('')
      await load()
    } catch {
      setError('No se pudo crear el pedido.')
    } finally {
      setCreating(false)
    }
  }

  return <>
    <header><div><p className="eyebrow">ANTES DE ELEGIR MESA</p><h1>Pedidos pendientes</h1><p>Tomá el pedido por nombre y asignalo cuando el cliente elija dónde sentarse.</p></div></header>
    <section className="pending-orders-panel">
      <form className="pending-create" onSubmit={createOrder}>
        <label htmlFor="pending-customer">Nombre del cliente o pedido</label>
        <div><input id="pending-customer" maxLength="80" required value={customerName} onChange={(event) => setCustomerName(event.target.value)} placeholder="Ej.: Martín" /><button className="primary" disabled={creating || !customerName.trim()}>{creating ? 'Creando…' : '+ Crear pedido'}</button></div>
        {error && <small>{error}</small>}
      </form>
      {pendingOrders.length ? <div className="pending-grid">{pendingOrders.map((order) => <PendingOrderCard key={order.id} order={order} data={data} api={api} load={load} onAssigned={onAssigned} />)}</div> : <div className="pending-empty"><b>No hay pedidos esperando mesa</b><span>Creá uno cuando llegue un cliente y todavía no sepas dónde se sentará.</span></div>}
    </section>
  </>
}
