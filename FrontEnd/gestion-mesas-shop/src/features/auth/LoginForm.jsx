export default function LoginForm({ login, error, onLoginChange, onSubmit }) {
  return <main className="login"><form onSubmit={onSubmit}>
    <div className="icon">☕</div>
    <p className="eyebrow">GESTIÓN DE MESAS</p>
    <h1>Bienvenido</h1>
    <label>Usuario<input value={login.username} onChange={(event) => onLoginChange({ ...login, username: event.target.value })} /></label>
    <label>Contraseña<input type="password" value={login.password} onChange={(event) => onLoginChange({ ...login, password: event.target.value })} /></label>
    {error && <p className="error">{error}</p>}
    <button className="primary wide">Ingresar →</button>
    <small>Demo: <b>admin / admin</b></small>
  </form></main>
}
