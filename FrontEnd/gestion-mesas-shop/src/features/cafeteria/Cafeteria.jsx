import LoadingSkeleton from '../../shared/components/LoadingSkeleton.jsx'
import useCafeteria from './hooks/useCafeteria.js'
import CafeteriaHistory from './components/CafeteriaHistory.jsx'
import CafeteriaProducts from './components/CafeteriaProducts.jsx'
import { money } from '../../shared/utils/currency.js'
import './Cafeteria.css'

export default function Cafeteria({ api, onSummaryChange }) {
  const cafeteria = useCafeteria({ api, onSummaryChange })
  const { dashboard, businessDateLabel, monthLabel, message } = cafeteria

  if (cafeteria.loading) return <LoadingSkeleton section="cafeteria" />

  return <div className="cafeteria-page">
    <header className="cafeteria-header"><div><p className="eyebrow">VENTAS RÁPIDAS</p><h1>Caja Cafetería</h1><p>Configurá los artículos de cada venta. Cada clic en <b>VENTA CAFÉ</b> registra una unidad de todos los artículos activos.</p></div></header>
    <section className="cafeteria-total"><div><small>VENTAS · TURNO {dashboard.activeShift === 'afternoon' ? 'TARDE' : 'MAÑANA'}</small><b>{dashboard.summary.saleCount}</b><span>{dashboard.summary.items.reduce((total, item) => total + item.quantity, 0)} artículos cobrados desde el último cierre</span></div><div><small>TOTAL CAJA CAFETERÍA</small><strong>{money.format(dashboard.summary.totalSales)}</strong><span>Se imprime junto al cierre de cigarrillos.</span></div></section>
    <section className="cafeteria-period-summary" aria-label="Resumen de cajas de cafetería">
      <header><div><small>CAJAS DE CAFETERÍA</small><h2>Seguimiento de ventas</h2><p>Consultá lo vendido en el día y el acumulado del mes.</p></div><span>Actualizado automáticamente</span></header>
      <div><article className="cafeteria-day-summary"><small>VENDIDO HOY</small><strong>{money.format(dashboard.daySummary?.totalSales || 0)}</strong><span>{dashboard.daySummary?.saleCount || 0} {(dashboard.daySummary?.saleCount || 0) === 1 ? 'venta registrada' : 'ventas registradas'} · {businessDateLabel}</span></article><article className="cafeteria-month-summary"><small>VENDIDO EN EL MES</small><strong>{money.format(dashboard.monthSummary?.totalSales || 0)}</strong><span>{dashboard.monthSummary?.saleCount || 0} {(dashboard.monthSummary?.saleCount || 0) === 1 ? 'venta registrada' : 'ventas registradas'} · {monthLabel}</span></article></div>
    </section>
    <CafeteriaHistory api={api} />
    {message && <p className={message.includes('correctamente') || message.includes('quitado') ? 'cafeteria-message success' : 'cafeteria-message'}>{message}</p>}
    <CafeteriaProducts cafeteria={cafeteria} />
    <section className="cafeteria-card cafeteria-breakdown"><div className="section-heading"><div><small>DETALLE DEL TURNO</small><h2>Resumen para el ticket</h2></div><b>{money.format(dashboard.summary.totalSales)}</b></div>{dashboard.summary.items.length ? <div>{dashboard.summary.items.map((item) => <article key={`${item.productName}-${item.unitPrice}`}><span><b>{item.productName}</b><small>{item.quantity} × {money.format(item.unitPrice)}</small></span><strong>{money.format(item.totalSales)}</strong></article>)}</div> : <div className="cafeteria-empty">Las ventas aparecerán aquí al usar el botón VENTA CAFÉ del plano.</div>}</section>
  </div>
}
