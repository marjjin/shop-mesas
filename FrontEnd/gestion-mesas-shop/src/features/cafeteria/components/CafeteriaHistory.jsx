import useCafeteriaHistory from '../hooks/useCafeteriaHistory.js'
import { SkeletonRows } from '../../../shared/components/LoadingSkeleton.jsx'
import { preciseMoney as money } from '../../../shared/utils/currency.js'
import { dateInputValue, moveHistoryDate } from '../domain/cafeteriaView.js'
import CafeteriaIcon from './CafeteriaIcon.jsx'

const shiftNames = { morning: 'Mañana', afternoon: 'Tarde' }

export default function CafeteriaHistory({ api, businessDate, refreshKey }) {
  const { historyDate, setHistoryDate, retryHistory, loadingHistory, shiftHistory, historyError } = useCafeteriaHistory(api, businessDate, refreshKey)
  const totalSales = shiftHistory.reduce((total, item) => total + item.totalSales, 0)
  const saleCount = shiftHistory.reduce((total, item) => total + item.saleCount, 0)
  const dateLabel = new Date(`${historyDate}T12:00:00`).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })
  const today = businessDate || dateInputValue()

  return <section className="cafeteria-card cafeteria-history" aria-labelledby="cafeteria-history-title">
    <div className="cafeteria-section-heading"><span className="cafeteria-heading-icon"><CafeteriaIcon name="clock" /></span><div><h2 id="cafeteria-history-title">Historial de cajas</h2><p>Ventas registradas por fecha y turno.</p></div></div>
    <div className="cafeteria-history-controls"><label htmlFor="cafeteria-history-date">Fecha de consulta<input id="cafeteria-history-date" required type="date" value={historyDate} onChange={(event) => setHistoryDate(event.target.value)} /></label><div className="cafeteria-date-navigation"><button type="button" className="cafeteria-icon-button" aria-label="Consultar el día anterior" title="Día anterior" onClick={() => setHistoryDate(moveHistoryDate(historyDate, -1))}><CafeteriaIcon name="left" /></button><button type="button" className="cafeteria-secondary" disabled={historyDate === today} onClick={() => setHistoryDate(today)}>Hoy</button><button type="button" className="cafeteria-icon-button" aria-label="Consultar el día siguiente" title="Día siguiente" onClick={() => setHistoryDate(moveHistoryDate(historyDate, 1))}><CafeteriaIcon name="right" /></button></div></div>
    <div aria-busy={loadingHistory}>
      {loadingHistory ? <SkeletonRows count={2} label="Cargando ventas del día" /> : historyError ? <div className="cafeteria-empty compact" role="alert"><CafeteriaIcon name="info" /><h3>No pudimos consultar esta fecha</h3><p>{historyError}</p><button type="button" className="cafeteria-secondary" onClick={retryHistory}>Reintentar</button></div> : shiftHistory.length ? <>
        <p className="cafeteria-history-caption">{dateLabel}</p><div className="cafeteria-table-wrap"><table className="cafeteria-history-table"><caption>Ventas de cafetería del {dateLabel}</caption><thead><tr><th scope="col">Turno</th><th scope="col">Ventas</th><th scope="col">Total vendido</th></tr></thead><tbody>{shiftHistory.map((item) => <tr key={`${item.businessDate}-${item.shift}`}><th scope="row"><span className={`cafeteria-history-shift ${item.shift}`}><i />{shiftNames[item.shift] || item.shift}</span></th><td>{item.saleCount}</td><td>{money.format(item.totalSales)}</td></tr>)}</tbody><tfoot><tr><th scope="row">Total del día</th><td>{saleCount}</td><td>{money.format(totalSales)}</td></tr></tfoot></table></div>
      </> : <div className="cafeteria-empty"><CafeteriaIcon name="calendar" /><h3>Sin ventas para esta fecha</h3><p>No se registraron ventas de cafetería el {dateLabel}.</p>{historyDate !== today && <button type="button" className="cafeteria-secondary" onClick={() => setHistoryDate(today)}>Consultar hoy</button>}</div>}
    </div>
  </section>
}
