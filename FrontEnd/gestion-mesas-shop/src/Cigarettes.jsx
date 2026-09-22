import { useCallback, useEffect, useMemo, useState } from 'react'
import { printCigaretteShiftReceipt } from './receipt.js'
import './Cigarettes.css'

const shifts = { morning: 'Mañana', afternoon: 'Tarde' }
const money = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })

function localDateValue(date = new Date()) {
  const offset = date.getTimezoneOffset() * 60000
  return new Date(date.getTime() - offset).toISOString().slice(0, 10)
}

function ShiftCloseForm({ products, purchases, shift, date, onClose }) {
  const purchasedByProduct = useMemo(() => purchases
    .filter((purchase) => purchase.shift === shift)
    .reduce((totals, purchase) => ({ ...totals, [purchase.cigaretteProductId]: (totals[purchase.cigaretteProductId] || 0) + purchase.quantity }), {}), [purchases, shift])
  const [finalStocks, setFinalStocks] = useState(() => Object.fromEntries(products.map((product) => [product.id, product.stock])))
  const rows = products.map((product) => {
    const purchased = purchasedByProduct[product.id] || 0
    const initial = product.stock - purchased
    const final = Number(finalStocks[product.id] ?? product.stock)
    const sold = Math.max(0, initial + purchased - final)
    return { ...product, purchased, initial, final, sold, amount: sold * product.price }
  })
  const totalUnits = rows.reduce((total, row) => total + row.sold, 0)
  const totalSales = rows.reduce((total, row) => total + row.amount, 0)
  const isValid = rows.length > 0 && rows.every((row) => row.final >= 0 && row.final <= row.initial + row.purchased)

  const submit = (event) => {
    event.preventDefault()
    onClose({ businessDate: date, shift, items: rows.map((row) => ({ cigaretteProductId: row.id, finalStock: row.final })) })
  }

  return <form className="shift-close" onSubmit={submit}>
    <div className="close-grid-header"><span>Producto</span><span>Inicial</span><span>Compras</span><span>Final</span><span>Vendidos</span><span>Importe</span></div>
    {rows.map((row) => <div className={`close-grid-row ${row.stock <= 0 ? 'stock-empty' : ''}`} key={row.id}>
      <span className="close-product"><b>{row.name}</b><small>{money.format(row.price)} c/u{row.stock <= 0 ? ' · SIN STOCK' : ''}</small></span>
      <span className="close-metric"><small>Inicial</small><strong>{row.initial}</strong></span>
      <span className="close-metric"><small>Compras</small><strong className={row.purchased ? 'purchase-pill' : ''}>+{row.purchased}</strong></span>
      <label className="close-metric final-stock"><small>Stock final</small><input type="number" inputMode="numeric" min="0" max={row.initial + row.purchased} required value={finalStocks[row.id] ?? ''} aria-label={`Stock final de ${row.name}`} onChange={(event) => setFinalStocks({ ...finalStocks, [row.id]: event.target.value })} /></label>
      <span className="close-metric"><small>Vendidos</small><strong className="sold-value">{row.sold}</strong></span>
      <span className="close-metric amount-metric"><small>Importe</small><b>{money.format(row.amount)}</b></span>
    </div>)}
    {!products.length && <div className="cigarette-empty">Primero cargá al menos un cigarrillo.</div>}
    <div className="close-total"><span><small>UNIDADES VENDIDAS</small><b>{totalUnits}</b></span><span><small>VENTA DEL TURNO</small><b>{money.format(totalSales)}</b></span><button className="primary" disabled={!isValid}>Cerrar turno {shifts[shift].toLowerCase()}</button></div>
  </form>
}

