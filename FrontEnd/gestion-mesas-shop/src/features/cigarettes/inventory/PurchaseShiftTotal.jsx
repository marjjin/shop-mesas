// Total pagado por todas las compras del turno. Se carga una sola vez y no cambia el stock.
import { useState } from 'react'
import PurchaseCostFields from './PurchaseCostFields.jsx'
import InventoryIcon from './InventoryIcon.jsx'
import { preciseMoney as money } from '../../../shared/utils/currency.js'

export default function PurchaseShiftTotal({ purchases, payment, busy, onSave }) {
  const [draft, setDraft] = useState({ totalCost: payment?.totalCost ?? '', paymentMethod: payment?.paymentMethod ?? 'cash' })
  // Las compras anteriores pueden tener importe propio: también cuentan como gasto.
  const earlierCosts = purchases.reduce((total, item) => total + (item.totalCost || 0), 0)
  const pending = !payment && purchases.some((item) => item.totalCost == null)
  const changed = String(draft.totalCost) !== String(payment?.totalCost ?? '') || draft.paymentMethod !== (payment?.paymentMethod ?? 'cash')
  const valid = draft.totalCost === '' ? Boolean(payment) : Number(draft.totalCost) >= 0
  const submit = (event) => {
    event.preventDefault()
    onSave(draft)
  }

  return <>
    <div className="inv-purchase-total"><span>Total gastado en el turno{pending && <small>Falta cargar el total de las compras</small>}{earlierCosts > 0 && payment && <small>Incluye {money.format(earlierCosts)} de importes por compra</small>}</span><b>{money.format(earlierCosts + (payment?.totalCost ?? 0))}</b></div>
    {purchases.length > 0 && <form className="inv-purchase-payment" onSubmit={submit} aria-label="Total de las compras del turno" aria-busy={busy}>
      <PurchaseCostFields value={draft} onChange={setDraft} disabled={busy} />
      <button className="inv-primary" disabled={busy || !changed || !valid}><InventoryIcon name="check" />{busy ? 'Guardando…' : 'Guardar total'}</button>
    </form>}
  </>
}
