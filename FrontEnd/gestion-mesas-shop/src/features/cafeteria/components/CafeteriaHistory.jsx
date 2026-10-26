import useCafeteriaHistory from '../hooks/useCafeteriaHistory.js'
import { money } from '../../../shared/utils/currency.js'

const shiftNames = { morning: 'Mañana', afternoon: 'Tarde' }

export default function CafeteriaHistory({ api }) {
  const { historyDate, setHistoryDate, loadingHistory, shiftHistory, historyError } = useCafeteriaHistory(api)

  return <section className="cafeteria-card cafeteria-history">
    <div className="section-heading"><div><small>HISTORIAL POR DÍA</small><h2>Historial de cajas</h2></div><label className="cafeteria-history-date"><span>FECHA</span><input type="date" value={historyDate} onChange={(event) => setHistoryDate(event.target.value)} /></label></div>
    <p className="cafeteria-help">Elegí una fecha para ver el total vendido en cada turno de Cafetería.</p>
    {loadingHistory ? <div className="cafeteria-empty">Cargando ventas del día…</div> : historyError ? <p className="cafeteria-message">{historyError}</p> : shiftHistory.length ? <div className="cafeteria-history-list">{shiftHistory.map((item) => <article key={`${item.businessDate}-${item.shift}`}><span><b>{new Date(`${item.businessDate}T12:00:00`).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })}</b><small>{item.saleCount} {item.saleCount === 1 ? 'venta rápida' : 'ventas rápidas'}</small></span><em className={item.shift}>{shiftNames[item.shift] || item.shift}</em><strong>{money.format(item.totalSales)}</strong></article>)}</div> : <div className="cafeteria-empty">No hay ventas de Cafetería registradas para esta fecha.</div>}
  </section>
}
