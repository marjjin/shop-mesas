import { useState } from 'react'
import PendingIcon from './PendingIcon.jsx'

export default function PendingOrderForm({ api, load, onCreated, inputRef }) {
  const [customerName, setCustomerName] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  const createOrder = async (event) => {
    event.preventDefault()
    if (creating) return
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


  return <form className="pending-create" onSubmit={createOrder} aria-busy={creating}>
    <div className="pending-create-heading"><span><PendingIcon name="plus" /></span><div><h2>Nuevo pedido</h2><p>Sin asignar una mesa todavía.</p></div></div>
    <label htmlFor="pending-customer">Nombre del cliente o pedido</label>
    <div className="pending-create-fields"><div className="pending-input-wrap"><PendingIcon name="user" /><input ref={inputRef} id="pending-customer" maxLength="80" required disabled={creating} autoComplete="off" value={customerName} onChange={(event) => setCustomerName(event.target.value)} placeholder="Ej.: Martín" aria-describedby="pending-create-help" /></div><button className="pending-primary" disabled={creating || !customerName.trim()}><PendingIcon name="plus" />{creating ? 'Creando pedido…' : 'Crear pedido'}</button></div>
    {error && <p className="pending-error" role="alert">{error}</p>}
    <p id="pending-create-help" className="pending-create-help"><PendingIcon name="info" />Después de crearlo, podés agregar los artículos.</p>
  </form>
}
