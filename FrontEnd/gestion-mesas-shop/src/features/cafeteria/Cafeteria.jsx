import { useState } from 'react'
import LoadingSkeleton from '../../shared/components/LoadingSkeleton.jsx'
import useCafeteria from './hooks/useCafeteria.js'
import CafeteriaHistory from './components/CafeteriaHistory.jsx'
import CafeteriaProducts from './components/CafeteriaProducts.jsx'
import CafeteriaIcon from './components/CafeteriaIcon.jsx'
import { preciseMoney as money } from '../../shared/utils/currency.js'
import './Cafeteria.css'

export default function Cafeteria({ api, onSummaryChange }) {
  const cafeteria = useCafeteria({ api, onSummaryChange })
  const [view, setView] = useState('products')
  const { dashboard, businessDateLabel, monthLabel, message, refreshing, loadError, load, busy } = cafeteria

  if (cafeteria.loading) return <LoadingSkeleton section="cafeteria" />
  if (!dashboard) return <div className="cafeteria-page"><header><div><p className="eyebrow">VENTAS RÁPIDAS</p><h1>Caja Cafetería</h1></div></header><div className="cafeteria-empty cafeteria-load-error" role="alert"><CafeteriaIcon name="info" /><h2>No pudimos cargar la caja</h2><p>{loadError}</p><button className="cafeteria-secondary" onClick={load} disabled={refreshing}><CafeteriaIcon name="refresh" />{refreshing ? 'Cargando…' : 'Volver a intentar'}</button></div></div>

  const shiftLabel = dashboard.activeShift === 'afternoon' ? 'Tarde' : dashboard.activeShift === 'morning' ? 'Mañana' : 'Sin turno activo'
  const units = dashboard.summary.items.reduce((total, item) => total + item.quantity, 0)

  return <div className="cafeteria-page">
    <header className="cafeteria-header"><div><p className="eyebrow">VENTAS RÁPIDAS</p><h1>Caja Cafetería</h1><p>Configurá los artículos de cada venta y consultá los importes registrados.</p></div><button type="button" className="cafeteria-secondary cafeteria-refresh" disabled={refreshing || busy} onClick={load}><CafeteriaIcon name="refresh" />{refreshing ? 'Actualizando…' : 'Actualizar'}</button></header>
    <div className="cafeteria-context"><span><CafeteriaIcon name="calendar" />{businessDateLabel}</span><span className="cafeteria-shift-badge"><i />{dashboard.activeShift ? `Turno ${shiftLabel.toLowerCase()}` : shiftLabel}</span></div>
    {loadError && <div className="cafeteria-feedback error" role="alert"><CafeteriaIcon name="info" /><span>{loadError} Los valores visibles corresponden a la última consulta.</span><button type="button" disabled={refreshing || busy} onClick={load}>Reintentar</button></div>}

    <section className="cafeteria-overview" aria-label="Resumen de ventas" aria-busy={refreshing}>
      <article className="cafeteria-stat current"><div className="cafeteria-stat-label"><span className="cafeteria-stat-icon"><CafeteriaIcon name="coffee" /></span><span>Caja del turno</span><small>{shiftLabel}</small></div><strong>{money.format(dashboard.summary.totalSales)}</strong><div className="cafeteria-stat-meta"><span><b>{dashboard.summary.saleCount}</b> {dashboard.summary.saleCount === 1 ? 'venta' : 'ventas'}</span><span><b>{units}</b> {units === 1 ? 'artículo cobrado' : 'artículos cobrados'}</span></div><p>Acumulado desde el último cierre.</p></article>
      <article className="cafeteria-stat"><div className="cafeteria-stat-label"><span className="cafeteria-stat-icon neutral"><CafeteriaIcon name="calendar" /></span><span>Vendido hoy</span></div><strong>{money.format(dashboard.daySummary?.totalSales || 0)}</strong><div className="cafeteria-stat-meta"><span><b>{dashboard.daySummary?.saleCount || 0}</b> ventas registradas</span></div><p>{businessDateLabel}</p></article>
      <article className="cafeteria-stat"><div className="cafeteria-stat-label"><span className="cafeteria-stat-icon neutral"><CafeteriaIcon name="receipt" /></span><span>Vendido en el mes</span></div><strong>{money.format(dashboard.monthSummary?.totalSales || 0)}</strong><div className="cafeteria-stat-meta"><span><b>{dashboard.monthSummary?.saleCount || 0}</b> ventas registradas</span></div><p>{monthLabel}</p></article>
    </section>

    <div className="cafeteria-view-switch" role="group" aria-label="Vista de Caja Cafetería"><button type="button" aria-pressed={view === 'products'} aria-controls="cafeteria-products-panel" onClick={() => setView('products')}><CafeteriaIcon name="box" />Artículos por venta<span>{dashboard.products.length}</span></button><button type="button" aria-pressed={view === 'history'} aria-controls="cafeteria-history-panel" onClick={() => setView('history')}><CafeteriaIcon name="clock" />Historial y detalle</button></div>
    {message && <div className={`cafeteria-feedback ${message.type}`} role={message.type === 'error' ? 'alert' : 'status'}><CafeteriaIcon name={message.type === 'success' ? 'check' : 'info'} /><span>{message.text}</span><button type="button" onClick={cafeteria.dismissMessage} aria-label="Cerrar mensaje"><CafeteriaIcon name="close" /></button></div>}
    <div id="cafeteria-products-panel" hidden={view !== 'products'}><CafeteriaProducts cafeteria={cafeteria} /></div>
    <div id="cafeteria-history-panel" hidden={view !== 'history'}>
      <div className="cafeteria-history-layout"><CafeteriaHistory api={api} businessDate={dashboard.businessDate} refreshKey={dashboard} />
        <section className="cafeteria-card cafeteria-breakdown" aria-labelledby="cafeteria-breakdown-title"><div className="cafeteria-section-heading"><span className="cafeteria-heading-icon"><CafeteriaIcon name="receipt" /></span><div><h2 id="cafeteria-breakdown-title">Detalle del turno</h2><p>Artículos incluidos en el cierre.</p></div></div>
          {dashboard.summary.items.length ? <><ul className="cafeteria-breakdown-list">{dashboard.summary.items.map((item) => <li key={`${item.productName}-${item.unitPrice}`}><span><b>{item.productName}</b><small>{item.quantity} × {money.format(item.unitPrice)}</small></span><strong>{money.format(item.totalSales)}</strong></li>)}</ul><div className="cafeteria-breakdown-total"><span>Total del turno</span><strong>{money.format(dashboard.summary.totalSales)}</strong></div></> : <div className="cafeteria-empty compact"><CafeteriaIcon name="receipt" /><h3>Sin ventas en este turno</h3><p>El detalle aparecerá al registrar ventas desde el plano.</p></div>}
          <p className="cafeteria-footnote"><CafeteriaIcon name="info" />Se imprime junto al cierre de cigarrillos.</p>
        </section>
      </div>
    </div>
  </div>
}
