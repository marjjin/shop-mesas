import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Moveable from 'react-moveable'
import Catalog from './Catalog.jsx'
import History from './History.jsx'
import PendingOrders from './PendingOrders.jsx'
import { openReceiptPrintWindow, printReceipt, printWelcomeReceipt } from './receipt.js'
import './App.css'
import './Panel.css'

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'
const isCoworkingService = (product) => product.name.startsWith('Servicio Coworking ')

function clock(date, now = Date.now()) {
  if (!date) return '00:00:00'
  const utcDate = /(?:Z|[+-]\d{2}:\d{2})$/.test(date) ? date : `${date}Z`
  const seconds = Math.max(0, Math.floor((now - new Date(utcDate).getTime()) / 1000))
  return [seconds / 3600, (seconds % 3600) / 60, seconds % 60]
    .map((number) => String(Math.floor(number)).padStart(2, '0')).join(':')
}

function time(date) {
  if (!date) return '--:--'
  const utcDate = /(?:Z|[+-]\d{2}:\d{2})$/.test(date) ? date : `${date}Z`
  return new Intl.DateTimeFormat('es-AR', { hour: '2-digit', minute: '2-digit' }).format(new Date(utcDate))
}

function datetimeLocal(date) {
  if (!date) return ''
  const utcDate = typeof date === 'number' || /(?:Z|[+-]\d{2}:\d{2})$/.test(date) ? date : `${date}Z`
  const value = new Date(utcDate)
  return new Date(value.getTime() - value.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

function FloorPlan({ tables, coworkingTableIds, editingId, onSelect, onEdit, saveTable }) {
  const [target, setTarget] = useState(null)
  const [now, setNow] = useState(() => Date.now())
  const origin = useRef({ x: 0, y: 0 })
  const clickTimer = useRef(null)
  const editing = tables.find((table) => table.id === editingId)

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => { clearInterval(timer); clearTimeout(clickTimer.current) }
  }, [])

  const selectTable = (event, id) => {
    event.stopPropagation()
    clearTimeout(clickTimer.current)
    clickTimer.current = setTimeout(() => onSelect(id), 220)
  }
  const editTable = (event, id) => {
    event.stopPropagation()
    clearTimeout(clickTimer.current)
    onEdit(id)
  }

  const begin = (set) => {
    origin.current = { x: editing?.x ?? 0, y: editing?.y ?? 0 }
    set?.([0, 0])
  }
  const move = (element, delta) => {
    element.style.left = `${origin.current.x + delta[0]}px`
    element.style.top = `${origin.current.y + delta[1]}px`
  }
  const finish = (width, height) => {
    if (!target || !editing) return
    saveTable(editing.id, {
      x: target.offsetLeft,
      y: target.offsetTop,
      ...(width ? { width: Math.round(width), height: Math.round(height) } : {}),
    })
  }

  return <div className="floor" onClick={() => onSelect(null)}>
    <small>SALÓN · UN CLIC OPERA · DOBLE CLIC EDITA UBICACIÓN Y TAMAÑO</small>
    {tables.map((table) => <button
      key={table.id}
      type="button"
      ref={table.id === editingId ? setTarget : null}
      className={`table ${table.status} ${coworkingTableIds.has(table.id) ? 'coworking-alert' : ''} ${table.id === editingId ? 'selected' : ''}`}
      style={{ left: table.x, top: table.y, width: table.width, height: table.height }}
      onClick={(event) => selectTable(event, table.id)}
      onDoubleClick={(event) => editTable(event, table.id)}
    >
      <em>{table.status === 'occupied' ? '● OCUPADA' : '○ LIBRE'}</em>
      <b>{table.name}</b>
      {table.status === 'occupied' && table.customerName && <span className="table-customer">{table.customerName}</span>}
      {coworkingTableIds.has(table.id) && <span className="coworking-badge">⚠ SERVICIO COWORKING</span>}
      {table.status === 'occupied' && <div className="table-times"><span><small>SIN CONSUMIR</small><strong>{clock(table.lastConsumptionAt, now)}</strong></span></div>}
    </button>)}
    {editingId && target && <Moveable
      key={editingId} target={target} draggable resizable throttleDrag={0}
      onDragStart={({ set }) => begin(set)}
      onDrag={({ target: element, beforeTranslate }) => move(element, beforeTranslate)}
      onDragEnd={({ lastEvent }) => { if (lastEvent) finish() }}
      onResizeStart={({ dragStart }) => begin(dragStart?.set)}
      onResize={({ target: element, width, height, drag }) => { element.style.width = `${width}px`; element.style.height = `${height}px`; move(element, drag.beforeTranslate) }}
      onResizeEnd={({ lastEvent }) => { if (lastEvent) finish(lastEvent.width, lastEvent.height) }}
    />}
  </div>
}

