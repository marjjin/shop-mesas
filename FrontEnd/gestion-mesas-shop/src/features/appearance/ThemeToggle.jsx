import ThemeIcon from './ThemeIcon.jsx'

export default function ThemeToggle({ resolvedTheme, onThemeChange }) {
  const next = resolvedTheme === 'dark' ? 'light' : 'dark'
  const label = next === 'dark' ? 'Activar modo oscuro' : 'Activar modo claro'
  return <button type="button" className="theme-toggle" aria-label={label} title={label} onClick={() => onThemeChange(next)}><ThemeIcon theme={next} /><span>{next === 'dark' ? 'Modo oscuro' : 'Modo claro'}</span></button>
}
