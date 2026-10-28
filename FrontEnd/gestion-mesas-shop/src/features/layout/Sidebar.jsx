import ThemeToggle from '../appearance/ThemeToggle.jsx'
import NavigationMenu from './NavigationMenu.jsx'
import MobileNavigation from './MobileNavigation.jsx'

export default function Sidebar({ user, section, pendingOrdersCount, onSectionChange, onSignOut, resolvedTheme, onThemeChange }) {
  return <>
    <MobileNavigation user={user} section={section} pendingOrdersCount={pendingOrdersCount} onSectionChange={onSectionChange} onSignOut={onSignOut} resolvedTheme={resolvedTheme} onThemeChange={onThemeChange} />
    <aside className="sidebar desktop-sidebar">
      <div className="logo">☕ SHOP <span>FAMILY</span></div>
      <NavigationMenu section={section} pendingOrdersCount={pendingOrdersCount} onSectionChange={onSectionChange} />
      <ThemeToggle resolvedTheme={resolvedTheme} onThemeChange={onThemeChange} />
      <div className="profile"><i>A</i><span><b>{user.name}</b><small>Administrador</small></span><button className="logout-button" title="Cerrar sesión" onClick={onSignOut}>↪</button></div>
    </aside>
  </>
}
