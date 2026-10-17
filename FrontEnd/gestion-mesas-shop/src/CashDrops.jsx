import { useCallback, useEffect, useRef, useState } from 'react'
import './CashDrops.css'
import { openReceiptPrintWindow, printCashDropReceipt } from './receipt.js'

const shifts = { morning: 'Mañana', afternoon: 'Tarde' }
const quickAmounts = [10000, 20000, 50000, 100000]
const money = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })

function localDateValue(date = new Date()) {
  const offset = date.getTimezoneOffset() * 60000
  return new Date(date.getTime() - offset).toISOString().slice(0, 10)
}

function formatTime(value) {
  return new Intl.DateTimeFormat('es-AR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
}

export default function CashDrops({ api }) {
  const [date, setDate] = useState(localDateValue())
  const [openShift, setOpenShift] = useState(null)
  const [drops, setDrops] = useState({ morning: [], afternoon: [] })
  const [amount, setAmount] = useState('')
  const [editing, setEditing] = useState(null)
  const [editingAmount, setEditingAmount] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const amountInputRef = useRef(null)

  const load = useCallback(async () => {
    try {
      const [open, morning, afternoon] = await Promise.all([
        api(`/cash-drops/open?date=${date}`),
        api(`/cash-drops?date=${date}&shift=morning`),
        api(`/cash-drops?date=${date}&shift=afternoon`)
      ])
      setOpenShift(open.shift ? { date: open.businessDate, shift: open.shift } : null)
      setDrops({ morning, afternoon })
      setMessage('')
    } catch (error) {
      setMessage(error.message || 'No se pudieron cargar las tiradas.')
    }
  }, [api, date])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (openShift) amountInputRef.current?.focus()
  }, [openShift, date])

  const activeDrops = openShift ? drops[openShift.shift] : []
  const activeTotal = activeDrops.reduce((total, drop) => total + drop.amount, 0)
  const totalForDate = [...drops.morning, ...drops.afternoon].reduce((total, drop) => total + drop.amount, 0)

  const create = async (event) => {
    event.preventDefault()
    const parsedAmount = Number(amount)
    if (!openShift) return setMessage('No hay un turno abierto para registrar tiradas.')
    if (!parsedAmount || parsedAmount <= 0) return setMessage('Ingresá un importe válido.')
    setBusy(true)
    const printWindow = openReceiptPrintWindow()
    try {
      const createdDrop = await api('/cash-drops', { method: 'POST', body: JSON.stringify({ amount: parsedAmount, businessDate: openShift.date, shift: openShift.shift }) })
      setAmount('')
      const printed = printCashDropReceipt(createdDrop, printWindow)
      await load()
      setMessage(printed ? 'Tirada registrada. Se abrió el ticket para imprimir.' : 'Tirada registrada correctamente. Habilitá las ventanas emergentes para imprimir el ticket automáticamente.')
      amountInputRef.current?.focus()
    } catch (error) {
      if (printWindow && !printWindow.closed) printWindow.close()
      setMessage(error.message)
    } finally {
      setBusy(false)
    }
  }

  const save = async (event) => {
    event.preventDefault()
    const parsedAmount = Number(editingAmount)
    if (!parsedAmount || parsedAmount <= 0) return setMessage('Ingresá un importe válido.')
    setBusy(true)
    try {
      await api(`/cash-drops/${editing.id}`, { method: 'PUT', body: JSON.stringify({ amount: parsedAmount }) })
      setEditing(null)
      await load()
      setMessage('Tirada actualizada correctamente.')
    } catch (error) {
      setMessage(error.message)
    } finally {
      setBusy(false)
    }
  }

  const remove = async (drop) => {
    if (!window.confirm(`¿Eliminar la tirada de ${money.format(drop.amount)}?`)) return
    setBusy(true)
    try {
      await api(`/cash-drops/${drop.id}`, { method: 'DELETE' })
      await load()
      setMessage('Tirada eliminada correctamente.')
    } catch (error) {
      setMessage(error.message)
    } finally {
      setBusy(false)
    }
  }

  const print = (drop) => {
    if (!printCashDropReceipt(drop)) setMessage('No se pudo abrir el ticket. Habilitá las ventanas emergentes del navegador.')
  }

  return <div className="cash-drops-page">
    <header className="cash-drops-header">
      <div>
        <p className="eyebrow">CONTROL DE EFECTIVO</p>
        <h1>Tiradas</h1>
        <p>Registrá el efectivo retirado físicamente de la caja durante cada turno.</p>
      </div>
      <label className="date-picker"><span>Fecha de trabajo</span><input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
    </header>

    {message && <p className={message.includes('correctamente') ? 'cash-drops-message success' : 'cash-drops-message'} role="status">{message}</p>}

    <section className="cash-drops-overview" aria-label="Resumen de tiradas">
      <div><small>TIRADAS DEL DÍA</small><strong>{money.format(totalForDate)}</strong><span>Suma de mañana y tarde</span></div>
      <div className="cash-drops-overview-active"><small>TURNO ACTIVO</small><strong>{openShift ? shifts[openShift.shift] : 'Sin turno'}</strong><span>{openShift ? `${money.format(activeTotal)} registrados para el arqueo` : 'No se pueden registrar nuevas tiradas'}</span></div>
      <div><small>ESTADO</small><strong>{openShift ? 'Listo para registrar' : 'Día cerrado'}</strong><span>{openShift ? 'Podés registrar, imprimir, editar o eliminar' : 'Solo consulta histórica'}</span></div>
    </section>

    <div className="cash-drops-grid">
      <section className="cash-drops-card cash-drops-form-card">
        <div className="cash-drops-card-kicker"><small>TURNO ABIERTO</small>{openShift && <span className="cash-drops-live">● En curso</span>}</div>
        <h2>{openShift ? shifts[openShift.shift] : 'No hay turno abierto'}</h2>
        {openShift ? <>
          <p className="cash-drops-form-help">Retirá el dinero físicamente y registrá el importe exacto. La tirada quedará asociada al cierre de este turno.</p>
          <form onSubmit={create}>
            <label>Importe retirado<input ref={amountInputRef} required type="number" min="0.01" step="0.01" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="$ 0" /></label>
            <div className="cash-drops-quick-amounts" aria-label="Importes frecuentes"><span>Sumar al importe</span>{quickAmounts.map((quickAmount) => <button type="button" key={quickAmount} onClick={() => setAmount(String(Number(amount || 0) + quickAmount))}>+ {money.format(quickAmount)}</button>)}</div>
            <button className="primary wide" disabled={busy}>{busy ? 'Guardando…' : '+ Registrar tirada'}</button>
          </form>
          <div className="cash-drops-current-total"><span><b>Total del turno</b><small>{activeDrops.length} {activeDrops.length === 1 ? 'tirada registrada' : 'tiradas registradas'}</small></span><strong>{money.format(activeTotal)}</strong></div>
        </> : <p className="cash-drops-form-help">Los dos turnos de esta fecha ya están cerrados. Podés consultar, imprimir o corregir el historial abajo.</p>}
      </section>

      <section className="cash-drops-card cash-drops-history-card">
        <div className="cash-drops-section-heading"><div><small>HISTORIAL</small><h2>Tiradas del día</h2><p>Usá “Ticket” para imprimir el comprobante y envolver el efectivo.</p></div><strong>{money.format(totalForDate)}</strong></div>
        {Object.entries(shifts).map(([shift, label]) => <div className="cash-drops-shift" key={shift}>
          <header><div><b>Turno {label}</b><small>{drops[shift].length ? `${drops[shift].length} ${drops[shift].length === 1 ? 'tirada' : 'tiradas'}` : 'Sin movimientos'}</small></div><strong>{money.format(drops[shift].reduce((total, drop) => total + drop.amount, 0))}</strong></header>
          {drops[shift].length ? <div className="cash-drops-list">{drops[shift].map((drop) => editing?.id === drop.id ? <form className="cash-drop-edit" key={drop.id} onSubmit={save}><input required type="number" min="0.01" step="0.01" value={editingAmount} onChange={(event) => setEditingAmount(event.target.value)} /><button disabled={busy}>Guardar</button><button type="button" onClick={() => setEditing(null)}>Cancelar</button></form> : <article className={drop.isClosed ? 'closed' : ''} key={drop.id}><span><b>{money.format(drop.amount)}</b><small>{formatTime(drop.createdAt)}{drop.isClosed ? ' · Turno cerrado' : ''}</small></span><div className="cash-drop-actions">{drop.isClosed && <em>Asignada al cierre</em>}<footer><button type="button" disabled={busy} title="Imprimir ticket" onClick={() => print(drop)}>Ticket</button><button type="button" disabled={busy} title="Editar" onClick={() => { setEditing(drop); setEditingAmount(String(drop.amount)) }}>Editar</button><button type="button" disabled={busy} title="Eliminar" onClick={() => remove(drop)}>Eliminar</button></footer></div></article>)}</div> : <p className="cash-drops-empty">No hay tiradas registradas en este turno.</p>}
        </div>)}
      </section>
    </div>
  </div>
}
