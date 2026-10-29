import LoadingSkeleton from '../../shared/components/LoadingSkeleton.jsx'
import useCashDrops from './hooks/useCashDrops.js'
import CashDropForm from './components/CashDropForm.jsx'
import CashDropHistory from './components/CashDropHistory.jsx'
import CashDropIcon from './components/CashDropIcon.jsx'
import { shifts } from './cashDropPresentation.js'
import { money } from '../../shared/utils/currency.js'
import './CashDrops.css'

export default function CashDrops({ api }) {
  const cashDrops = useCashDrops(api)
  const { date, setDate, message, totalForDate, openShift, activeTotal } = cashDrops

  if (cashDrops.loading) return <LoadingSkeleton section="cash-drops" />

  return <div className="cash-drops-page">
    <header className="cash-drops-header">
      <div>
        <p className="eyebrow">CONTROL DE EFECTIVO</p>
        <h1>Tiradas</h1>
        <p>Registrá el efectivo retirado físicamente de la caja durante cada turno.</p>
      </div>
      <label className="date-picker"><span>Fecha de trabajo</span><input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
    </header>

    {message && <p className={message.includes('correctamente') ? 'cash-drops-message success' : 'cash-drops-message'} role="status"><CashDropIcon name="info" /><span>{message}</span></p>}

    <section className="cash-drops-overview" aria-label="Resumen de tiradas">
      <div><div className="cash-drops-metric-label"><span className="cash-drops-metric-icon"><CashDropIcon name="cash" /></span><small>Tiradas del día</small></div><strong>{money.format(totalForDate)}</strong><span>Suma de mañana y tarde</span></div>
      <div className="cash-drops-overview-active"><div className="cash-drops-metric-label"><span className="cash-drops-metric-icon accent"><CashDropIcon name="clock" /></span><small>Turno activo</small></div><strong>{openShift ? shifts[openShift.shift] : 'Sin turno'}</strong><span>{openShift ? `${money.format(activeTotal)} registrados para el arqueo` : 'No se pueden registrar nuevas tiradas'}</span></div>
      <div className="cash-drops-overview-state"><div className="cash-drops-metric-label"><span className={`cash-drops-metric-icon ${openShift ? 'green' : ''}`}><CashDropIcon name={openShift ? 'check' : 'lock'} /></span><small>Estado</small></div><strong>{openShift ? 'Listo para registrar' : 'Día cerrado'}</strong><span>{openShift ? 'Podés registrar, imprimir, editar o eliminar' : 'Solo consulta histórica'}</span></div>
    </section>

    <div className="cash-drops-grid">
      <CashDropForm cashDrops={cashDrops} />

      <CashDropHistory cashDrops={cashDrops} />
    </div>
  </div>
}
