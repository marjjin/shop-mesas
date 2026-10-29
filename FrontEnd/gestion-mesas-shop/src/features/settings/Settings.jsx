import AppearanceSettings from '../appearance/AppearanceSettings.jsx'
import Icon from './components/SettingsIcon.jsx'
import WelcomeTicketEditor from './components/WelcomeTicketEditor.jsx'
import WelcomeTicketPreview from './components/WelcomeTicketPreview.jsx'
import WelcomeTicketActions from './components/WelcomeTicketActions.jsx'
import useWelcomeTicketEditor from './hooks/useWelcomeTicketEditor.js'
import { SettingsSkeleton } from '../../shared/components/LoadingSkeleton.jsx'
import './Settings.css'

export default function Settings({ api, welcomeSettings, loadError, onWelcomeSettingsChange, themePreference, resolvedTheme, onThemeChange }) {
  const editor = useWelcomeTicketEditor({ api, welcomeSettings, loadError, onWelcomeSettingsChange })
  const { loading, action } = editor

  return <div className="settings-page">
    <header className="settings-header"><div><p className="eyebrow">SISTEMA</p><h1>Configuraciones</h1><p>Personalizá tu espacio de trabajo y los tickets para tus clientes.</p></div></header>
    <AppearanceSettings preference={themePreference} resolvedTheme={resolvedTheme} onThemeChange={onThemeChange} />
    <section className="settings-card" aria-labelledby="welcome-settings-title" aria-busy={loading || action !== null}>
      <div className="settings-card-heading">
        <span className="settings-icon"><Icon name="receipt" /></span>
        <div><h2 id="welcome-settings-title">Ticket de bienvenida</h2><p>Editá los textos y el consumo mínimo del ticket.</p></div>
        <span className="settings-card-badge">PERSONALIZACIÓN</span>
      </div>
      {loading ? <SettingsSkeleton /> : <>
        <div className="settings-workspace">
          <WelcomeTicketEditor editor={editor} />
          <WelcomeTicketPreview editor={editor} />
        </div>
        <WelcomeTicketActions editor={editor} />
      </>}
    </section>
  </div>
}
