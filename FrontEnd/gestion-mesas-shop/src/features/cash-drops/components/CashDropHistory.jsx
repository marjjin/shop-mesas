import { shifts, formatTime } from '../cashDropPresentation.js'
import { money } from '../../../shared/utils/currency.js'
import CashDropIcon from './CashDropIcon.jsx'

export default function CashDropHistory({ cashDrops }) {
  const { totalForDate, drops, editing, save, editingAmount, setEditingAmount,
    busy, setEditing, print, remove } = cashDrops

  return <section className="cash-drops-card cash-drops-history-card">
    <div className="cash-drops-section-heading"><span className="cash-drops-heading-icon"><CashDropIcon name="receipt" /></span><div><small>HISTORIAL</small><h2>Tiradas del día</h2></div><div className="cash-drops-history-total"><small>Total del día</small><strong>{money.format(totalForDate)}</strong></div></div>
    <p className="cash-drops-history-help">Usá “Ticket” para imprimir el comprobante y envolver el efectivo.</p>
    {Object.entries(shifts).map(([shift, label]) => <div className="cash-drops-shift" key={shift}>
      <header><span className={`cash-drops-shift-icon ${shift}`}><CashDropIcon name={shift === 'morning' ? 'sun' : 'sunset'} /></span><div><b>Turno {label}</b><small>{drops[shift].length ? `${drops[shift].length} ${drops[shift].length === 1 ? 'tirada' : 'tiradas'}` : 'Sin movimientos'}</small></div><strong>{money.format(drops[shift].reduce((total, drop) => total + drop.amount, 0))}</strong></header>
      {drops[shift].length ? <div className="cash-drops-list">{drops[shift].map((drop) => editing?.id === drop.id ? <form className="cash-drop-edit" key={drop.id} onSubmit={save}><div className="cash-drop-edit-heading"><CashDropIcon name="edit" /><b>Editar tirada</b></div><label>Importe retirado<input required type="number" min="0.01" step="0.01" value={editingAmount} onChange={(event) => setEditingAmount(event.target.value)} /></label><div className="cash-drop-edit-actions"><button disabled={busy}><CashDropIcon name="check" />Guardar</button><button type="button" onClick={() => setEditing(null)}>Cancelar</button></div></form> : <article className={drop.isClosed ? 'closed' : ''} key={drop.id}><span className="cash-drop-receipt-icon"><CashDropIcon name="receipt" /></span><span className="cash-drop-record"><b>{money.format(drop.amount)}</b><small>{formatTime(drop.createdAt)}{drop.isClosed ? ' · Turno cerrado' : ''}</small></span><div className="cash-drop-actions">{drop.isClosed && <em><CashDropIcon name="lock" />Asignada al cierre</em>}<footer><button type="button" disabled={busy} title="Imprimir ticket" onClick={() => print(drop)}><CashDropIcon name="print" />Ticket</button><button type="button" disabled={busy} title="Editar" onClick={() => { setEditing(drop); setEditingAmount(String(drop.amount)) }}><CashDropIcon name="edit" />Editar</button><button type="button" disabled={busy} title="Eliminar" onClick={() => remove(drop)}><CashDropIcon name="trash" />Eliminar</button></footer></div></article>)}</div> : <p className="cash-drops-empty"><CashDropIcon name="receipt" />No hay tiradas registradas en este turno.</p>}
    </div>)}
  </section>
}
