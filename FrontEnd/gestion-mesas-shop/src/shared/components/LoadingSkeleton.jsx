import './LoadingSkeleton.css'

const sections = {
  salon: ['OPERACIÓN EN VIVO', 'Salón principal'],
  pending: ['ANTES DE ELEGIR MESA', 'Pedidos'],
  catalog: ['ADMINISTRACIÓN', 'Artículos'],
  cafeteria: ['VENTAS RÁPIDAS', 'Caja Cafetería'],
  cigarettes: ['INVENTARIO', 'Cigarrillos'],
  'shift-close': ['ARQUEO Y CIERRE DE CAJA', 'Cierre de turno'],
  suppliers: ['CUENTAS CORRIENTES', 'Proveedores'],
  'cash-drops': ['CONTROL DE EFECTIVO', 'Tiradas'],
  history: ['REGISTRO DE CIERRES', 'Historial de mesas'],
  settings: ['SISTEMA', 'Configuraciones'],
}

export function SkeletonBlock({ className = '' }) {
  return <span className={`skeleton-block ${className}`} aria-hidden="true" />
}

function Rows({ count = 4 }) {
  return <div className="skeleton-rows">{Array.from({ length: count }, (_, index) => <div className="skeleton-row" key={index}>
    <div className="skeleton-row-copy"><SkeletonBlock className="skeleton-line" /><SkeletonBlock className="skeleton-line skeleton-short" /></div>
    <SkeletonBlock className="skeleton-value" />
  </div>)}</div>
}

export function SkeletonRows({ count = 4, label = 'Cargando datos' }) {
  return <div role="status" aria-busy="true" className="skeleton-loading">
    <span className="skeleton-status">{label}</span>
    <Rows count={count} />
  </div>
}

function Card({ children }) {
  return <div className="skeleton-card"><SkeletonBlock className="skeleton-line skeleton-short" />{children}</div>
}

export function SettingsSkeleton() {
  return <div className="skeleton-loading" role="status" aria-busy="true">
    <span className="skeleton-status">Cargando configuración del ticket</span>
    <div className="skeleton-columns skeleton-settings" aria-hidden="true">
      <Card><SkeletonBlock className="skeleton-control" /><SkeletonBlock className="skeleton-control skeleton-input" /><Rows count={3} /></Card>
      <div className="skeleton-preview"><div className="skeleton-paper"><SkeletonBlock className="skeleton-title" /><Rows count={3} /><SkeletonBlock className="skeleton-control" /></div></div>
    </div>
  </div>
}

export default function LoadingSkeleton({ section = 'salon' }) {
  const [eyebrow, title] = sections[section] || sections.salon
  const hasSummary = ['cafeteria', 'cigarettes', 'suppliers', 'cash-drops'].includes(section)
  return <div className={`skeleton-loading skeleton-page skeleton-page-${section}`} role="status" aria-busy="true">
    <span className="skeleton-status">Cargando {title.toLocaleLowerCase('es-AR')}</span>
    <div aria-hidden="true">
      <header className="skeleton-heading"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><SkeletonBlock className="skeleton-description" /></div><SkeletonBlock className="skeleton-button" /></header>
      {section === 'salon' ? <div className="skeleton-floor">{Array.from({ length: 8 }, (_, index) => <div className="skeleton-table" key={index}><SkeletonBlock className="skeleton-line" /><SkeletonBlock className="skeleton-line skeleton-short" /></div>)}</div> : <>
        {hasSummary && <div className="skeleton-summary">{Array.from({ length: 3 }, (_, index) => <Card key={index}><SkeletonBlock className="skeleton-number" /><SkeletonBlock className="skeleton-line" /></Card>)}</div>}
        <div className={`skeleton-content${['pending', 'suppliers', 'cash-drops', 'shift-close'].includes(section) ? ' skeleton-columns' : ''}`}>
          {section === 'suppliers' ? Array.from({ length: 4 }, (_, index) => <Card key={index}><SkeletonBlock className="skeleton-number" /><Rows count={2} /><SkeletonBlock className="skeleton-control" /></Card>) : <>
            {['pending', 'cash-drops', 'shift-close'].includes(section) && <Card><SkeletonBlock className="skeleton-control skeleton-input" /><SkeletonBlock className="skeleton-control skeleton-input" /><SkeletonBlock className="skeleton-control" /></Card>}
            <Card>{['catalog', 'cigarettes'].includes(section) && <SkeletonBlock className="skeleton-control skeleton-input" />}<Rows count={section === 'history' ? 5 : 4} /></Card>
          </>}
        </div>
      </>}
    </div>
  </div>
}

export function SessionSkeleton({ section = 'salon' }) {
  return <main className="layout skeleton-session" aria-busy="true">
    <aside className="sidebar skeleton-sidebar" aria-hidden="true"><SkeletonBlock className="skeleton-brand" /><div className="skeleton-nav">{Array.from({ length: 7 }, (_, index) => <SkeletonBlock className="skeleton-control" key={index} />)}</div><SkeletonBlock className="skeleton-control" /></aside>
    <section className="page"><LoadingSkeleton section={section} /></section>
  </main>
}