function TableMenu({ table, data, orders, now, api, load, closePanel, editTable, closeTable, updateOpenedAt }) {
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
  const firstOrderTime = orders.reduce((earliest, order) => Math.min(earliest, new Date(/(?:Z|[+-]\d{2}:\d{2})$/.test(order.createdAt) ? order.createdAt : `${order.createdAt}Z`).getTime()), now)
  const results = search.trim() ? data.products.filter((product) => !isCoworkingService(product)).filter((product) => {
    return product.name.toLowerCase().includes(search.toLowerCase())
  }) : []
  const addConsumption = async (productId) => {
    await api('/orders', { method: 'POST', body: JSON.stringify({ tableId: table.id, productId, quantity: 1 }) })
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
    const confirmation = isCoworking
      ? `¿Quitar este ${order.product.name}? Los próximos cargos quedarán pausados hasta volver a abrir la mesa.`
      : `¿Quitar ${order.quantity}× ${order.product.name} de la mesa?`
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
      <div className="table-menu-toolbar"><em className={table.status}>{table.status === 'occupied' ? '● OCUPADA' : '○ LIBRE'}</em><button type="button" className="move-table-button" onClick={() => editTable(table.id)}>✥ Mover mesa</button></div>
      <h2>{table.name}</h2>
      {table.status === 'occupied' ? <>
        <div className="customer-card"><small>CLIENTE</small><strong>{table.customerName || 'Sin nombre'}</strong></div>
        <div className="timers"><div><small>INICIO</small><b>{time(table.openedAt)}</b></div><div><small>TIEMPO EN MESA</small><b>{clock(table.openedAt, now)}</b></div><div><small>SIN CONSUMIR</small><b>{clock(table.lastConsumptionAt, now)}</b></div></div>
        <form className="start-time-form" onSubmit={saveOpenedAt}>
          <label htmlFor={`opened-at-${table.id}`}>Modificar inicio</label>
          <div><input id={`opened-at-${table.id}`} type="datetime-local" required max={datetimeLocal(firstOrderTime)} value={openedAt} onChange={(event) => setOpenedAt(event.target.value)} /><button type="submit" disabled={savingStart}>{savingStart ? 'Guardando…' : 'Guardar'}</button></div>
          {startError && <small className="start-time-error">{startError}</small>}
        </form>
      </> : <form className="open-table-form" onSubmit={openTable}><label htmlFor={`customer-${table.id}`}>Nombre del cliente</label><input id={`customer-${table.id}`} maxLength="80" autoComplete="off" autoFocus placeholder="Ej.: Martín" value={customerName} onChange={(event) => setCustomerName(event.target.value)} /><button className="primary wide" disabled={!customerName.trim()}>Abrir mesa e imprimir</button>{openError && <small className="start-time-error">{openError}</small>}</form>}
      <h3>Agregar consumo</h3>
      <div className="search-field"><span>⌕</span><input className="product-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar artículo..." /></div>
      {search.trim() && <div className="products search-results">{results.length ? results.map((product) => <button key={product.id} onClick={() => addConsumption(product.id)}><span>{product.name}</span><b>Agregar</b></button>) : <p className="empty-result">No se encontraron artículos.</p>}</div>}
      <div className="orders-heading"><h3>Artículos cargados</h3><small>{orders.length} {orders.length === 1 ? 'registro' : 'registros'}</small></div>
      {table.coworkingDisabled && <p className="coworking-disabled-note">Servicios coworking pausados hasta la próxima apertura.</p>}
    </div>
    <div className="orders-list">
      {orderError && <p className="order-error">{orderError}</p>}
      {orders.length ? orders.map((order) => {
        const isCoworking = isCoworkingService(order.product)
        return <div className={`order ${isCoworking ? 'coworking-order' : ''}`} key={order.id}>
          <span><small>{order.quantity}×</small>{order.product.name}</span>
          {!isCoworking && editingOrderId === order.id ? <form className="order-time-form" onSubmit={(event) => saveConsumptionTime(event, order)}>
            <input type="datetime-local" required min={datetimeLocal(table.openedAt)} max={datetimeLocal(now)} value={orderTime} onChange={(event) => setOrderTime(event.target.value)} />
            <button type="submit" disabled={savingOrderId === order.id}>✓</button>
            <button type="button" title="Cancelar" onClick={() => setEditingOrderId(null)}>×</button>
          </form> : <div className="order-actions">
            <time dateTime={order.createdAt}>{time(order.createdAt)}</time>
            {!isCoworking && <button type="button" aria-label={`Editar hora de ${order.product.name}`} title="Editar hora" onClick={() => beginEditingTime(order)}>✎</button>}
            <button type="button" disabled={removingOrderId === order.id} aria-label={`Quitar ${order.product.name}`} title={isCoworking ? 'Quitar este servicio' : 'Quitar artículo'} onClick={() => removeConsumption(order)}>{removingOrderId === order.id ? '…' : '×'}</button>
          </div>}
        </div>
      }) : <p className="empty-result">Todavía no hay consumos.</p>}
    </div>
    <footer>{table.status === 'occupied' && <button className="dark wide" onClick={() => closeTable(table.id)}>Cerrar y liberar mesa</button>}</footer>
  </aside>
}

function App() {
  const [user, setUser] = useState(() => JSON.parse(sessionStorage.getItem('mesa-user') || 'null'))
  const [login, setLogin] = useState({ username: 'admin', password: 'admin' })
  const [data, setData] = useState({ tables: [], products: [], categories: [], orders: [], pendingOrders: [], pendingOrderItems: [] })
  const [histories, setHistories] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [section, setSection] = useState('salon')
  const [tableName, setTableName] = useState('')
  const [message, setMessage] = useState('')
  const [now, setNow] = useState(() => Date.now())

  const api = useCallback(async (path, options = {}) => {
    const response = await fetch(`${API}${path}`, { headers: { 'Content-Type': 'application/json' }, ...options })
    if (!response.ok) throw new Error(response.status === 401 ? 'Usuario o contraseña incorrectos.' : 'No se pudo completar la operación.')
    return response.status === 204 ? null : response.json()
  }, [])
  const load = useCallback(async () => {
    try { setData(await api('/bootstrap')); setMessage('') } catch { setMessage('No hay conexión con la API.') }
  }, [api])
  const loadHistory = useCallback(async () => {
    try { setHistories(await api('/history')); setMessage('') } catch { setMessage('No se pudo cargar el historial.') }
  }, [api])
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (user) load() }, [user, load])
  useEffect(() => {
    if (!user) return undefined
    const timer = setInterval(load, 10000)
    return () => clearInterval(timer)
  }, [user, load])
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer) }, [])

  const selected = data.tables.find((table) => table.id === selectedId)
  const orders = useMemo(() => data.orders.filter((order) => order.tableId === selectedId).map((order) => ({ ...order, product: data.products.find((product) => product.id === order.productId) })).filter((order) => order.product), [data, selectedId])
  const coworkingTableIds = useMemo(() => {
    const serviceIds = new Set(data.products.filter(isCoworkingService).map((product) => product.id))
    return new Set(data.orders.filter((order) => serviceIds.has(order.productId)).map((order) => order.tableId))
  }, [data])
  const coworkingTables = data.tables.filter((table) => coworkingTableIds.has(table.id))
  const saveTable = async (id, patch) => {
    setData((old) => ({ ...old, tables: old.tables.map((table) => table.id === id ? { ...table, ...patch } : table) }))
    const saved = await api(`/tables/${id}`, { method: 'PATCH', body: JSON.stringify(patch) })
    setData((old) => ({ ...old, tables: old.tables.map((table) => table.id === id ? saved : table) }))
  }
  const updateOpenedAt = async (id, openedAt) => {
    const saved = await api(`/tables/${id}`, { method: 'PATCH', body: JSON.stringify({ openedAt }) })
    setData((old) => ({ ...old, tables: old.tables.map((table) => table.id === id ? saved : table) }))
  }
  const closeTable = async (id) => {
    const printWindow = openReceiptPrintWindow()
    try {
      const result = await api(`/tables/${id}/close`, { method: 'POST' })
      setSelectedId(null)
      const printStarted = printReceipt(result.history, printWindow)
      await Promise.all([load(), loadHistory()])
      if (!printStarted) setMessage('Mesa cerrada. Habilitá las ventanas emergentes para imprimir el ticket automáticamente.')
    } catch (error) {
      printWindow?.close()
      setMessage(error.message)
    }
  }
  const showHistory = async () => {
    setSection('history')
    setSelectedId(null)
    await loadHistory()
  }
  const pendingOrderAssigned = (tableId, printStarted) => {
    setSection('salon')
    setEditingId(null)
    setSelectedId(tableId)
    if (!printStarted) setMessage('Pedido asignado. Habilitá las ventanas emergentes para imprimir el ticket de bienvenida.')
  }
  const signOut = () => {
    sessionStorage.removeItem('mesa-user')
    setSelectedId(null)
    setEditingId(null)
    setUser(null)
  }
  const loginSubmit = async (event) => {
    event.preventDefault()
    try {
      const result = await api('/login', { method: 'POST', body: JSON.stringify(login) })
      sessionStorage.setItem('mesa-user', JSON.stringify(result.user))
      setUser(result.user)
    } catch (error) { setMessage(error.message) }
  }

  if (!user) return <main className="login"><form onSubmit={loginSubmit}><div className="icon">☕</div><p className="eyebrow">GESTIÓN DE MESAS</p><h1>Bienvenido</h1><label>Usuario<input value={login.username} onChange={(event) => setLogin({ ...login, username: event.target.value })} /></label><label>Contraseña<input type="password" value={login.password} onChange={(event) => setLogin({ ...login, password: event.target.value })} /></label>{message && <p className="error">{message}</p>}<button className="primary wide">Ingresar →</button><small>Demo: <b>admin / admin</b></small></form></main>

  return <main className="layout">
    <aside className="sidebar">
      <div className="logo">☕ Mesa<span>.</span></div>
      <button className={section === 'salon' ? 'active' : ''} onClick={() => setSection('salon')}>▦ <span>Plano de mesas</span></button>
      <button className={section === 'pending' ? 'active' : ''} onClick={() => { setSection('pending'); setSelectedId(null); setEditingId(null) }}>⌛ <span>Pedidos pendientes{data.pendingOrders?.length ? ` (${data.pendingOrders.length})` : ''}</span></button>
      <button className={section === 'catalog' ? 'active' : ''} onClick={() => { setSection('catalog'); setSelectedId(null) }}>☷ <span>Artículos</span></button>
      <button className={section === 'history' ? 'active' : ''} onClick={showHistory}>◷ <span>Historial de mesas</span></button>
      <div className="profile"><i>A</i><span><b>{user.name}</b><small>Administrador</small></span><button className="logout-button" title="Cerrar sesión" onClick={signOut}>↪</button></div>
    </aside>
    <section className="page">
      {section === 'salon' ? <>
        <header><div><p className="eyebrow">OPERACIÓN EN VIVO</p><h1>Salón principal</h1><p>Un clic abre el menú. Usá “Mover mesa” o doble clic para editar su ubicación.</p></div><button className="primary" onClick={async () => { await api('/tables', { method: 'POST', body: JSON.stringify({ name: tableName || null, seats: 4 }) }); setTableName(''); await load() }}>+ Nueva mesa</button></header>
        {coworkingTables.length > 0 && <div className="coworking-notice" role="alert"><strong>⚠ Alerta de coworking</strong><span>{coworkingTables.map((table) => table.name).join(', ')} {coworkingTables.length === 1 ? 'tiene' : 'tienen'} un servicio de coworking cargado.</span></div>}
        <div className="add-table"><input placeholder="Nombre de la mesa" value={tableName} onChange={(event) => setTableName(event.target.value)} /><button className="text-button" onClick={async () => { await api('/tables', { method: 'DELETE' }); setSelectedId(null); setEditingId(null); await load() }}>Vaciar salón</button></div>
        {message && <p className="error">{message}</p>}
        <FloorPlan tables={data.tables} coworkingTableIds={coworkingTableIds} editingId={editingId} onSelect={(id) => { setSelectedId(id); setEditingId(null) }} onEdit={(id) => { setSelectedId(null); setEditingId(id) }} saveTable={saveTable} />
      </> : section === 'pending' ? <PendingOrders data={data} api={api} load={load} onAssigned={pendingOrderAssigned} /> : section === 'catalog' ? <Catalog data={data} api={api} load={load} /> : <History histories={histories} />}
    </section>
    {selected && <TableMenu key={selected.id} table={selected} data={data} orders={orders} now={now} api={api} load={load} closePanel={() => setSelectedId(null)} editTable={(id) => { setSelectedId(null); setEditingId(id) }} closeTable={closeTable} updateOpenedAt={updateOpenedAt} />}
  </main>
}

export default App
