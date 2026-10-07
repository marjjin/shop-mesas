import { useState } from 'react'
import { datetimeLocal, clock, time } from '../../../shared/utils/date.js'
import { isCoworkingService } from '../../../shared/utils/products.js'
import { openReceiptPrintWindow, printWelcomeReceipt } from '../../../receipt.js'
import { parseProductSearch } from '../../../productSearch.js'

export default function TableMenu({ table, data, orders, now, api, load, closePanel, closeTable, updateOpenedAt }) {
  const [search, setSearch] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [openError, setOpenError] = useState('')
  const [openedAt, setOpenedAt] = useState(() => datetimeLocal(table.openedAt))
  const [savingStart, setSavingStart] = useState(false)
  const [startError, setStartError] = useState('')
  const [removingOrderId, setRemovingOrderId] = useState(null)
  const [editingOrderId, setEditingOrderId] = useState(null)
  const [orderTime, setOrderTime] = useState('')
  const [savingOrderId, setSavingOrderId] = useState(null)
  const [orderError, setOrderError] = useState('')
  const { quantity, query } = parseProductSearch(search)
  const firstOrderTime = orders.reduce((earliest, order) => Math.min(earliest, new Date(/(?:Z|[+-]\d{2}:\d{2})$/.test(order.createdAt) ? order.createdAt : `${order.createdAt}Z`).getTime()), now)
  const results = query ? data.products.filter((product) => !isCoworkingService(product)).filter((product) => product.name.toLowerCase().includes(query.toLowerCase())) : []

  const addConsumption = async (productId) => {
    await api('/orders', { method: 'POST', body: JSON.stringify({ tableId: table.id, productId, quantity }) })
    setSearch('')
    await load()
  }
  const openTable = async (event) => {
    event.preventDefault()
    const name = customerName.trim()
    if (!name) return
    const printWindow = openReceiptPrintWindow()
    setOpenError('')
    try {
      const openedTable = await api(`/tables/${table.id}/open`, { method: 'POST', body: JSON.stringify({ customerName: name }) })
      const printStarted = printWelcomeReceipt(openedTable, printWindow)
      setCustomerName('')
      await load()
      if (!printStarted) setOpenError('Mesa abierta. Habilitá las ventanas emergentes para imprimir el ticket de bienvenida.')
    } catch {
      printWindow?.close()
      setOpenError('No se pudo abrir la mesa. Intentá nuevamente.')
    }
  }
  const saveOpenedAt = async (event) => {
    event.preventDefault()
    setSavingStart(true)
    setStartError('')
    try {
      await updateOpenedAt(table.id, new Date(openedAt).toISOString())
    } catch {
      setStartError('El inicio no puede ser futuro ni posterior al primer consumo.')
    } finally {
      setSavingStart(false)
    }
  }
  const removeConsumption = async (order) => {
    const isCoworking = isCoworkingService(order.product)
    const confirmation = isCoworking ? `¿Quitar este ${order.product.name}? Los próximos cargos quedarán pausados hasta volver a abrir la mesa.` : `¿Quitar ${order.quantity}× ${order.product.name} de la mesa?`
    if (!window.confirm(confirmation)) return
    setRemovingOrderId(order.id)
    setOrderError('')
    try {
      await api(`/orders/${order.id}`, { method: 'DELETE' })
      await load()
    } catch {
      setOrderError('No se pudo quitar el registro. Intentá nuevamente.')
    } finally {
      setRemovingOrderId(null)
    }
  }
  const beginEditingTime = (order) => {
    setEditingOrderId(order.id)
    setOrderTime(datetimeLocal(order.createdAt))
    setOrderError('')
  }
  const saveConsumptionTime = async (event, order) => {
    event.preventDefault()
    setSavingOrderId(order.id)
    setOrderError('')
    try {
      await api(`/orders/${order.id}`, { method: 'PATCH', body: JSON.stringify({ createdAt: new Date(orderTime).toISOString() }) })
      setEditingOrderId(null)
      await load()
    } catch {
      setOrderError('La hora debe estar entre la apertura de la mesa y el momento actual.')
    } finally {
      setSavingOrderId(null)
    }
  }

  return <aside className="account">
    <button type="button" className="close" aria-label="Cerrar detalle" title="Cerrar detalle" onClick={closePanel}>×</button>
    <div className="account-summary">
      <div className="table-menu-toolbar"><em className={table.status}>{table.status === 'occupied' ? '● OCUPADA' : '○ LIBRE'}</em></div>
      <h2>{table.name}</h2>
      {table.status === 'occupied' ? <>
        <div className="customer-card"><small>CLIENTE</small><strong>{table.customerName || 'Sin nombre'}</strong></div>
        <div className="timers"><div><small>INICIO</small><b>{time(table.openedAt)}</b></div><div><small>TIEMPO EN MESA</small><b>{clock(table.openedAt, now)}</b></div><div><small>SIN CONSUMIR</small><b>{clock(table.lastConsumptionAt, now)}</b></div></div>
        <form className="start-time-form" onSubmit={saveOpenedAt}><label htmlFor={`opened-at-${table.id}`}>Modificar inicio</label><div><input id={`opened-at-${table.id}`} type="datetime-local" required max={datetimeLocal(firstOrderTime)} value={openedAt} onChange={(event) => setOpenedAt(event.target.value)} /><button type="submit" disabled={savingStart}>{savingStart ? 'Guardando…' : 'Guardar'}</button></div>{startError && <small className="start-time-error">{startError}</small>}</form>
      </> : <form className="open-table-form" onSubmit={openTable}><label htmlFor={`customer-${table.id}`}>Nombre del cliente</label><input id={`customer-${table.id}`} maxLength="80" autoComplete="off" autoFocus placeholder="Ej.: Martín" value={customerName} onChange={(event) => setCustomerName(event.target.value)} /><button className="primary wide" disabled={!customerName.trim()}>Abrir mesa e imprimir</button>{openError && <small className="start-time-error">{openError}</small>}</form>}
      <h3>Agregar consumo</h3>
      <div className="search-field"><span>⌕</span><input className="product-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar artículo o 2*medialunas..." /></div>
      {search.trim() && <div className="products search-results">{results.length ? results.map((product) => <button key={product.id} onClick={() => addConsumption(product.id)}><span>{product.name}</span><b>{quantity === 1 ? 'Agregar' : `Agregar ${quantity}`}</b></button>) : <p className="empty-result">No se encontraron artículos.</p>}</div>}
      <div className="orders-heading"><h3>Artículos cargados</h3><small>{orders.length} {orders.length === 1 ? 'registro' : 'registros'}</small></div>
      {table.coworkingDisabled && <p className="coworking-disabled-note">Servicios coworking pausados hasta la próxima apertura.</p>}
    </div>
    <div className="orders-list">
      {orderError && <p className="order-error">{orderError}</p>}
      {orders.length ? orders.map((order) => {
        const isCoworking = isCoworkingService(order.product)
        return <div className={`order ${isCoworking ? 'coworking-order' : ''}`} key={order.id}>
          <span><small>{order.quantity}×</small>{order.product.name}</span>
          {!isCoworking && editingOrderId === order.id ? <form className="order-time-form" onSubmit={(event) => saveConsumptionTime(event, order)}><input type="datetime-local" required min={datetimeLocal(table.openedAt)} max={datetimeLocal(now)} value={orderTime} onChange={(event) => setOrderTime(event.target.value)} /><button type="submit" disabled={savingOrderId === order.id}>✓</button><button type="button" title="Cancelar" onClick={() => setEditingOrderId(null)}>×</button></form> : <div className="order-actions"><time dateTime={order.createdAt}>{time(order.createdAt)}</time>{!isCoworking && <button type="button" aria-label={`Editar hora de ${order.product.name}`} title="Editar hora" onClick={() => beginEditingTime(order)}>✎</button>}<button type="button" disabled={removingOrderId === order.id} aria-label={`Quitar ${order.product.name}`} title={isCoworking ? 'Quitar este servicio' : 'Quitar artículo'} onClick={() => removeConsumption(order)}>{removingOrderId === order.id ? '…' : '×'}</button></div>}
        </div>
      }) : <p className="empty-result">Todavía no hay consumos.</p>}
    </div>
    <footer className="table-menu-footer">{table.status === 'occupied' && <button className="dark" onClick={() => closeTable(table.id)}>Cerrar y liberar mesa</button>}</footer>
  </aside>
}
