import { welcomeTextFields } from '../../../shared/utils/welcomeMessage.js'
import Icon from './SettingsIcon.jsx'

export default function WelcomeTicketEditor({ editor }) {
  const { action, activeTab, amountDirty, textDirty, loading, dirty, loadError, retry,
    moveTab, setActiveTab, save, draft, fieldError, amount, unavailable, change,
    savedLabel, activeField, values, saved, textErrors, setActiveField } = editor

  return <div className="settings-editor">
    <div className="settings-editor-heading"><span className="settings-overline">EDITAR CONTENIDO</span><span className={'settings-status' + (loadError ? ' offline' : dirty ? ' pending' : '')} role="status">{action === 'save' ? 'Guardando…' : loading ? 'Cargando…' : loadError ? 'No disponible' : dirty ? 'Sin guardar' : 'Todo guardado'}</span></div>
    {loadError && <div className="settings-notice error" role="alert"><Icon name="info" /><div><p>{loadError}</p><button type="button" onClick={retry} disabled={action !== null}>{action === 'reload' ? 'Reintentando…' : 'Volver a cargar'}</button></div></div>}
    <div className="settings-tabs" role="tablist" aria-label="Contenido del ticket" onKeyDown={moveTab}>
      {[['amount', 'Importe', amountDirty], ['text', 'Texto del ticket', textDirty]].map(([key, label, edited]) => <button key={key} id={'welcome-tab-' + key} type="button" role="tab" aria-selected={activeTab === key} aria-controls={'welcome-panel-' + key} tabIndex={activeTab === key ? 0 : -1} disabled={action !== null} onClick={() => setActiveTab(key)}>{label}{edited && <span className="settings-tab-marker" aria-label="Cambios pendientes" />}</button>)}
    </div>
    <form id="welcome-settings-form" className="settings-form" onSubmit={save} noValidate>
      {activeTab === 'amount' ? <div role="tabpanel" id="welcome-panel-amount" aria-labelledby="welcome-tab-amount" className="settings-amount-panel">
        <div className="settings-panel-title"><span className="settings-panel-icon">$</span><div><h3>Consumo mínimo</h3><p>El importe que verá el cliente en su bienvenida.</p></div></div>
        <label htmlFor="welcome-message-amount">Importe en pesos</label>
        <p className="settings-field-help" id="welcome-amount-help">Podés ingresar 0 si no hay consumo mínimo.</p>
        <div className={'settings-amount-field' + (draft !== null && fieldError ? ' invalid' : '')}>
          <span className="settings-currency-symbol" aria-hidden="true">$</span>
          <input id="welcome-message-amount" required type="number" min="0" max="999999999.99" step="0.01" inputMode="decimal" autoComplete="off" placeholder={loading ? 'Cargando…' : '0'} disabled={unavailable} value={amount} aria-invalid={draft !== null && !!fieldError} aria-describedby={'welcome-amount-help' + (draft !== null && fieldError ? ' welcome-amount-error' : '')} onChange={(event) => change('amount', event.target.value)} />
          <span className="settings-currency-code">ARS</span>
        </div>
        {draft !== null && fieldError && <p className="settings-field-error" id="welcome-amount-error">{fieldError}</p>}
        <div className="settings-saved-value"><span>Importe actual</span><strong>{loading ? 'Cargando…' : savedLabel}</strong></div>
        <div className="settings-amount-tip"><Icon name="info" /><p>El valor se imprime al abrir una mesa o al asignarle un pedido.</p></div>
      </div> : <div role="tabpanel" id="welcome-panel-text" aria-labelledby="welcome-tab-text">
        <div className="settings-text-intro"><p>Elegí una parte para editarla.</p><a className="settings-mobile-preview-link" href="#welcome-ticket-preview"><Icon name="eye" /> Ver ticket</a></div>
        <div className="settings-section-list">
          {welcomeTextFields.map((field, index) => {
            const id = 'welcome-' + field.key
            const open = activeField === field.key
            const edited = draft && values[field.key] !== saved[field.key]
            const error = textErrors[field.key]
            const props = { id, value: values[field.key], disabled: unavailable, required: !!field.required, maxLength: field.maxLength, 'aria-invalid': !!error, 'aria-describedby': id + '-help' + (error ? ' ' + id + '-error' : ''), onChange: (event) => change(field.key, event.target.value) }
            return <div className={'settings-section' + (open ? ' is-open' : '') + (error ? ' has-error' : '')} key={field.key}>
              <button className="settings-section-toggle" type="button" id={id + '-toggle'} aria-expanded={open} aria-controls={id + '-panel'} disabled={action !== null} onClick={() => setActiveField(open ? null : field.key)}>
                <span className="settings-section-number">{String(index + 1).padStart(2, '0')}</span>
                <span className="settings-section-description"><strong>{field.label}</strong><span>{values[field.key].trim() || (field.required ? 'Completá este texto' : 'Sin texto · opcional')}</span></span>
                {error ? <span className="settings-section-error"><Icon name="info" /><span className="settings-sr-only">Revisar campo</span></span> : edited ? <span className="settings-tab-marker" aria-label="Cambios pendientes" /> : null}
                <Icon name="chevron" />
              </button>
              {open && <div id={id + '-panel'} className="settings-section-content settings-text-field" role="region" aria-labelledby={id + '-toggle'}>
                <div className="settings-field-heading"><label className="settings-sr-only" htmlFor={id}>{field.label}</label><span>{field.required ? 'Campo obligatorio' : 'Opcional · podés dejarlo vacío'}</span></div>
                {field.rows ? <textarea {...props} rows={field.rows} /> : <input {...props} type="text" />}
                <div className="settings-text-hint" id={id + '-help'}><span>{field.help}</span><small>{values[field.key].length}/{field.maxLength}</small></div>
                {error && <p className="settings-field-error" id={id + '-error'}>{error}</p>}
              </div>}
            </div>
          })}
        </div>
      </div>}
    </form>
    <p className="settings-editor-note"><Icon name="info" />{activeTab === 'text' ? 'Editar el mensaje modifica lo que se imprime. La duración de las mesas sigue siendo la misma.' : 'Guardá los cambios para aplicarlos a los próximos tickets.'}</p>
  </div>
}
