import CigaretteReservation from './CigaretteReservation.jsx'
import ClosingIcon from './ClosingIcon.jsx'
import { getDraftFinancialSummary } from '../domain/closeFinancials.js'
import { useMemo, useState } from 'react'
import useCloseDraft from '../hooks/useCloseDraft.js'
import { shifts } from '../domain/businessDate.js'
import { money } from '../../../shared/utils/currency.js'
import EndingBalances from './EndingBalances.jsx'
import SupplierAllocations from './SupplierAllocations.jsx'
import { CafeteriaCloseSummary, CashDropsSummary } from './CloseSummary.jsx'
import StockWarning from './StockWarning.jsx'

export default function ShiftCloseForm({ products, purchases, suppliers, allocations, onAllocationsChange, cafeteriaSummary, cafeteriaError, cashDrops, shift, date, previousChangeCash, onClose }) {
  const [validationMessage, setValidationMessage] = useState('')
  const [showStockWarning, setShowStockWarning] = useState(false)
  const purchasedByProduct = useMemo(() => purchases
    .filter((purchase) => purchase.shift === shift)
    .reduce((totals, purchase) => ({ ...totals, [purchase.cigaretteProductId]: (totals[purchase.cigaretteProductId] || 0) + purchase.quantity }), {}), [purchases, shift])
  const { cigaretteReservation, changeCigaretteReservation, finalStocks, hasDraft, endingBalances, setReceivedChangeEdited, changeFinalStock, changeEndingBalances, changeAllocations, discardDraft } = useCloseDraft({ products, date, shift, previousChangeCash, onAllocationsChange })
  const rows = products.map((product) => {
    const purchased = purchasedByProduct[product.id] || 0
    const initial = product.stock - purchased
    const invalidInitial = initial < 0
    const final = Number(finalStocks[product.id] ?? product.stock)
    const sold = invalidInitial ? 0 : Math.max(0, initial + purchased - final)
    return { ...product, purchased, initial, invalidInitial, final, sold, amount: sold * product.price }
  })
  const totalSales = rows.reduce((total, row) => total + row.amount, 0)
  const { archaeologicalResult, cashTotal, separateCashBoxTotal, dailySalesTotal } = getDraftFinancialSummary({ endingBalances, cashDrops, suppliers, allocations, cafeteriaTotal: cafeteriaSummary?.totalSales || 0, totalSales })
  const isValid = rows.length > 0 && rows.every((row) => !row.invalidInitial && row.final >= 0 && row.final <= row.initial + row.purchased)
  const excessStockRows = rows.filter((row) => !row.invalidInitial && row.final > row.initial + row.purchased)

  const submit = (event) => {
    event.preventDefault()
    if (!isValid) return
    onClose({ cigaretteReservedCash: Number(cigaretteReservation.cash || 0), cigaretteReservedMercadoPago: Number(cigaretteReservation.mercadoPago || 0), businessDate: date, shift, items: rows.map((row) => ({ cigaretteProductId: row.id, finalStock: row.final })), supplierAllocations: suppliers.map((supplier) => ({ supplierId: supplier.id, cashAmount: Number(allocations[supplier.id]?.cashAmount || 0), mercadoPagoAmount: Number(allocations[supplier.id]?.mercadoPagoAmount || 0) })).filter((allocation) => allocation.cashAmount + allocation.mercadoPagoAmount > 0), endingCashBalance: Number(endingBalances.cash || 0), endingMercadoPagoBalance: Number(endingBalances.mercadoPago || 0), posnetTotal: Number(endingBalances.posnet || 0), receivedChangeCash: Number(endingBalances.receivedChange || 0), nextShiftChangeCash: Number(endingBalances.change || 0) })
  }

  return <form className="shift-close" onSubmit={submit} onInvalid={(event) => {
    if (excessStockRows.length) {
      event.preventDefault()
      setShowStockWarning(true)
    } else setValidationMessage(`Revisá ${event.target.getAttribute('aria-label') || event.target.closest('label')?.textContent || 'los importes del cierre'}: ${event.target.validationMessage}`)
  }} onBlur={(event) => {
    if (event.target.getAttribute('aria-invalid') === 'true' && excessStockRows.length) setShowStockWarning(true)
  }} onChange={() => setValidationMessage('')}>
    {showStockWarning && excessStockRows.length > 0 && <StockWarning rows={excessStockRows} onClose={() => setShowStockWarning(false)} />}
    {validationMessage && <p role="alert" className="close-validation-error">{validationMessage}</p>}
    <div className="close-draft-notice"><span><ClosingIcon name="check" /></span><p>{hasDraft ? 'Borrador guardado automáticamente en este dispositivo.' : 'Los cambios se guardarán automáticamente mientras cargás el cierre.'}</p>{hasDraft && <button type="button" onClick={discardDraft}>Descartar borrador</button>}</div>
    <EndingBalances balances={endingBalances} cashDrops={cashDrops} onChange={changeEndingBalances} onReceivedChange={() => setReceivedChangeEdited(true)} />
    <CashDropsSummary cashDrops={cashDrops} />
    <SupplierAllocations suppliers={suppliers} allocations={allocations} onAllocationsChange={changeAllocations} />
    <CafeteriaCloseSummary summary={cafeteriaSummary} error={cafeteriaError} />
    {rows.some((row) => row.invalidInitial) && <p className="close-validation-error">Hay un stock actual menor a las compras del turno. Corregí el stock del producto antes de cerrar.</p>}
    <section className="closing-stock-section"><div className="closing-stock-heading"><span className="closing-block-icon"><ClosingIcon name="box" /></span><div><small>INVENTARIO DE CIGARRILLOS</small><h3>Stock al cierre</h3><p>Ingresá las unidades contadas al finalizar el turno.</p></div></div><div className="close-grid-header"><span>Producto</span><span>Inicial</span><span>Compras</span><span>Final</span><span>Vendidos</span><span>Importe</span></div>
    {rows.map((row) => <div className={`close-grid-row ${row.stock <= 0 ? 'stock-empty' : ''}`} key={row.id}>
      <span className="close-product"><b>{row.name}</b><small>{money.format(row.price)} c/u{row.stock <= 0 ? ' · SIN STOCK' : ''}</small></span>
      <span className={`close-metric ${row.invalidInitial ? 'invalid-initial' : ''}`}><small>Inicial</small><strong>{row.invalidInitial ? 'Corregir' : row.initial}</strong></span>
      <span className="close-metric"><small>Compras</small><strong className={row.purchased ? 'purchase-pill' : ''}>+{row.purchased}</strong></span>
      <label className="close-metric final-stock"><small translate="no">Stock final</small><input type="number" inputMode="numeric" min="0" max={row.initial + row.purchased} required disabled={row.stock <= 0} title={row.stock <= 0 ? 'Sin stock disponible' : undefined} value={finalStocks[row.id] ?? ''} aria-label={`Stock final de ${row.name}`} aria-invalid={row.final > row.initial + row.purchased || undefined} aria-describedby={row.final > row.initial + row.purchased ? `stock-error-${row.id}` : undefined} onChange={(event) => changeFinalStock(row.id, event.target.value)} /></label>
      <span className="close-metric"><small>Vendidos</small><strong className="sold-value">{row.invalidInitial ? '—' : row.sold}</strong></span>
      <span className="close-metric amount-metric"><small>Importe</small><b>{row.invalidInitial ? '—' : money.format(row.amount)}</b></span>
    </div>)}
    {excessStockRows.length > 0 && <div role="alert" className="close-validation-error"><strong>No se puede cerrar el turno: hay stock final mayor al disponible.</strong>{excessStockRows.map((row) => <p key={row.id} id={`stock-error-${row.id}`}>{row.name}: ingresaste {row.final} de stock final, pero el máximo es {row.initial + row.purchased} (stock inicial {row.initial} + compras {row.purchased}). Corregí el stock final o registrá las compras faltantes antes de cerrar.</p>)}</div>}
    {excessStockRows.length > 0 && <button type="button" className="edit-close-button" onClick={() => setShowStockWarning(true)}>Ver aviso de stock</button>}
    {!products.length && <div className="cigarette-empty">Primero cargá al menos un cigarrillo.</div>}
    </section>
    <CigaretteReservation totalSales={totalSales} reservation={cigaretteReservation} onChange={changeCigaretteReservation} />
    <div className="close-total"><span className="cash-total-summary"><small>CAJA</small><b>{money.format(cashTotal)}</b><i>Arqueo − proveedores sin caja aparte − cafetería − cigarrillos</i></span><span className="daily-sales-summary"><small>VENTAS DEL DÍA</small><b>{money.format(dailySalesTotal)}</b><i>Arqueo {money.format(archaeologicalResult)}{separateCashBoxTotal > 0 ? ` + cajas aparte ${money.format(separateCashBoxTotal)}` : ''}</i></span><button className="primary" disabled={!isValid}><ClosingIcon name="check" />Cerrar turno {shifts[shift].toLowerCase()}</button></div>
  </form>
}
