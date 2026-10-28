import ThemeToggle from '../appearance/ThemeToggle.jsx'

export default function LoginForm({ login, error, onLoginChange, onSubmit, resolvedTheme, onThemeChange, busy, restoring }) {
  return <main className="login"><ThemeToggle resolvedTheme={resolvedTheme} onThemeChange={onThemeChange} /><form onSubmit={onSubmit}>
    <div className="icon">☕</div>
    <p className="eyebrow">SHOP FAMILY</p>
    <h1>Bienvenido</h1>
    <label>Usuario<input required autoComplete="username" maxLength={100} disabled={busy || restoring} value={login.username} onChange={(event) => onLoginChange({ ...login, username: event.target.value })} /></label>
    <label>Contraseña<input required autoComplete="current-password" type="password" maxLength={1024} disabled={busy || restoring} value={login.password} onChange={(event) => onLoginChange({ ...login, password: event.target.value })} /></label>
    {error && <p className="error">{error}</p>}
    <button className="primary wide" disabled={busy || restoring}>{restoring ? 'Verificando sesión…' : busy ? 'Ingresando…' : 'Ingresar →'}</button>
  </form></main>
}
