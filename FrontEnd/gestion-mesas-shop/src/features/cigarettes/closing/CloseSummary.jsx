import { money } from '../../../shared/utils/currency.js'

export function CafeteriaCloseSummary({ summary, error }) {
  return <section className="cafeteria-close-card" aria-label="Caja Cafetería">
    <div className="cafeteria-close-heading"><h2>Caja Cafetería</h2></div>
    {error ? <p className="cafeteria-close-error">{error}</p> : <div className="cafeteria-close-amount"><span>{summary?.saleCount || 0} {(summary?.saleCount || 0) === 1 ? 'venta' : 'ventas'}</span><strong>{money.format(summary?.totalSales || 0)}</strong></div>}
  </section>
}

export function CashDropsSummary({ cashDrops = [] }) {
  const total = cashDrops.reduce((sum, drop) => sum + drop.amount, 0)
  return <section className="cash-drops-close-card"><header><div><small>TIRADAS DE EFECTIVO</small><h3>Retirado físicamente durante el turno</h3></div><strong>{money.format(total)}</strong></header>{cashDrops.length ? <div className="cash-drops-close-list">{cashDrops.map((drop) => <div key={drop.id}><span>{new Date(drop.createdAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</span><b>{money.format(drop.amount)}</b></div>)}</div> : <p>No hay tiradas registradas para este turno.</p>}<small className="cash-drops-close-help">Detalle de las tiradas registradas.</small></section>
}
