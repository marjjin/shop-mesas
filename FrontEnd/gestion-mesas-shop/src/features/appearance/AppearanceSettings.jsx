import ThemeIcon from './ThemeIcon.jsx'
import './Appearance.css'

const options = [
  { value: 'light', label: 'Claro', description: 'Fondos claros y cálidos.' },
  { value: 'dark', label: 'Oscuro', description: 'Menos brillo, mismo detalle.' },
  { value: 'system', label: 'Sistema', description: 'Se adapta a tu dispositivo.' },
]

export default function AppearanceSettings({ preference, resolvedTheme, onThemeChange }) {
  return <section className="appearance-card" aria-labelledby="appearance-title">
    <div className="appearance-heading"><span className="appearance-icon"><ThemeIcon theme={resolvedTheme} /></span><div><h2 id="appearance-title">Apariencia</h2><p>Elegí cómo querés ver tu espacio de trabajo.</p></div></div>
    <fieldset className="appearance-options">
      <legend className="appearance-sr-only">Tema de la aplicación</legend>
      {options.map(({ value, label, description }) => <label className={'appearance-option' + (preference === value ? ' is-selected' : '')} key={value}>
        <input type="radio" name="appearance" value={value} checked={preference === value} onChange={() => onThemeChange(value)} />
        <span className={'appearance-sample appearance-sample-' + value} aria-hidden="true"><span className="appearance-sample-nav" /><span className="appearance-sample-body"><span /><span /><span /></span></span>
        <span className="appearance-option-label"><ThemeIcon theme={value} /><strong>{label}</strong><span className="appearance-radio" aria-hidden="true" /></span>
        <span className="appearance-description">{description}</span>
      </label>)}
    </fieldset>
    <p className="appearance-note" role="status"><span aria-hidden="true">✓</span> Se aplica al instante y se recuerda en este navegador.{preference === 'system' ? ` Ahora estás usando el modo ${resolvedTheme === 'dark' ? 'oscuro' : 'claro'}.` : ''}</p>
  </section>
}
