import { useCallback, useEffect, useState } from 'react'
import './Suppliers.css'

const money = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })

export default function Suppliers({ api }) {
  const [suppliers, setSuppliers] = useState([])
  const [name, setName] = useState('')
  const [payment, setPayment] = useState({})
  const [message, setMessage] = useState('')

  const load = useCallback(async () => {
    try { setSuppliers(await api('/suppliers')); setMessage('') } catch (error) { setMessage(error.message) }
  }, [api])
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load() }, [load])

  const create = async (event) => {
    event.preventDefault()
    try {
      await api('/suppliers', { method: 'POST', body: JSON.stringify({ name }) })
      setName('')
      await load()
    } catch (error) { setMessage(error.message) }
  }
  const pay = async (event, supplier) => {
    event.preventDefault()
    const amount = Number(payment[supplier.id] || 0)
    if (!amount || amount <= 0) return setMessage('Ingresá un importe de pago válido.')
    if (amount > supplier.balance) return setMessage(`El pago no puede superar el saldo disponible de ${supplier.name}.`)
    try {
      await api(`/suppliers/${supplier.id}/payments`, { method: 'POST', body: JSON.stringify({ amount }) })
      setPayment({ ...payment, [supplier.id]: '' })
      await load()
    } catch (error) { setMessage(error.message) }
  }
  const deactivate = async (supplier) => {
    if (!window.confirm(`¿Desactivar ${supplier.name}? Se conservará su historial.`)) return
    try { await api(`/suppliers/${supplier.id}`, { method: 'DELETE' }); await load() } catch (error) { setMessage(error.message) }
  }

  return <div className="suppliers-page">
    <header><div><p className="eyebrow">FONDOS RESERVADOS</p><h1>Proveedores</h1><p>Administrá saldos reservados, pagos y el historial de cada proveedor.</p></div></header>
    {message && <p className="supplier-message">{message}</p>}
    <section className="supplier-create"><div><small>NUEVO PROVEEDOR</small><h2>Agregar proveedor</h2></div><form onSubmit={create}><input required maxLength="100" value={name} onChange={(event) => setName(event.target.value)} placeholder="Nombre del proveedor" /><button className="primary">Agregar</button></form></section>
    <section className="supplier-grid">
      {suppliers.filter((supplier) => supplier.isActive).map((supplier) => <article className="supplier-card" key={supplier.id}>
        <header><div><small>PROVEEDOR</small><h2>{supplier.name}</h2></div><button type="button" className="supplier-remove" onClick={() => deactivate(supplier)} title="Desactivar proveedor">×</button></header>
        <div className="supplier-balance"><span>Saldo reservado</span><strong>{money.format(supplier.balance)}</strong></div>
        <form className="supplier-payment" onSubmit={(event) => pay(event, supplier)}><label>Registrar pago<input type="number" min="1" max={supplier.balance} step="0.01" disabled={!supplier.balance} value={payment[supplier.id] ?? ''} onChange={(event) => setPayment({ ...payment, [supplier.id]: event.target.value })} placeholder="Importe" /></label><button disabled={!supplier.balance}>Descontar</button></form>
        <details><summary>Historial ({supplier.transactions.length})</summary><div className="supplier-history">{supplier.transactions.length ? supplier.transactions.map((transaction) => <div key={transaction.id}><span><b>{transaction.type === 'allocation' ? 'Reserva de cierre' : 'Pago registrado'}</b><small>{new Date(`${transaction.businessDate}T12:00:00`).toLocaleDateString('es-AR')}{transaction.shift ? ` · ${transaction.shift === 'morning' ? 'mañana' : 'tarde'}` : ''}</small></span><strong className={transaction.type}>{transaction.type === 'allocation' ? '+' : '−'}{money.format(transaction.amount)}</strong></div>) : <p>Sin movimientos todavía.</p>}</div></details>
      </article>)}
      {!suppliers.some((supplier) => supplier.isActive) && <p className="supplier-empty">Todavía no hay proveedores activos. Creá uno para reservar fondos durante el cierre de turno.</p>}
    </section>
  </div>
}
