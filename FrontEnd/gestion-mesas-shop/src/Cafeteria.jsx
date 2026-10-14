import { useCallback, useEffect, useState } from 'react'
import './Cafeteria.css'

const money = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })
const shiftNames = { morning: 'Mañana', afternoon: 'Tarde' }

export default function Cafeteria({ api, onSummaryChange }) {
  const [dashboard, setDashboard] = useState({ products: [], summary: { saleCount: 0, totalSales: 0, items: [] }, daySummary: { saleCount: 0, totalSales: 0 }, monthSummary: { saleCount: 0, totalSales: 0 }, recentShiftHistory: [] })
  const [product, setProduct] = useState({ name: '', price: '' })
  const [editing, setEditing] = useState(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [historyDate, setHistoryDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [shiftHistory, setShiftHistory] = useState([])
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [historyError, setHistoryError] = useState('')
  const businessDate = new Date(`${dashboard.businessDate || new Date().toISOString().slice(0, 10)}T12:00:00`)
  const businessDateLabel = businessDate.toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })
  const monthLabel = businessDate.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })

  const load = useCallback(async () => {
    try {
      const loaded = await api('/cafeteria/dashboard')
      setDashboard(loaded)
      onSummaryChange(loaded.summary)
      setMessage('')
    } catch {
      setMessage('No se pudo cargar la Caja Cafetería.')
    }
  }, [api, onSummaryChange])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load() }, [load])
  useEffect(() => {
    let cancelled = false
    setLoadingHistory(true)
    setHistoryError('')
    api(`/cafeteria/history?date=${historyDate}`)
      .then((history) => {
        if (!cancelled) setShiftHistory(history)
      })
      .catch(() => {
        if (!cancelled) {
          setShiftHistory([])
          setHistoryError('No se pudo cargar el historial de este día.')
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingHistory(false)
      })
    return () => { cancelled = true }
  }, [api, historyDate])

  const execute = async (operation, successMessage) => {
    setBusy(true)
    setMessage('')
    try {
      await operation()
      await load()
      setMessage(successMessage)
      return true
    } catch (error) {
      setMessage(error.message || 'No se pudo completar la operación.')
      return false
    } finally {
      setBusy(false)
    }
  }

  const addProduct = async (event) => {
    event.preventDefault()
    const saved = await execute(() => api('/cafeteria/products', { method: 'POST', body: JSON.stringify({ name: product.name, price: Number(product.price) }) }), 'Artículo de cafetería agregado correctamente.')
    if (saved) setProduct({ name: '', price: '' })
  }
  const saveProduct = async (event) => {
    event.preventDefault()
    const saved = await execute(() => api(`/cafeteria/products/${editing.id}`, { method: 'PUT', body: JSON.stringify({ name: editing.name, price: Number(editing.price) }) }), 'Artículo actualizado correctamente.')
    if (saved) setEditing(null)
  }
  const deleteProduct = async (item) => {
    if (!window.confirm(`¿Quitar ${item.name} de las próximas ventas de cafetería? Las ventas ya registradas se conservarán.`)) return
    await execute(() => api(`/cafeteria/products/${item.id}`, { method: 'DELETE' }), 'Artículo quitado de la caja.')
  }

  return <div className="cafeteria-page">
    <header className="cafeteria-header"><div><p className="eyebrow">VENTAS RÁPIDAS</p><h1>Caja Cafetería</h1><p>Configurá los artículos de cada venta. Cada clic en <b>VENTA CAFÉ</b> registra una unidad de todos los artículos activos.</p></div></header>
    <section className="cafeteria-total"><div><small>VENTAS · TURNO {dashboard.activeShift === 'afternoon' ? 'TARDE' : 'MAÑANA'}</small><b>{dashboard.summary.saleCount}</b><span>{dashboard.summary.items.reduce((total, item) => total + item.quantity, 0)} artículos cobrados desde el último cierre</span></div><div><small>TOTAL CAJA CAFETERÍA</small><strong>{money.format(dashboard.summary.totalSales)}</strong><span>Se imprime junto al cierre de cigarrillos.</span></div></section>
    <section className="cafeteria-period-summary" aria-label="Resumen de cajas de cafetería">
      <header><div><small>CAJAS DE CAFETERÍA</small><h2>Seguimiento de ventas</h2><p>Consultá lo vendido en el día y el acumulado del mes.</p></div><span>Actualizado automáticamente</span></header>
      <div><article className="cafeteria-day-summary"><small>VENDIDO HOY</small><strong>{money.format(dashboard.daySummary?.totalSales || 0)}</strong><span>{dashboard.daySummary?.saleCount || 0} {(dashboard.daySummary?.saleCount || 0) === 1 ? 'venta registrada' : 'ventas registradas'} · {businessDateLabel}</span></article><article className="cafeteria-month-summary"><small>VENDIDO EN EL MES</small><strong>{money.format(dashboard.monthSummary?.totalSales || 0)}</strong><span>{dashboard.monthSummary?.saleCount || 0} {(dashboard.monthSummary?.saleCount || 0) === 1 ? 'venta registrada' : 'ventas registradas'} · {monthLabel}</span></article></div>
    </section>
    <section className="cafeteria-card cafeteria-history">
      <div className="section-heading"><div><small>HISTORIAL POR DÍA</small><h2>Historial de cajas</h2></div><label className="cafeteria-history-date"><span>FECHA</span><input type="date" value={historyDate} onChange={(event) => setHistoryDate(event.target.value)} /></label></div>
      <p className="cafeteria-help">Elegí una fecha para ver el total vendido en cada turno de Cafetería.</p>
      {loadingHistory ? <div className="cafeteria-empty">Cargando ventas del día…</div> : historyError ? <p className="cafeteria-message">{historyError}</p> : shiftHistory.length ? <div className="cafeteria-history-list">{shiftHistory.map((item) => <article key={`${item.businessDate}-${item.shift}`}><span><b>{new Date(`${item.businessDate}T12:00:00`).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })}</b><small>{item.saleCount} {item.saleCount === 1 ? 'venta rápida' : 'ventas rápidas'}</small></span><em className={item.shift}>{shiftNames[item.shift] || item.shift}</em><strong>{money.format(item.totalSales)}</strong></article>)}</div> : <div className="cafeteria-empty">No hay ventas de Cafetería registradas para esta fecha.</div>}
    </section>
    {message && <p className={message.includes('correctamente') || message.includes('quitado') ? 'cafeteria-message success' : 'cafeteria-message'}>{message}</p>}
    <div className="cafeteria-columns">
      <section className="cafeteria-card"><div className="section-heading"><div><small>ARTÍCULOS ACTIVOS</small><h2>Venta por clic</h2></div><span>{dashboard.products.length} {dashboard.products.length === 1 ? 'artículo' : 'artículos'}</span></div><p className="cafeteria-help">Cada uno se agregará una vez al presionar el botón de venta del plano.</p><div className="cafeteria-product-list">{dashboard.products.map((item) => editing?.id === item.id ? <form className="cafeteria-edit" key={item.id} onSubmit={saveProduct}><input required maxLength="100" aria-label="Nombre" value={editing.name} onChange={(event) => setEditing({ ...editing, name: event.target.value })} /><input required type="number" min="0.01" step="0.01" aria-label="Precio" value={editing.price} onChange={(event) => setEditing({ ...editing, price: event.target.value })} /><button disabled={busy}>Guardar</button><button type="button" onClick={() => setEditing(null)}>Cancelar</button></form> : <article key={item.id}><span><b>{item.name}</b><small>{money.format(item.price)} por venta</small></span><strong>{money.format(item.price)}</strong><button type="button" title="Editar artículo" onClick={() => setEditing({ ...item })}>✎</button><button type="button" title="Quitar artículo" onClick={() => deleteProduct(item)}>×</button></article>)}{!dashboard.products.length && <div className="cafeteria-empty">Todavía no hay artículos cargados. Agregá Café, medialunas u otros productos para comenzar.</div>}</div></section>
      <section className="cafeteria-card cafeteria-create"><small>NUEVO ARTÍCULO</small><h2>Agregar a la caja</h2><p>No lleva stock: solo definí lo que suma cada venta rápida.</p><form onSubmit={addProduct}><label>Artículo<input required maxLength="100" placeholder="Ej.: Café" value={product.name} onChange={(event) => setProduct({ ...product, name: event.target.value })} /></label><label>Precio de venta<input required type="number" min="0.01" step="0.01" placeholder="$ 0" value={product.price} onChange={(event) => setProduct({ ...product, price: event.target.value })} /></label><button className="primary wide" disabled={busy}>+ Agregar artículo</button></form></section>
    </div>
    <section className="cafeteria-card cafeteria-breakdown"><div className="section-heading"><div><small>DETALLE DEL TURNO</small><h2>Resumen para el ticket</h2></div><b>{money.format(dashboard.summary.totalSales)}</b></div>{dashboard.summary.items.length ? <div>{dashboard.summary.items.map((item) => <article key={`${item.productName}-${item.unitPrice}`}><span><b>{item.productName}</b><small>{item.quantity} × {money.format(item.unitPrice)}</small></span><strong>{money.format(item.totalSales)}</strong></article>)}</div> : <div className="cafeteria-empty">Las ventas aparecerán aquí al usar el botón VENTA CAFÉ del plano.</div>}</section>
  </div>
}