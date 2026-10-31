// Muestra la versión de package.json, la fuente única de verdad del número de versión.
import { version } from '../../../package.json'
import './AppVersion.css'

export default function AppVersion() {
  return <small className="app-version" aria-label={`Versión ${version}`}>v{version}</small>
}
