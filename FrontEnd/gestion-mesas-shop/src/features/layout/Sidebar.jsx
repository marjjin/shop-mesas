export default function Sidebar({ user, section, pendingOrdersCount, onSectionChange, onSignOut }) {
  return <aside className="sidebar">
    <div className="logo">☕ Mesa<span>.</span></div>
    <nav className="sidebar-nav" aria-label="Navegación principal">
      <div className="sidebar-nav-group">
        <p>Operación</p>
        <button className={section === 'salon' ? 'active' : ''} onClick={() => onSectionChange('salon')}>▦ <span>Plano de mesas</span></button>
        <button className={section === 'pending' ? 'active' : ''} onClick={() => onSectionChange('pending')}>⌛ <span>Pedidos{pendingOrdersCount ? ` (${pendingOrdersCount})` : ''}</span></button>
      </div>
      <div className="sidebar-nav-group">
        <p>Cajas y stock</p>
        <button className={section === 'catalog' ? 'active' : ''} onClick={() => onSectionChange('catalog')}>☷ <span>Artículos</span></button>
        <button className={section === 'cafeteria' ? 'active' : ''} onClick={() => onSectionChange('cafeteria')}>☕ <span>Caja Cafetería</span></button>
        <button className={section === 'cigarettes' ? 'active' : ''} onClick={() => onSectionChange('cigarettes')}>▥ <span>Cigarrillos</span></button>
        <button className={section === 'suppliers' ? 'active' : ''} onClick={() => onSectionChange('suppliers')}>▣ <span>Proveedores</span></button>
      </div>
      <div className="sidebar-nav-group">
        <p>Cierres y control</p>
        <button className={section === 'shift-close' ? 'active' : ''} onClick={() => onSectionChange('shift-close')}>✓ <span>Cierre de turno</span></button>
        <button className={section === 'history' ? 'active' : ''} onClick={() => onSectionChange('history')}>◷ <span>Historial de mesas</span></button>
      </div>
    </nav>
    <div className="profile"><i>A</i><span><b>{user.name}</b><small>Administrador</small></span><button className="logout-button" title="Cerrar sesión" onClick={onSignOut}>↪</button></div>
  </aside>
}
