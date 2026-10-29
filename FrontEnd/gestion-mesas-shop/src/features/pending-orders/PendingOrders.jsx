import { useRef, useState } from 'react'
import PendingOrderCard from './components/PendingOrderCard.jsx'
import PendingOrderForm from './components/PendingOrderForm.jsx'
import PendingIcon from './components/PendingIcon.jsx'
import { filterPendingOrders } from './domain/pendingOrders.js'
import './PendingOrders.css'

export default function PendingOrders({ data, api, load, onChooseTable }) {
  const [focusedOrderId, setFocusedOrderId] = useState(null)
  const [search, setSearch] = useState('')
  const customerInputRef = useRef(null)
  const pendingOrders = data.pendingOrders || []
  const visibleOrders = filterPendingOrders(pendingOrders, search)
  const orderIds = new Set(pendingOrders.map((order) => order.id))
  const itemCount = (data.pendingOrderItems || []).filter((item) => orderIds.has(item.pendingOrderId)).reduce((total, item) => total + item.quantity, 0)
  const freeTableCount = data.tables.filter((table) => table.status === 'free').length

  return <div className="pending-page">
    <header className="pending-page-header"><div><p className="eyebrow">OPERACIÓN DEL SALÓN</p><h1>Pedidos</h1><p>Registrá consumos por nombre y asigná el pedido a una mesa cuando esté disponible.</p></div><span className="pending-page-tag"><PendingIcon name="order" />Sin mesa asignada</span></header>

    <div className="pending-overview" role="group" aria-label="Resumen de pedidos">
      <div><span className="pending-stat-icon"><PendingIcon name="order" /></span><dl><dt>Pedidos pendientes</dt><dd>{pendingOrders.length}<span>sin asignar</span></dd></dl></div>
      <div><span className="pending-stat-icon neutral"><PendingIcon name="box" /></span><dl><dt>Artículos en pedidos</dt><dd>{itemCount}<span>unidades</span></dd></dl></div>
      <div><span className="pending-stat-icon green"><PendingIcon name="table" /></span><dl><dt>Mesas libres</dt><dd>{freeTableCount}<span>disponibles</span></dd></dl></div>
    </div>

    <div className="pending-workspace">
      <aside className="pending-create-column" aria-label="Crear pedido">
        <PendingOrderForm api={api} load={load} inputRef={customerInputRef} onCreated={(id) => { setSearch(''); setFocusedOrderId(id) }} />
        <div className="pending-guide"><h2>Cómo asignar un pedido</h2><ol><li><span>1</span><div><b>Registrá el nombre</b><p>Usalo para identificar el pedido.</p></div></li><li><span>2</span><div><b>Cargá los artículos</b><p>Podés seguir agregando consumos después.</p></div></li><li><span>3</span><div><b>Elegí una mesa</b><p>El pedido se transfiere a su cuenta.</p></div></li></ol></div>
      </aside>

      <section className="pending-orders-panel" aria-labelledby="pending-list-title">
        <div className="pending-list-heading"><div><h2 id="pending-list-title">En espera <span>{pendingOrders.length}</span></h2><p>Pedidos pendientes de asignación.</p></div></div>
        {pendingOrders.length > 0 && <div className="pending-list-toolbar"><div className="pending-input-wrap"><PendingIcon name="search" /><input type="search" aria-label="Buscar pedido por nombre o número" placeholder="Buscar nombre o número de pedido…" value={search} onChange={(event) => setSearch(event.target.value)} /></div><span role="status">{visibleOrders.length} de {pendingOrders.length}</span></div>}
        {visibleOrders.length ? <div className="pending-grid">{visibleOrders.map((order) => <PendingOrderCard key={order.id} order={order} data={data} api={api} load={load} onChooseTable={onChooseTable} shouldFocusSearch={focusedOrderId === order.id} onSearchFocused={() => setFocusedOrderId(null)} />)}</div>
          : <div className="pending-empty"><span className="pending-empty-icon"><PendingIcon name={pendingOrders.length ? 'search' : 'order'} /></span><h3>{pendingOrders.length ? 'No encontramos ese pedido' : 'No hay pedidos en espera'}</h3><p>{pendingOrders.length ? 'Probá con otro nombre o con el número del pedido.' : 'Creá un pedido para registrar consumos antes de elegir una mesa.'}</p><button type="button" className="pending-secondary" onClick={() => pendingOrders.length ? setSearch('') : customerInputRef.current?.focus()}><PendingIcon name={pendingOrders.length ? 'close' : 'plus'} />{pendingOrders.length ? 'Limpiar búsqueda' : 'Crear primer pedido'}</button></div>}
        <p className="pending-list-note"><PendingIcon name="info" />Los pedidos permanecen aquí hasta que los asignes o los canceles.</p>
      </section>
    </div>
  </div>
}
