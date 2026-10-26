import { money } from '../../../shared/utils/currency.js'
import { shifts } from '../domain/businessDate.js'
import { getCloseFinancialSummary } from '../domain/closeFinancials.js'
import './ClosedShiftSummary.css'

export default function ClosedShiftSummary({ close, suppliers, onEdit }) {
  const { archaeologicalResult, shiftSales } = getCloseFinancialSummary(close, suppliers)
  const date = new Date(`${close.businessDate}T12:00:00`).toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })
  return <section className="closed-shift-summary" aria-label="Resumen de caja del turno cerrado">
    <header className="closed-shift-status">
      <span className="closed-shift-check" aria-hidden="true">✓</span>
      <div><span className="closed-shift-eyebrow">CIERRE REGISTRADO</span><h3>Todo listo por este turno</h3><p>{date} <span aria-hidden="true">·</span> Turno {shifts[close.shift].toLowerCase()}</p></div>
      <span className="closed-shift-badge">Caja cerrada</span>
    </header>
    <dl className="closed-shift-metrics">
      <div className="closed-shift-main"><dt>Arqueo de caja</dt><dd>{money.format(archaeologicalResult)}</dd><span>Resultado del arqueo registrado</span></div>
      <div><dt>Ventas del turno</dt><dd>{money.format(shiftSales)}</dd><span>Total de ventas del cierre</span></div>
      <div><dt>Cambio preparado</dt><dd>{money.format(close.nextShiftChangeCash || 0)}</dd><span>Para el próximo turno</span></div>
    </dl>
    <footer className="closed-shift-footer"><p>¿Necesitás ajustar algún dato?<span>Podés revisar y corregir este cierre.</span></p><button type="button" onClick={() => onEdit(close)}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="m15 5 4 4M4 20l4-1L20 7a2.8 2.8 0 0 0-4-4L4 15z" /></svg>Corregir cierre</button></footer>
  </section>
}
