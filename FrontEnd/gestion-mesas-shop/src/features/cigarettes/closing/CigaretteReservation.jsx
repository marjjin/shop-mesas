import { preciseMoney as money } from '../../../shared/utils/currency.js'
import ClosingIcon from './ClosingIcon.jsx'
import './CigaretteReservation.css'

export default function CigaretteReservation({ totalSales, reservation, onChange, readOnly = false, legacy = false }) {
  const cash = Number(reservation?.cash || 0)
  const mercadoPago = Number(reservation?.mercadoPago || 0)
  const total = Math.round((cash + mercadoPago) * 100) / 100
  const missing = readOnly && (reservation?.cash == null || reservation?.mercadoPago == null)
  return <section className="cigarette-reservation" aria-label="Venta y reserva de cigarrillos">
    <header><span className="closing-block-icon"><ClosingIcon name="box" /></span><div><small>CAJA DE CIGARRILLOS</small><h3>Venta y fondos reservados</h3></div><div className="cigarette-reservation-sales"><span>Total vendido en el turno</span><strong>{money.format(totalSales)}</strong></div></header>
    {readOnly ? <dl className="cigarette-reservation-fields"><div><dt>Efectivo reservado</dt><dd>{reservation?.cash == null ? 'Sin registrar' : money.format(cash)}</dd></div><div><dt>Mercado Pago reservado</dt><dd>{reservation?.mercadoPago == null ? 'Sin registrar' : money.format(mercadoPago)}</dd></div></dl> : <div className="cigarette-reservation-fields">
      <label><span>Efectivo reservado ($)</span><input type="number" min="0" max="9999999999.99" step="0.01" inputMode="decimal" placeholder="0,00" value={reservation.cash} onChange={(event) => onChange({ ...reservation, cash: event.target.value })} /></label>
      <label><span>Mercado Pago reservado ($)</span><input type="number" min="0" max="9999999999.99" step="0.01" inputMode="decimal" placeholder="0,00" value={reservation.mercadoPago} onChange={(event) => onChange({ ...reservation, mercadoPago: event.target.value })} /></label>
    </div>}
    <footer><p>{missing ? 'Este cierre no tiene la reserva completa. Podés registrarla al corregirlo.' : readOnly ? 'Reserva incluida en la Caja de cigarrillos.' : 'Al confirmar el cierre, estos importes ingresan a la Caja de cigarrillos. Las compras se descuentan en esa caja.'}</p><span><small>Total reservado</small><b>{missing ? 'Incompleto' : money.format(total)}</b></span></footer>
    {!readOnly && total > totalSales && <p role="status" className="cigarette-reservation-warning">La reserva supera la venta calculada. Revisá los importes antes de confirmar.</p>}
    {!readOnly && legacy && <p className="cigarette-reservation-hint">Este cierre es anterior al registro de reservas. Completá ambos importes; ingresá 0 si no hubo reserva. Los campos vacíos conservan el dato anterior.</p>}
  </section>
}
