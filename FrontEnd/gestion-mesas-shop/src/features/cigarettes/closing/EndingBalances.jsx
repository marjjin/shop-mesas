import ClosingIcon from './ClosingIcon.jsx'
import { money } from '../../../shared/utils/currency.js'

export default function EndingBalances({ balances, cashDrops = [], onChange, onReceivedChange }) {
  const receivedChange = Number(balances.receivedChange || 0)
  const nextShiftChange = Number(balances.change || 0)
  const cashDropsTotal = cashDrops.reduce((total, drop) => total + drop.amount, 0)
  const cashInBox = Number(balances.cash || 0) + cashDropsTotal
  const totalCash = cashInBox + Number(balances.mercadoPago || 0) + Number(balances.posnet || 0) + nextShiftChange - receivedChange
  const changeCash = (event) => {
    const value = event.target.value
    onChange({ ...balances, cash: value === '' ? '' : String(Math.max(0, Number(value) - cashDropsTotal)) })
  }
  return <section className="ending-balances">
    <header className="ending-balances-header"><span className="closing-block-icon"><ClosingIcon name="wallet" /></span><div><small>ARQUEO DE CAJA</small><h3>Dinero al finalizar el turno</h3><p>Registrá cada medio de cobro antes de confirmar el cierre.</p></div></header>
    <div className="ending-arqueo-layout"><div className="ending-arqueo-inputs"><div className="ending-payment-inputs">
       <label><span>Efectivo en caja</span><input type="number" min="0" step="0.01" inputMode="decimal" value={balances.cash === '' ? (cashDropsTotal || '') : cashInBox} onChange={changeCash} placeholder="$ 0" /></label>
      <label><span>Mercado Pago</span><input type="number" min="0" step="0.01" inputMode="decimal" value={balances.mercadoPago} onChange={(event) => onChange({ ...balances, mercadoPago: event.target.value })} placeholder="$ 0" /></label>
      <label><span>Total Posnet</span><input type="number" min="0" step="0.01" inputMode="decimal" value={balances.posnet} onChange={(event) => onChange({ ...balances, posnet: event.target.value })} placeholder="$ 0" /></label>
    </div><div className="shift-change-inputs"><div><small>CAMBIO ENTRE TURNOS</small><p>Importes en efectivo que entran y quedan preparados en caja.</p></div><div className="shift-change-fields"><label><span>Recibido del turno anterior</span><input type="number" min="0" step="0.01" inputMode="decimal" value={balances.receivedChange} onChange={(event) => { onReceivedChange?.(); onChange({ ...balances, receivedChange: event.target.value }) }} placeholder="$ 0" /></label><label><span>Para el próximo turno</span><input type="number" min="0" step="0.01" inputMode="decimal" value={balances.change} onChange={(event) => onChange({ ...balances, change: event.target.value })} placeholder="$ 0" /></label></div></div></div><aside className="ending-total-preview"><span>RESULTADO DEL ARQUEO</span><div className="ending-total-breakdown"><small>+ Efectivo en caja <b>{money.format(cashInBox)}</b></small><small>+ Mercado Pago <b>{money.format(Number(balances.mercadoPago || 0))}</b></small><small>+ Posnet <b>{money.format(Number(balances.posnet || 0))}</b></small>{nextShiftChange > 0 && <small>+ Cambio próximo <b>{money.format(nextShiftChange)}</b></small>}{receivedChange > 0 && <small>− Cambio recibido <b>{money.format(receivedChange)}</b></small>}</div><strong>{money.format(totalCash)}</strong></aside></div>
  </section>
}
