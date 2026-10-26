import { useState } from 'react'

export default function PendingOrderForm({ api, load, onCreated }) {
  const [customerName, setCustomerName] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  const createOrder = async (event) => {
    event.preventDefault()
    const name = customerName.trim()
    if (!name) return
    setCreating(true)
    setError('')
    try {
      const createdOrder = await api('/pending-orders', { method: 'POST', body: JSON.stringify({ customerName: name }) })
      onCreated(createdOrder.id)
      setCustomerName('')
      await load()
    } catch {
      setError('No se pudo crear el pedido.')
    } finally {
      setCreating(false)
    }
  }


  return <form className="pending-create" onSubmit={createOrder}>
    <label htmlFor="pending-customer">Nombre del cliente o pedido</label>
    <div><input id="pending-customer" maxLength="80" required value={customerName} onChange={(event) => setCustomerName(event.target.value)} placeholder="Ej.: Martín" /><button className="primary" disabled={creating || !customerName.trim()}>{creating ? 'Creando…' : '+ Crear pedido'}</button></div>
    {error && <small>{error}</small>}
  </form>
}
