import { useCallback, useEffect, useState } from 'react'
import './Cafeteria.css'

const money = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })

export default function Cafeteria({ api, onSummaryChange }) {
  const [dashboard, setDashboard] = useState({ products: [], summary: { saleCount: 0, totalSales: 0, items: [] } })
  const [product, setProduct] = useState({ name: '', price: '' })
  const [editing, setEditing] = useState(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

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
    {message && <p className={message.includes('correctamente') || message.includes('quitado') ? 'cafeteria-message success' : 'cafeteria-message'}>{message}</p>}
    <div className="cafeteria-columns">
      <section className="cafeteria-card"><div className="section-heading"><div><small>ARTÍCULOS ACTIVOS</small><h2>Venta por clic</h2></div><span>{dashboard.products.length} {dashboard.products.length === 1 ? 'artículo' : 'artículos'}</span></div><p className="cafeteria-help">Cada uno se agregará una vez al presionar el botón de venta del plano.</p><div className="cafeteria-product-list">{dashboard.products.map((item) => editing?.id === item.id ? <form className="cafeteria-edit" key={item.id} onSubmit={saveProduct}><input required maxLength="100" aria-label="Nombre" value={editing.name} onChange={(event) => setEditing({ ...editing, name: event.target.value })} /><input required type="number" min="0.01" step="0.01" aria-label="Precio" value={editing.price} onChange={(event) => setEditing({ ...editing, price: event.target.value })} /><button disabled={busy}>Guardar</button><button type="button" onClick={() => setEditing(null)}>Cancelar</button></form> : <article key={item.id}><span><b>{item.name}</b><small>{money.format(item.price)} por venta</small></span><strong>{money.format(item.price)}</strong><button type="button" title="Editar artículo" onClick={() => setEditing({ ...item })}>✎</button><button type="button" title="Quitar artículo" onClick={() => deleteProduct(item)}>×</button></article>)}{!dashboard.products.length && <div className="cafeteria-empty">Todavía no hay artículos cargados. Agregá Café, medialunas u otros productos para comenzar.</div>}</div></section>
      <section className="cafeteria-card cafeteria-create"><small>NUEVO ARTÍCULO</small><h2>Agregar a la caja</h2><p>No lleva stock: solo definí lo que suma cada venta rápida.</p><form onSubmit={addProduct}><label>Artículo<input required maxLength="100" placeholder="Ej.: Café" value={product.name} onChange={(event) => setProduct({ ...product, name: event.target.value })} /></label><label>Precio de venta<input required type="number" min="0.01" step="0.01" placeholder="$ 0" value={product.price} onChange={(event) => setProduct({ ...product, price: event.target.value })} /></label><button className="primary wide" disabled={busy}>+ Agregar artículo</button></form></section>
    </div>
    <section className="cafeteria-card cafeteria-breakdown"><div className="section-heading"><div><small>DETALLE DEL TURNO</small><h2>Resumen para el ticket</h2></div><b>{money.format(dashboard.summary.totalSales)}</b></div>{dashboard.summary.items.length ? <div>{dashboard.summary.items.map((item) => <article key={`${item.productName}-${item.unitPrice}`}><span><b>{item.productName}</b><small>{item.quantity} × {money.format(item.unitPrice)}</small></span><strong>{money.format(item.totalSales)}</strong></article>)}</div> : <div className="cafeteria-empty">Las ventas aparecerán aquí al usar el botón VENTA CAFÉ del plano.</div>}</section>
  </div>
}