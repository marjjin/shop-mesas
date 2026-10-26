import { shifts, formatTime } from '../cashDropPresentation.js'
import { money } from '../../../shared/utils/currency.js'

export default function CashDropHistory({ cashDrops }) {
  const { totalForDate, drops, editing, save, editingAmount, setEditingAmount,
    busy, setEditing, print, remove } = cashDrops

  return <section className="cash-drops-card cash-drops-history-card">
    <div className="cash-drops-section-heading"><div><small>HISTORIAL</small><h2>Tiradas del día</h2><p>Usá “Ticket” para imprimir el comprobante y envolver el efectivo.</p></div><strong>{money.format(totalForDate)}</strong></div>
    {Object.entries(shifts).map(([shift, label]) => <div className="cash-drops-shift" key={shift}>
      <header><div><b>Turno {label}</b><small>{drops[shift].length ? `${drops[shift].length} ${drops[shift].length === 1 ? 'tirada' : 'tiradas'}` : 'Sin movimientos'}</small></div><strong>{money.format(drops[shift].reduce((total, drop) => total + drop.amount, 0))}</strong></header>
      {drops[shift].length ? <div className="cash-drops-list">{drops[shift].map((drop) => editing?.id === drop.id ? <form className="cash-drop-edit" key={drop.id} onSubmit={save}><input required type="number" min="0.01" step="0.01" value={editingAmount} onChange={(event) => setEditingAmount(event.target.value)} /><button disabled={busy}>Guardar</button><button type="button" onClick={() => setEditing(null)}>Cancelar</button></form> : <article className={drop.isClosed ? 'closed' : ''} key={drop.id}><span><b>{money.format(drop.amount)}</b><small>{formatTime(drop.createdAt)}{drop.isClosed ? ' · Turno cerrado' : ''}</small></span><div className="cash-drop-actions">{drop.isClosed && <em>Asignada al cierre</em>}<footer><button type="button" disabled={busy} title="Imprimir ticket" onClick={() => print(drop)}>Ticket</button><button type="button" disabled={busy} title="Editar" onClick={() => { setEditing(drop); setEditingAmount(String(drop.amount)) }}>Editar</button><button type="button" disabled={busy} title="Eliminar" onClick={() => remove(drop)}>Eliminar</button></footer></div></article>)}</div> : <p className="cash-drops-empty">No hay tiradas registradas en este turno.</p>}
    </div>)}
  </section>
}