function CloseCard({ close }) {
  const [open, setOpen] = useState(false)
  return <article className="close-card">
    <button type="button" className="close-card-summary" onClick={() => setOpen(!open)}>
      <span className={`shift-badge ${close.shift}`}>{shifts[close.shift]}</span>
      <span><small>FECHA</small><b>{new Date(`${close.businessDate}T12:00:00`).toLocaleDateString('es-AR')}</b></span>
      <span><small>VENDIDOS</small><b>{close.totalSold} un.</b></span>
      <span><small>TOTAL</small><b>{money.format(close.totalSales)}</b></span>
      <i>{open ? '−' : '+'}</i>
    </button>
    {open && <div className="close-card-detail">{close.items.map((item) => <div key={item.cigaretteProductId}><span><b>{item.productName}</b><small>{item.initialStock} inicial + {item.purchasedQuantity} compras − {item.finalStock} final</small></span><strong>{item.soldQuantity} × {money.format(item.unitPrice)}</strong><b>{money.format(item.salesAmount)}</b></div>)}<footer><button type="button" className="print-shift-ticket" onClick={() => printCigaretteShiftReceipt(close)}>▤ Imprimir ticket 80 mm</button></footer></div>}
  </article>
}

export default function Cigarettes({ api }) {
  const [tab, setTab] = useState('stock')
  const [date, setDate] = useState(localDateValue)
  const [shift, setShift] = useState('morning')
  const [dashboard, setDashboard] = useState({ products: [], purchases: [], closes: [] })
  const [product, setProduct] = useState({ name: '', price: '', initialStock: '' })
  const [purchase, setPurchase] = useState({ cigaretteProductId: '', quantity: '' })
  const [purchaseSearch, setPurchaseSearch] = useState('')
  const [editing, setEditing] = useState(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [visibleProductCount, setVisibleProductCount] = useState(10)

  const load = useCallback(async () => {
    try {
      setDashboard(await api(`/cigarettes?date=${date}`))
      setMessage('')
    } catch { setMessage('No se pudo cargar la información de cigarrillos.') }
  }, [api, date])

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
    } finally { setBusy(false) }
  }

  const addProduct = async (event) => {
    event.preventDefault()
    const saved = await execute(() => api('/cigarettes/products', { method: 'POST', body: JSON.stringify({ ...product, price: Number(product.price), initialStock: Number(product.initialStock) }) }), 'Cigarrillo agregado correctamente.')
    if (saved) setProduct({ name: '', price: '', initialStock: '' })
  }
  const saveProduct = async (event) => {
    event.preventDefault()
    const saved = await execute(() => api(`/cigarettes/products/${editing.id}`, { method: 'PUT', body: JSON.stringify({ name: editing.name, price: Number(editing.price) }) }), 'Producto actualizado.')
    if (saved) setEditing(null)
  }
  const addPurchase = async (event) => {
    event.preventDefault()
    const saved = await execute(() => api('/cigarettes/purchases', { method: 'POST', body: JSON.stringify({ cigaretteProductId: Number(purchase.cigaretteProductId), quantity: Number(purchase.quantity), businessDate: date, shift }) }), 'Compra registrada y stock actualizado.')
    if (saved) {
      setPurchase({ cigaretteProductId: '', quantity: '' })
      setPurchaseSearch('')
    }
  }
  const closeShift = async (request) => {
    if (!window.confirm(`¿Confirmar el cierre del turno ${shifts[shift].toLowerCase()}? Esta acción no se puede deshacer.`)) return
    const saved = await execute(() => api('/cigarettes/closes', { method: 'POST', body: JSON.stringify(request) }), 'Turno cerrado correctamente.')
    if (saved) setTab('history')
  }

  const selectedClose = dashboard.closes.find((close) => close.shift === shift)
  const purchases = dashboard.purchases.filter((item) => item.shift === shift)
  const purchasedUnits = purchases.reduce((total, item) => total + item.quantity, 0)
  const purchaseResults = purchaseSearch.trim() && !purchase.cigaretteProductId
    ? dashboard.products.filter((item) => item.name.toLowerCase().includes(purchaseSearch.trim().toLowerCase()))
    : []
  const visibleProducts = dashboard.products.slice(0, visibleProductCount)

  return <div className="cigarettes-page">
    <header className="cigarettes-header"><div><p className="eyebrow">CONTROL DE INVENTARIO</p><h1>Cigarrillos</h1><p>Compras, stock y ventas de cada turno en un solo lugar.</p></div><label className="date-picker"><span>Fecha de trabajo</span><input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label></header>
    <nav className="cigarette-tabs" aria-label="Secciones de cigarrillos">
      {[['stock', '▦', 'Stock y precios'], ['purchases', '↓', 'Compras'], ['close', '✓', 'Cerrar turno'], ['history', '◷', 'Calendario y cierres']].map(([value, icon, label]) => <button key={value} className={tab === value ? 'active' : ''} onClick={() => setTab(value)}><i>{icon}</i>{label}</button>)}
    </nav>
    {message && <p className={message.includes('correctamente') || message.includes('actualizado') ? 'cigarette-message success' : 'cigarette-message'}>{message}</p>}

    {tab === 'stock' && <div className="cigarette-columns">
      <section className="cigarette-card"><div className="section-heading"><div><small>INVENTARIO ACTUAL</small><h2>Productos cargados</h2></div><span>{dashboard.products.length} variedades</span></div>
        <div className="stock-list">{visibleProducts.map((item) => editing?.id === item.id ? <form className="stock-edit" key={item.id} onSubmit={saveProduct}><input required maxLength="100" value={editing.name} onChange={(event) => setEditing({ ...editing, name: event.target.value })} /><input required type="number" min="0.01" step="0.01" value={editing.price} onChange={(event) => setEditing({ ...editing, price: event.target.value })} /><button disabled={busy}>Guardar</button><button type="button" onClick={() => setEditing(null)}>Cancelar</button></form> : <article className="stock-item" key={item.id}><div className="cigarette-pack">▥</div><span><b>{item.name}</b><small>{money.format(item.price)} por unidad</small></span><strong className={item.stock <= 5 ? 'low' : ''}>{item.stock}<small>EN STOCK</small></strong><button title="Editar" onClick={() => setEditing({ ...item })}>✎</button><button className="remove-cigarette" title="Quitar" onClick={() => { if (window.confirm(`¿Quitar ${item.name}?`)) execute(() => api(`/cigarettes/products/${item.id}`, { method: 'DELETE' }), 'Producto quitado.') }}>×</button></article>)}{!dashboard.products.length && <div className="cigarette-empty">Todavía no hay cigarrillos cargados.</div>}</div>
        {visibleProductCount < dashboard.products.length && <button type="button" className="load-more-button" onClick={() => setVisibleProductCount((count) => count + 10)}>Cargar 10 más</button>}
      </section>
      <section className="cigarette-card accent-card"><small>NUEVA VARIEDAD</small><h2>Cargar cigarrillo</h2><p>Definí el precio de venta y el stock con el que comenzás.</p><form className="cigarette-form" onSubmit={addProduct}><label>Marca y presentación<input required maxLength="100" placeholder="Ej.: Marlboro Box 20" value={product.name} onChange={(event) => setProduct({ ...product, name: event.target.value })} /></label><div><label>Precio de venta<input required type="number" min="0.01" step="0.01" placeholder="$ 0" value={product.price} onChange={(event) => setProduct({ ...product, price: event.target.value })} /></label><label>Stock inicial<input required type="number" min="0" placeholder="0" value={product.initialStock} onChange={(event) => setProduct({ ...product, initialStock: event.target.value })} /></label></div><button className="primary wide" disabled={busy}>+ Agregar al inventario</button></form></section>
    </div>}

    {tab === 'purchases' && <div className="cigarette-columns">
      <section className="cigarette-card accent-card"><small>REPOSICIÓN · TURNO {shifts[shift].toUpperCase()}</small><h2>Registrar compra</h2><div className="shift-switch">{Object.entries(shifts).map(([value, label]) => <button type="button" key={value} className={shift === value ? 'active' : ''} onClick={() => setShift(value)}>{label}</button>)}</div><form className="cigarette-form" onSubmit={addPurchase}><label>Producto<div className="cigarette-product-search"><span>⌕</span><input required autoComplete="off" placeholder="Buscar cigarrillo..." value={purchaseSearch} onChange={(event) => { setPurchaseSearch(event.target.value); setPurchase({ ...purchase, cigaretteProductId: '' }) }} />{purchase.cigaretteProductId && <button type="button" aria-label="Cambiar producto" title="Cambiar producto" onClick={() => { setPurchaseSearch(''); setPurchase({ ...purchase, cigaretteProductId: '' }) }}>×</button>}</div></label>{purchaseResults.length > 0 && <div className="cigarette-search-results">{purchaseResults.map((item) => <button type="button" key={item.id} onClick={() => { setPurchaseSearch(item.name); setPurchase({ ...purchase, cigaretteProductId: item.id }) }}><span>{item.name}</span><small>Stock actual: {item.stock}</small></button>)}</div>}{purchaseSearch.trim() && !purchase.cigaretteProductId && !purchaseResults.length && <p className="cigarette-search-empty">No se encontraron cigarrillos.</p>}<label className="purchase-quantity">Cantidad comprada<input required type="number" min="1" value={purchase.quantity} onChange={(event) => setPurchase({ ...purchase, quantity: event.target.value })} /></label><button className="primary wide" disabled={busy || !purchase.cigaretteProductId}>Registrar compra</button></form></section>
      <section className="cigarette-card"><div className="section-heading"><div><small>MOVIMIENTOS DEL DÍA</small><h2>Compras del turno</h2></div><b>{purchasedUnits} unidades</b></div><div className="purchase-list">{purchases.map((item) => <article key={item.id}><span><b>{item.productName}</b><small>Stock incorporado</small></span><strong>+{item.quantity} unidades</strong></article>)}{!purchases.length && <div className="cigarette-empty">No hay compras para este turno.</div>}</div></section>
    </div>}

    {tab === 'close' && <section className="cigarette-card close-section"><div className="section-heading"><div><small>ARQUEO DE INVENTARIO</small><h2>Cierre de turno</h2></div><div className="shift-switch">{Object.entries(shifts).map(([value, label]) => <button key={value} className={shift === value ? 'active' : ''} onClick={() => setShift(value)}>{label}</button>)}</div></div><p className="close-help">Ingresá el stock físico final. Las ventas se calculan automáticamente con el stock inicial y las compras del turno.</p>{selectedClose ? <div className="already-closed"><span>✓</span><div><b>Turno {shifts[shift].toLowerCase()} cerrado</b><p>Se vendieron {selectedClose.totalSold} unidades por {money.format(selectedClose.totalSales)}.</p></div></div> : <ShiftCloseForm key={`${date}-${shift}-${dashboard.products.map((item) => item.stock).join('-')}`} products={dashboard.products} purchases={dashboard.purchases} shift={shift} date={date} onClose={closeShift} />}</section>}

    {tab === 'history' && <section className="cigarette-card history-section"><div className="calendar-hero"><div><small>CALENDARIO</small><h2>Cierres del {new Date(`${date}T12:00:00`).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })}</h2><p>Elegí otra fecha arriba para consultar sus cierres.</p></div><div className="daily-total"><small>VENTA DEL DÍA</small><b>{money.format(dashboard.closes.reduce((total, close) => total + close.totalSales, 0))}</b></div></div><div className="closes-list">{dashboard.closes.map((close) => <CloseCard key={close.id} close={close} />)}{!dashboard.closes.length && <div className="cigarette-empty large">No hay cierres registrados en esta fecha.</div>}</div></section>}
  </div>
}
