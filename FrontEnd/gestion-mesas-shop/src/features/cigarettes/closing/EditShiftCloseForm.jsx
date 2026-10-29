import ClosingIcon from './ClosingIcon.jsx'
import { getDraftFinancialSummary } from '../domain/closeFinancials.js'
import { useState } from 'react'
import { money } from '../../../shared/utils/currency.js'
import EndingBalances from './EndingBalances.jsx'
import SupplierAllocations from './SupplierAllocations.jsx'
import { CafeteriaCloseSummary, CashDropsSummary } from './CloseSummary.jsx'

export default function EditShiftCloseForm({ close, suppliers, cafeteria, cashDrops, onSave, onCancel, busy }) {
  const [cafeteriaSaleCount, setCafeteriaSaleCount] = useState(cafeteria?.saleCount || 0)
  const [finalStocks, setFinalStocks] = useState(() => Object.fromEntries(close.items.map((item) => [item.cigaretteProductId, item.finalStock])))
  const [allocations, setAllocations] = useState(() => Object.fromEntries(close.supplierAllocations.map((allocation) => [allocation.supplierId, { cashAmount: allocation.cashAmount, mercadoPagoAmount: allocation.mercadoPagoAmount }])))
  const [endingBalances, setEndingBalances] = useState(() => ({ cash: close.endingCashBalance, mercadoPago: close.endingMercadoPagoBalance, posnet: close.posnetTotal, receivedChange: close.receivedChangeCash, change: close.nextShiftChangeCash }))
  const rows = close.items.map((item) => {
    const final = Number(finalStocks[item.cigaretteProductId] ?? item.finalStock)
    const available = item.initialStock + item.purchasedQuantity
    const sold = available - final
    return { ...item, final, available, sold, amount: sold * item.unitPrice }
  })
  const totalSales = rows.reduce((total, row) => total + row.amount, 0)
  const { archaeologicalResult, cashTotal, separateCashBoxTotal, dailySalesTotal } = getDraftFinancialSummary({ endingBalances, cashDrops, suppliers, allocations, cafeteriaTotal: cafeteria?.totalSales || 0, totalSales })
  const isValid = rows.every((row) => row.final >= 0 && row.final <= row.available)

  const submit = (event) => {
    event.preventDefault()
    onSave({
      items: rows.map((row) => ({ cigaretteProductId: row.cigaretteProductId, finalStock: row.final })),
      cafeteriaSaleCount: Number(cafeteriaSaleCount),
      supplierAllocations: suppliers.map((supplier) => ({ supplierId: supplier.id, cashAmount: Number(allocations[supplier.id]?.cashAmount || 0), mercadoPagoAmount: Number(allocations[supplier.id]?.mercadoPagoAmount || 0) })).filter((allocation) => allocation.cashAmount + allocation.mercadoPagoAmount > 0),
      endingCashBalance: Number(endingBalances.cash || 0),
      endingMercadoPagoBalance: Number(endingBalances.mercadoPago || 0),
      posnetTotal: Number(endingBalances.posnet || 0),
      receivedChangeCash: Number(endingBalances.receivedChange || 0),
      nextShiftChangeCash: Number(endingBalances.change || 0)
    })
  }

  return <form className="shift-close" onSubmit={submit}>
    <EndingBalances balances={endingBalances} cashDrops={cashDrops} onChange={setEndingBalances} />
    <CashDropsSummary cashDrops={cashDrops} />
    <SupplierAllocations suppliers={suppliers} allocations={allocations} onAllocationsChange={setAllocations} />
    <CafeteriaCloseSummary summary={cafeteria} />
    <label className="close-cafeteria-count"><span>Ventas de cafetería de este turno</span><input type="number" min="0" step="1" value={cafeteriaSaleCount} onChange={(event) => setCafeteriaSaleCount(event.target.value)} /><small>Al aumentar, se replica el detalle de una venta existente; al reducir, se quitan las últimas ventas.</small></label>
    <section className="closing-stock-section"><div className="closing-stock-heading"><span className="closing-block-icon"><ClosingIcon name="box" /></span><div><small>INVENTARIO DE CIGARRILLOS</small><h3>Stock al cierre</h3><p>Ingresá las unidades contadas al finalizar el turno.</p></div></div><div className="close-grid-header"><span>Producto</span><span>Inicial</span><span>Compras</span><span>Final</span><span>Vendidos</span><span>Importe</span></div>
    {rows.map((row) => <div className="close-grid-row" key={row.cigaretteProductId}>
      <span className="close-product"><b>{row.productName}</b><small>{money.format(row.unitPrice)} c/u</small></span>
      <span className="close-metric"><small>Inicial</small><strong>{row.initialStock}</strong></span>
      <span className="close-metric"><small>Compras</small><strong className={row.purchasedQuantity ? 'purchase-pill' : ''}>+{row.purchasedQuantity}</strong></span>
      <label className="close-metric final-stock"><small translate="no">Stock final</small><input type="number" inputMode="numeric" min="0" max={row.available} required value={finalStocks[row.cigaretteProductId] ?? ''} aria-label={`Stock final corregido de ${row.productName}`} onChange={(event) => setFinalStocks({ ...finalStocks, [row.cigaretteProductId]: event.target.value })} /></label>
      <span className="close-metric"><small>Vendidos</small><strong className="sold-value">{row.sold}</strong></span>
      <span className="close-metric amount-metric"><small>Importe</small><b>{money.format(row.amount)}</b></span>
    </div>)}
    </section>
    <div className="close-total"><span className="cash-total-summary"><small>CAJA</small><b>{money.format(cashTotal)}</b><i>Arqueo − proveedores sin caja aparte − cafetería − cigarrillos</i></span><span className="daily-sales-summary"><small>VENTAS DEL DÍA</small><b>{money.format(dailySalesTotal)}</b><i>Arqueo {money.format(archaeologicalResult)}{separateCashBoxTotal > 0 ? ` + cajas aparte ${money.format(separateCashBoxTotal)}` : ''}</i></span><button type="button" className="secondary" onClick={onCancel}>Cancelar</button><button className="primary" disabled={busy || !isValid}><ClosingIcon name="check" />Guardar corrección</button></div>
  </form>
}
