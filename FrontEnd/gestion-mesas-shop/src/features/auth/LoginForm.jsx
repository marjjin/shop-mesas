import { useState } from 'react'
import ThemeToggle from '../appearance/ThemeToggle.jsx'
import AppVersion from '../../shared/components/AppVersion.jsx'
import LoginIcon from './components/LoginIcon.jsx'
import LoginIllustration from './components/LoginIllustration.jsx'
import './LoginForm.css'

export default function LoginForm({ login, error, onLoginChange, onSubmit, resolvedTheme, onThemeChange, busy, restoring }) {
  const [passwordVisible, setPasswordVisible] = useState(false)
  const [capsLock, setCapsLock] = useState(false)
  const unavailable = busy || restoring
  const invalidCredentials = error === 'Usuario o contraseña incorrectos.'
  const updateCapsLock = (event) => setCapsLock(event.getModifierState('CapsLock'))

  return <main className="auth-page">
    <div className="auth-shell">
      <section className="auth-brand-panel" aria-label="SHOP FAMILY, gestión del salón">
        <div className="auth-brand"><span className="auth-brand-mark"><LoginIcon name="coffee" /></span><span><strong>SHOP <b>FAMILY</b></strong><small>Gestión del salón</small></span></div>
        <div className="auth-brand-content">
          <h2>Gestión de mesas<br />y cajas</h2>
          <p>Registro de pedidos, administración de artículos y consulta de cierres de turno.</p>
          <LoginIllustration />
        </div>
        <div className="auth-brand-footer"><span><LoginIcon name="tables" />Mesas y pedidos</span><span><LoginIcon name="receipt" />Cajas y cierres</span></div>
      </section>

      <section className="auth-form-panel" aria-labelledby="auth-login-title">
        <div className="auth-panel-top"><ThemeToggle resolvedTheme={resolvedTheme} onThemeChange={onThemeChange} /></div>
        <div className="auth-form-area">
          <div className="auth-form-heading"><span className="auth-form-symbol"><LoginIcon name="door" /></span><span className="auth-form-overline">ACCESO AL SISTEMA</span><h1 id="auth-login-title">Iniciar sesión</h1><p>Ingresá tu usuario y contraseña.</p></div>

          <form className="auth-form" onSubmit={onSubmit} aria-busy={unavailable} aria-labelledby="auth-login-title">
            <div className="auth-field-group">
              <label htmlFor="login-username">Usuario</label>
              <div className="auth-input-wrap"><LoginIcon name="user" /><input id="login-username" required autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} maxLength={100} placeholder="Tu nombre de usuario" disabled={unavailable} value={login.username} aria-invalid={invalidCredentials || undefined} aria-describedby={invalidCredentials ? 'login-error' : undefined} onChange={(event) => onLoginChange({ ...login, username: event.target.value })} /></div>
            </div>

            <div className="auth-field-group">
              <div className="auth-password-label"><label htmlFor="login-password">Contraseña</label>{capsLock && <span className="auth-caps-lock" role="status"><LoginIcon name="caps" />Bloq Mayús activado</span>}</div>
              <div className="auth-input-wrap auth-password-field">
                <LoginIcon name="lock" />
                <input id="login-password" required autoComplete="current-password" autoCapitalize="none" autoCorrect="off" spellCheck={false} type={passwordVisible ? 'text' : 'password'} maxLength={1024} placeholder="Tu contraseña" disabled={unavailable} value={login.password} aria-invalid={invalidCredentials || undefined} aria-describedby={invalidCredentials ? 'login-error' : undefined} onKeyDown={updateCapsLock} onKeyUp={updateCapsLock} onBlur={() => setCapsLock(false)} onChange={(event) => onLoginChange({ ...login, password: event.target.value })} />
                <button type="button" className="auth-password-toggle" disabled={unavailable} aria-label={passwordVisible ? 'Ocultar contraseña' : 'Mostrar contraseña'} title={passwordVisible ? 'Ocultar contraseña' : 'Mostrar contraseña'} aria-pressed={passwordVisible} aria-controls="login-password" onClick={() => setPasswordVisible((visible) => !visible)}><LoginIcon name={passwordVisible ? 'eyeOff' : 'eye'} /></button>
              </div>
            </div>

            {error && <div className="auth-error" id="login-error" role="alert"><LoginIcon name="alert" /><span>{error}</span></div>}
            <button type="submit" className="auth-submit" disabled={unavailable}><span>{restoring ? 'Verificando sesión…' : busy ? 'Ingresando…' : 'Ingresar al sistema'}</span>{unavailable ? <span className="auth-spinner" aria-hidden="true" /> : <LoginIcon name="arrow" />}</button>
          </form>

          <p className="auth-access-help">¿Necesitás acceso?<br /><span>Consultá con la persona que administra el local.</span></p>
        </div>
        <footer className="auth-footer"><span>SHOP FAMILY · Gestión del salón</span><AppVersion /></footer>
      </section>
    </div>
  </main>
}
