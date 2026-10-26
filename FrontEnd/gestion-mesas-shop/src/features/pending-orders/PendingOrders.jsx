import { useState } from 'react'
import PendingOrderCard from './components/PendingOrderCard.jsx'
import PendingOrderForm from './components/PendingOrderForm.jsx'
import './PendingOrders.css'

export default function PendingOrders({ data, api, load, onChooseTable }) {
  const [focusedOrderId, setFocusedOrderId] = useState(null)
  const pendingOrders = data.pendingOrders || []

  return <>
    <header><div><p className="eyebrow">ANTES DE ELEGIR MESA</p><h1>Pedidos</h1><p>Tomá el pedido por nombre y asignalo cuando el cliente elija dónde sentarse.</p></div></header>
    <section className="pending-orders-panel">
      <PendingOrderForm api={api} load={load} onCreated={setFocusedOrderId} />
      {pendingOrders.length ? <div className="pending-grid">{pendingOrders.map((order) => <PendingOrderCard key={order.id} order={order} data={data} api={api} load={load} onChooseTable={onChooseTable} shouldFocusSearch={focusedOrderId === order.id} onSearchFocused={() => setFocusedOrderId(null)} />)}</div> : <div className="pending-empty"><b>No hay pedidos esperando mesa</b><span>Creá uno cuando llegue un cliente y todavía no sepas dónde se sentará.</span></div>}
    </section>
  </>
}
