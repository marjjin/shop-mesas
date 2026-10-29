import { shifts, quickAmounts } from '../cashDropPresentation.js'
import { money } from '../../../shared/utils/currency.js'
import CashDropIcon from './CashDropIcon.jsx'

export default function CashDropForm({ cashDrops }) {
  const { openShift, create, amountInputRef, amount, setAmount, busy,
    activeDrops, activeTotal } = cashDrops

  return <section className="cash-drops-card cash-drops-form-card">
    <div className="cash-drops-card-kicker"><small>{openShift ? 'NUEVA TIRADA' : 'REGISTRO DEL DÍA'}</small>{openShift && <span className="cash-drops-live"><i />En curso</span>}</div>
    <div className="cash-drops-form-title"><span><CashDropIcon name={openShift ? 'cash' : 'lock'} /></span><h2>{openShift ? shifts[openShift.shift] : 'No hay turno abierto'}</h2></div>
    {openShift ? <>
      <p className="cash-drops-form-help">Retirá el dinero físicamente y registrá el importe exacto. La tirada quedará asociada al cierre de este turno.</p>
      <form onSubmit={create}>
        <label>Importe retirado<span className="cash-drops-amount-field"><span aria-hidden="true">$</span><input ref={amountInputRef} required type="number" min="0.01" step="0.01" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0,00" /></span></label>
        <div className="cash-drops-quick-amounts" aria-label="Importes frecuentes"><span>Sumar al importe</span>{quickAmounts.map((quickAmount) => <button type="button" key={quickAmount} onClick={() => setAmount(String(Number(amount || 0) + quickAmount))}>+ {money.format(quickAmount)}</button>)}</div>
        <button className="primary wide" disabled={busy}><CashDropIcon name="plus" />{busy ? 'Guardando…' : 'Registrar tirada'}</button>
      </form>
      <div className="cash-drops-current-total"><span><b>Total del turno</b><small>{activeDrops.length} {activeDrops.length === 1 ? 'tirada registrada' : 'tiradas registradas'}</small></span><strong>{money.format(activeTotal)}</strong></div>
    </> : <p className="cash-drops-form-help">Los dos turnos de esta fecha ya están cerrados. Podés consultar, imprimir o corregir el historial abajo.</p>}
  </section>
}
