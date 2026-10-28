import { useEffect, useId, useRef, useState } from 'react'
import ThemeToggle from '../appearance/ThemeToggle.jsx'
import NavigationMenu from './NavigationMenu.jsx'
import { sectionLabels } from './navigationItems.js'

export default function MobileNavigation({ user, section, pendingOrdersCount, onSectionChange, onSignOut, resolvedTheme, onThemeChange }) {
  const dialogRef = useRef(null)
  const dialogId = useId()
  const titleId = useId()
  const [isOpen, setIsOpen] = useState(false)
  const closeMenu = () => dialogRef.current?.close()
  const openMenu = () => {
    if (dialogRef.current.open) return
    dialogRef.current.showModal()
    setIsOpen(true)
  }

  useEffect(() => {
    if (!isOpen) return
    const dialog = dialogRef.current
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const media = window.matchMedia('(max-width: 680px)')
    const close = () => dialog.close()
    const onResize = (event) => { if (!event.matches) close() }
    media.addEventListener('change', onResize)
    window.addEventListener('popstate', close)
    return () => {
      document.body.style.overflow = previousOverflow
      media.removeEventListener('change', onResize)
      window.removeEventListener('popstate', close)
      if (dialog.open) dialog.close()
    }
  }, [isOpen])

  return <>
    <header className="mobile-header">
      <button type="button" className="mobile-menu-trigger" aria-label="Abrir menú principal" aria-haspopup="dialog" aria-controls={dialogId} aria-expanded={isOpen} onClick={openMenu}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M4 6h16 M4 12h16 M4 18h16" /></svg>
      </button>
      <div className="mobile-brand"><strong>SHOP <span>FAMILY</span></strong><small>{sectionLabels[section]}</small></div>
      <ThemeToggle resolvedTheme={resolvedTheme} onThemeChange={onThemeChange} />
    </header>
    <dialog ref={dialogRef} id={dialogId} className="mobile-nav-dialog" aria-labelledby={titleId} onClose={() => setIsOpen(false)} onClick={(event) => {
      if (event.target !== event.currentTarget) return
      const bounds = event.currentTarget.getBoundingClientRect()
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) closeMenu()
    }}>
      <div className="mobile-nav-heading">
        <div><p>SHOP <span>FAMILY</span></p><h2 id={titleId}>Menú principal</h2></div>
        <button type="button" className="mobile-menu-close" aria-label="Cerrar menú" autoFocus onClick={closeMenu}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12 M18 6L6 18" /></svg>
        </button>
      </div>
      <NavigationMenu section={section} pendingOrdersCount={pendingOrdersCount} onSectionChange={(next) => { onSectionChange(next); closeMenu() }} />
      <footer className="mobile-nav-footer">
        <div className="mobile-nav-account"><span aria-hidden="true">{(user.name || user.username || 'S').trim().charAt(0).toUpperCase()}</span><div><strong>{user.name}</strong><small>Administrador</small></div></div>
        <button type="button" className="mobile-nav-logout" onClick={() => { closeMenu(); onSignOut() }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 4H4v16h5 M9 12h12 M16 7l5 5-5 5" /></svg>Cerrar sesión
        </button>
      </footer>
    </dialog>
  </>
}
