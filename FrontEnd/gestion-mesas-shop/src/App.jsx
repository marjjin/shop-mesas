import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Catalog from './Catalog.jsx'
import Cafeteria from './Cafeteria.jsx'
import Cigarettes from './Cigarettes.jsx'
import History from './History.jsx'
import PendingOrders from './PendingOrders.jsx'
import LoginForm from './features/auth/LoginForm.jsx'
import Sidebar from './features/layout/Sidebar.jsx'
import FloorPlan from './features/salon/components/FloorPlan.jsx'
import TableEditor from './features/salon/components/TableEditor.jsx'
import TableMenu from './features/salon/components/TableMenu.jsx'
import { isCoworkingService } from './shared/utils/products.js'
import { openReceiptPrintWindow, printReceipt, printWelcomeReceipt } from './receipt.js'
import './App.css'
import './Panel.css'
import './Navigation.css'
import './FloorPlan.css'
import './CoffeeSales.css'

const API = import.meta.env.VITE_API_URL || (import.meta.env.PROD
  ? 'https://shop-mesas.onrender.com/api'
  : 'http://localhost:5000/api')
const sections = new Set(['salon', 'pending', 'catalog', 'cafeteria', 'cigarettes', 'shift-close', 'history'])

function App() {
  const [user, setUser] = useState(() => JSON.parse(sessionStorage.getItem('mesa-user') || 'null'))
  const [login, setLogin] = useState({ username: 'admin', password: 'admin' })
  const [data, setData] = useState({ tables: [], products: [], categories: [], orders: [], pendingOrders: [], pendingOrderItems: [] })
  const [histories, setHistories] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [editingMode, setEditingMode] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [assigningPendingOrderId, setAssigningPendingOrderId] = useState(null)
  const [assigningTable, setAssigningTable] = useState(false)
  const [coffeeSummary, setCoffeeSummary] = useState({ saleCount: 0, totalSales: 0 })
  const [sellingCoffee, setSellingCoffee] = useState(false)
  const [section, setSection] = useState(() => {
    const storedSection = sessionStorage.getItem('mesa-section')
    return sections.has(storedSection) ? storedSection : 'salon'
  })
  const [message, setMessage] = useState('')
  const [now, setNow] = useState(() => Date.now())
  const assignmentLock = useRef(false)

  const api = useCallback(async (path, options = {}) => {
    const response = await fetch(`${API}${path}`, { headers: { 'Content-Type': 'application/json' }, ...options })
    if (!response.ok) {
      const problem = await response.json().catch(() => null)
      throw new Error(response.status === 401 ? 'Usuario o contraseña incorrectos.' : problem?.detail || 'No se pudo completar la operación.')
    }
    return response.status === 204 ? null : response.json()
  }, [])
  const load = useCallback(async () => {
    try { setData(await api('/bootstrap')); setMessage('') } catch { setMessage('No hay conexión con la API.') }
  }, [api])
  const loadHistory = useCallback(async () => {
    try { setHistories(await api('/history')); setMessage('') } catch { setMessage('No se pudo cargar el historial.') }
  }, [api])
  const loadCoffeeSummary = useCallback(async () => {
    const dashboard = await api('/cafeteria/dashboard')
    setCoffeeSummary(dashboard.summary)
  }, [api])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (user) load() }, [user, load])
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (user) loadCoffeeSummary().catch(() => {}) }, [user, loadCoffeeSummary])
  useEffect(() => { sessionStorage.setItem('mesa-section', section) }, [section])
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (user && section === 'history') loadHistory() }, [user, section, loadHistory])
  useEffect(() => {
    if (!user) return undefined
    const timer = setInterval(load, 10000)
    return () => clearInterval(timer)
  }, [user, load])
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  const selected = data.tables.find((table) => table.id === selectedId)
  const assigningPendingOrder = data.pendingOrders?.find((order) => order.id === assigningPendingOrderId)
  const orders = useMemo(() => data.orders
    .filter((order) => order.tableId === selectedId)
    .map((order) => ({ ...order, product: data.products.find((product) => product.id === order.productId) }))
    .filter((order) => order.product), [data, selectedId])
  const coworkingTableIds = useMemo(() => {
    const serviceIds = new Set(data.products.filter(isCoworkingService).map((product) => product.id))
    return new Set(data.orders.filter((order) => serviceIds.has(order.productId)).map((order) => order.tableId))
  }, [data])
  const coworkingTables = data.tables.filter((table) => coworkingTableIds.has(table.id))

  const registerCoffeeSale = async () => {
    if (sellingCoffee) return
    setSellingCoffee(true)
    try {
      const dashboard = await api('/cafeteria/sales', { method: 'POST' })
      setCoffeeSummary(dashboard.summary)
      setMessage('Venta de cafetería registrada.')
    } catch (error) {
      setMessage(error.message)
    } finally {
      setSellingCoffee(false)
    }
  }

  const saveTable = async (id, patch) => {
    setData((old) => ({ ...old, tables: old.tables.map((table) => table.id === id ? { ...table, ...patch } : table) }))
    const saved = await api(`/tables/${id}`, { method: 'PATCH', body: JSON.stringify(patch) })
    setData((old) => ({ ...old, tables: old.tables.map((table) => table.id === id ? saved : table) }))
  }
  const addTable = async () => {
    try {
      const table = await api('/tables', { method: 'POST', body: JSON.stringify({ seats: 4 }) })
      await load()
      setEditingId(table.id)
      setMessage('')
    } catch (error) {
      setMessage(error.message)
    }
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
  const deleteTable = async (table) => {
    const warning = table.status === 'occupied'
      ? `¿Eliminar ${table.name}? También se borrarán sus consumos actuales. Los cierres anteriores se conservarán.`
      : `¿Eliminar ${table.name} del salón?`
    if (!window.confirm(warning)) return false
    try {
      await api(`/tables/${table.id}`, { method: 'DELETE' })
      setSelectedId(null)
      setEditingId(null)
      await load()
      setMessage(`${table.name} fue eliminada.`)
      return true
    } catch (error) {
      setMessage(error.message)
      return false
    }
  }
  const changeSection = (nextSection) => {
    setSection(nextSection)
    if (nextSection === 'salon') loadCoffeeSummary().catch(() => {})
    if (nextSection === 'pending') {
      setSelectedId(null)
      setEditingId(null)
      setAssigningPendingOrderId(null)
    }
    if (nextSection === 'catalog') {
      setSelectedId(null)
      setAssigningPendingOrderId(null)
    }
    if (nextSection === 'cigarettes') {
      setSelectedId(null)
      setEditingId(null)
      setAssigningPendingOrderId(null)
    }
    if (nextSection === 'shift-close') {
      setSelectedId(null)
      setEditingId(null)
      setAssigningPendingOrderId(null)
    }
    if (nextSection === 'cafeteria') {
      setSelectedId(null)
      setEditingId(null)
      setAssigningPendingOrderId(null)
    }
    if (nextSection === 'history') {
      setSelectedId(null)
      setAssigningPendingOrderId(null)
    }
  }
  const chooseTableForPendingOrder = (pendingOrderId) => {
    setSection('salon')
    setAssigningPendingOrderId(pendingOrderId)
    setEditingMode(false)
    setEditingId(null)
    setSelectedId(null)
    setMessage('')
  }
  const assignPendingOrderToTable = async (tableId) => {
    if (!assigningPendingOrder || assigningTable || assignmentLock.current) return
    const table = data.tables.find((item) => item.id === tableId)
    if (!table || table.status !== 'free') return
    assignmentLock.current = true
    const printWindow = openReceiptPrintWindow()
    setAssigningTable(true)
    setMessage('')
    try {
      const result = await api(`/pending-orders/${assigningPendingOrder.id}/assign`, { method: 'POST', body: JSON.stringify({ tableId }) })
      const printStarted = printWelcomeReceipt(result.table, printWindow)
      setAssigningPendingOrderId(null)
      await load()
      setSelectedId(result.table.id)
      if (!printStarted) setMessage('Pedido asignado. Habilitá las ventanas emergentes para imprimir el ticket de bienvenida.')
    } catch {
      printWindow?.close()
      await load()
      setMessage('No se pudo asignar esa mesa. Elegí otra mesa libre.')
    } finally {
      assignmentLock.current = false
      setAssigningTable(false)
    }
  }
  const signOut = () => {
    sessionStorage.removeItem('mesa-user')
    setSelectedId(null)
    setEditingMode(false)
    setEditingId(null)
    setAssigningPendingOrderId(null)
    setUser(null)
  }
  const loginSubmit = async (event) => {
    event.preventDefault()
    try {
      const result = await api('/login', { method: 'POST', body: JSON.stringify(login) })
      sessionStorage.setItem('mesa-user', JSON.stringify(result.user))
      setUser(result.user)
    } catch (error) {
      setMessage(error.message)
    }
  }

  if (!user) return <LoginForm login={login} error={message} onLoginChange={setLogin} onSubmit={loginSubmit} />

  return <main className="layout">
    <Sidebar user={user} section={section} pendingOrdersCount={data.pendingOrders?.length} onSectionChange={changeSection} onSignOut={signOut} />
    <section className="page">
      {section === 'salon' ? <>
        <header><div><p className="eyebrow">OPERACIÓN EN VIVO</p><h1>Salón principal</h1><p>{editingMode ? 'Seleccioná una mesa para cambiar su nombre, moverla, redimensionarla o eliminarla.' : 'Un clic abre el menú. Usá Editar para modificar las mesas.'}</p></div><div className="salon-actions"><button type="button" className="coffee-sales-button" disabled={sellingCoffee} onClick={registerCoffeeSale} aria-label={`Registrar venta de cafetería. Total de hoy: ${coffeeSummary.saleCount}`}><span>☕ {sellingCoffee ? 'REGISTRANDO…' : 'VENTA CAFÉ'}</span><b>{coffeeSummary.saleCount}</b></button><button type="button" className={editingMode ? 'edit-mode-button active' : 'primary'} onClick={() => { setEditingMode((value) => !value); setSelectedId(null); setEditingId(null) }}>{editingMode ? '✓ Listo' : '✎ Editar'}</button></div></header>
        {assigningPendingOrder && <div className="table-assignment-notice" role="status"><div><strong>Elegí una mesa para {assigningPendingOrder.customerName}</strong><span>Las mesas libres están resaltadas en verde. Al elegir una se abrirá y se imprimirá el ticket.</span></div><button type="button" disabled={assigningTable} onClick={() => setAssigningPendingOrderId(null)}>Cancelar</button></div>}
        {coworkingTables.length > 0 && <div className="coworking-notice" role="alert"><strong>⚠ Alerta de coworking</strong><span>{coworkingTables.map((table) => table.name).join(', ')} {coworkingTables.length === 1 ? 'tiene' : 'tienen'} un servicio de coworking cargado.</span></div>}
        {message && <p className="error">{message}</p>}
        {editingMode && <TableEditor key={editingId ?? 'none'} table={data.tables.find((table) => table.id === editingId)} saveTable={saveTable} deleteTable={deleteTable} addTable={addTable} finishEditing={() => { setEditingMode(false); setEditingId(null) }} />}
        <FloorPlan tables={data.tables} coworkingTableIds={coworkingTableIds} editingMode={editingMode} editingId={editingId} assignmentOrder={assigningPendingOrder} assigningTable={assigningTable} onSelect={(id) => { setSelectedId(id); setEditingId(null) }} onEdit={(id) => { setSelectedId(null); setEditingId(id) }} onAssign={assignPendingOrderToTable} saveTable={saveTable} />
      </> : section === 'pending' ? <PendingOrders data={data} api={api} load={load} onChooseTable={chooseTableForPendingOrder} /> : section === 'catalog' ? <Catalog data={data} api={api} load={load} /> : section === 'cafeteria' ? <Cafeteria api={api} onSummaryChange={setCoffeeSummary} /> : section === 'cigarettes' ? <Cigarettes api={api} /> : section === 'shift-close' ? <Cigarettes api={api} mode="shift-close" onShiftClosed={() => loadCoffeeSummary().catch(() => {})} /> : <History histories={histories} />}
    </section>
    {selected && <TableMenu key={selected.id} table={selected} data={data} orders={orders} now={now} api={api} load={load} closePanel={() => setSelectedId(null)} closeTable={closeTable} updateOpenedAt={updateOpenedAt} />}
  </main>
}

export default App
