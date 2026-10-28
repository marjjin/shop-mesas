import ThemeToggle from '../appearance/ThemeToggle.jsx'
import { sectionPaths } from './sectionNavigation.js'

function SectionLink({ target, section, onSectionChange, children }) {
  return <a href={sectionPaths[target]} className={section === target ? 'active' : ''} aria-current={section === target ? 'page' : undefined} onClick={(event) => {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    onSectionChange(target)
  }}>{children}</a>
}

export default function Sidebar({ user, section, pendingOrdersCount, onSectionChange, onSignOut, resolvedTheme, onThemeChange }) {
  return <aside className="sidebar">
    <div className="logo">☕ SHOP <span>FAMILY</span></div>
    <nav className="sidebar-nav" aria-label="Navegación principal">
      <div className="sidebar-nav-group">
        <p>Operación</p>
        <SectionLink target="salon" section={section} onSectionChange={onSectionChange}>▦ <span>Plano de mesas</span></SectionLink>
        <SectionLink target="pending" section={section} onSectionChange={onSectionChange}>⌛ <span>Pedidos{pendingOrdersCount ? ` (${pendingOrdersCount})` : ''}</span></SectionLink>
      </div>
      <div className="sidebar-nav-group">
        <p>Cajas y stock</p>
        <SectionLink target="catalog" section={section} onSectionChange={onSectionChange}>☷ <span>Artículos</span></SectionLink>
        <SectionLink target="cafeteria" section={section} onSectionChange={onSectionChange}>☕ <span>Caja Cafetería</span></SectionLink>
        <SectionLink target="cigarettes" section={section} onSectionChange={onSectionChange}>▥ <span>Cigarrillos</span></SectionLink>
        <SectionLink target="suppliers" section={section} onSectionChange={onSectionChange}>▣ <span>Proveedores</span></SectionLink>
        <SectionLink target="cash-drops" section={section} onSectionChange={onSectionChange}>↘ <span>Tiradas</span></SectionLink>
      </div>
      <div className="sidebar-nav-group">
        <p>Cierres y control</p>
        <SectionLink target="shift-close" section={section} onSectionChange={onSectionChange}>✓ <span>Cierre de turno</span></SectionLink>
        <SectionLink target="history" section={section} onSectionChange={onSectionChange}>◷ <span>Historial de mesas</span></SectionLink>
      </div>
      <div className="sidebar-nav-group">
        <p>Sistema</p>
        <SectionLink target="settings" section={section} onSectionChange={onSectionChange}>⚙ <span>Configuraciones</span></SectionLink>
      </div>
    </nav>
    <ThemeToggle resolvedTheme={resolvedTheme} onThemeChange={onThemeChange} />
    <div className="profile"><i>A</i><span><b>{user.name}</b><small>Administrador</small></span><button className="logout-button" title="Cerrar sesión" onClick={onSignOut}>↪</button></div>
  </aside>
}
