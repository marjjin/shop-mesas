import { navigationGroups } from './navigationItems.js'
import { sectionPaths } from './sectionNavigation.js'

export default function NavigationMenu({ section, pendingOrdersCount, onSectionChange }) {
  return <nav className="sidebar-nav" aria-label="Navegación principal">
    {navigationGroups.map((group) => <div className="sidebar-nav-group" key={group.label}>
      <p>{group.label}</p>
      {group.items.map((item) => <a key={item.section} href={sectionPaths[item.section]} className={section === item.section ? 'active' : ''} aria-current={section === item.section ? 'page' : undefined} onClick={(event) => {
        if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return
        event.preventDefault()
        onSectionChange(item.section)
      }}>
        <svg className="navigation-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={item.icon} /></svg>
        <span>{item.label}</span>
        {item.section === 'pending' && pendingOrdersCount > 0 && <span className="navigation-count" aria-label={`${pendingOrdersCount} pedidos pendientes`}>{pendingOrdersCount}</span>}
      </a>)}
    </div>)}
  </nav>
}
