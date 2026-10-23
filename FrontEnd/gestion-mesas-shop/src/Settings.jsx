import { useEffect, useState } from 'react'
import AppearanceSettings from './features/appearance/AppearanceSettings.jsx'
import { requireWelcomeMessageSettings, welcomeMessageContent, welcomeMessageDefaults, welcomeTextFields } from './shared/utils/welcomeMessage.js'
import './Settings.css'

const money = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0, maximumFractionDigits: 2 })

function Icon({ name }) {
  const paths = {
    receipt: 'M7 3h10v18l-2.5-2-2.5 2-2.5-2L7 21V3Zm3 5h4m-4 4h4',
    check: 'm5 12 4 4L19 6',
    info: 'M12 11v6m0-10v.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
    eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Zm13 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
    chevron: 'm9 5 7 7-7 7',
    edit: 'm15 5 4 4M4 20l4-1L20 7a2.8 2.8 0 0 0-4-4L4 15v5Z',
    close: 'm6 6 12 12M6 18 18 6',
  }
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>
}

export default function Settings({ api, welcomeSettings, loadError, onWelcomeSettingsChange, themePreference, resolvedTheme, onThemeChange }) {
  const [draft, setDraft] = useState(null)
  const [notice, setNotice] = useState(null)
  const [action, setAction] = useState(null)
  const [activeTab, setActiveTab] = useState('amount')
  const [activeField, setActiveField] = useState('greetingText')
  const [focusRequest, setFocusRequest] = useState(null)
  const saved = { ...welcomeMessageDefaults, ...welcomeSettings }
  const values = draft ?? { ...saved, amount: welcomeSettings ? String(saved.amount) : '' }
  const amount = String(values.amount)
  const parsedAmount = Number(amount)
  const loading = !welcomeSettings && !loadError
  const fieldError = amount.trim() === '' ? 'Ingresá un importe. Podés usar 0 si no hay consumo mínimo.'
    : !Number.isFinite(parsedAmount) || parsedAmount < 0 || parsedAmount > 999999999.99 ? 'Ingresá un importe entre $0 y $999.999.999,99.'
      : Math.abs(parsedAmount * 100 - Math.round(parsedAmount * 100)) > 0.00001 ? 'Usá hasta dos decimales.' : ''
  const textErrors = Object.fromEntries(welcomeTextFields.map((field) => [field.key,
    field.required && !values[field.key].trim() ? 'Este campo es obligatorio.'
      : values[field.key].trim().length > field.maxLength ? 'Usá hasta ' + field.maxLength + ' caracteres.' : '',
  ]))
  const hasTextErrors = Object.values(textErrors).some(Boolean)
  const amountDirty = draft !== null && (!!fieldError || parsedAmount !== saved.amount)
  const changedFields = draft ? welcomeTextFields.filter(({ key }) => values[key] !== saved[key]) : []
  const textDirty = changedFields.length > 0
  const changeCount = changedFields.length + (amountDirty ? 1 : 0)
  const dirty = changeCount > 0
  const invalid = !!fieldError || hasTextErrors
  const unavailable = loading || !!loadError || action !== null
  const content = welcomeMessageContent(values, 'Ana')
  const savedLabel = welcomeSettings ? money.format(saved.amount) : '—'
  const previewLabel = fieldError ? '—' : money.format(parsedAmount)
  const change = (key, value) => { setDraft({ ...values, [key]: value }); setNotice(null) }

  useEffect(() => {
    if (!focusRequest) return
    const element = document.getElementById(focusRequest.key === 'amount' ? 'welcome-message-amount' : 'welcome-' + focusRequest.key)
    if (!element || element.disabled) return
    element.focus({ preventScroll: true })
    element.scrollIntoView({ block: 'nearest', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })
  }, [focusRequest])

  const selectField = (key) => {
    if (unavailable) return
    setActiveTab(key === 'amount' ? 'amount' : 'text')
    setActiveField(key)
    setFocusRequest({ key })
  }

  const save = async (event) => {
    event.preventDefault()
    if (unavailable || !dirty || invalid) return
    setAction('save')
    setNotice(null)
    try {
      const payload = Object.fromEntries(welcomeTextFields.map(({ key }) => [key, values[key].trim()]))
      const updated = requireWelcomeMessageSettings(await api('/settings/welcome-message', { method: 'PUT', body: JSON.stringify({ ...payload, amount: parsedAmount }) }))
      onWelcomeSettingsChange(updated)
      setDraft(null)
      setNotice({ type: 'success', text: 'Cambios guardados. Se aplicarán a los próximos tickets.' })
    } catch (error) {
      setNotice({ type: 'error', text: error.message || 'No se pudo guardar. Tus cambios siguen disponibles para reintentar.' })
    } finally {
      setAction(null)
    }
  }

  const retry = async () => {
    setAction('reload')
    setNotice(null)
    try {
      const updated = requireWelcomeMessageSettings(await api('/settings/welcome-message', { cache: 'no-store' }))
      onWelcomeSettingsChange(updated)
    } catch (error) {
      setNotice({ type: 'error', text: error.message || 'No se pudo cargar la configuración.' })
    } finally {
      setAction(null)
    }
  }

  const moveTab = (event) => {
    if (unavailable || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const next = event.key === 'Home' ? 'amount' : event.key === 'End' ? 'text' : activeTab === 'amount' ? 'text' : 'amount'
    setActiveTab(next)
    event.currentTarget.querySelector('#welcome-tab-' + next).focus()
  }

  const previewProps = (key, label) => ({
    type: 'button',
    className: 'settings-ticket-edit' + ((key === 'amount' ? amountDirty : draft && values[key] !== saved[key]) ? ' changed' : '') + ((key === 'amount' ? activeTab === 'amount' : activeTab === 'text' && activeField === key) ? ' selected' : ''),
    'aria-label': 'Editar ' + label.toLowerCase(),
    title: 'Editar ' + label.toLowerCase(),
    disabled: unavailable,
    onClick: () => selectField(key),
  })
  const reviewErrors = () => selectField(fieldError ? 'amount' : welcomeTextFields.find(({ key }) => textErrors[key]).key)

  return <div className="settings-page">
    <header className="settings-header"><div><p className="eyebrow">SISTEMA</p><h1>Configuraciones</h1><p>Personalizá tu espacio de trabajo y los tickets para tus clientes.</p></div></header>
    <AppearanceSettings preference={themePreference} resolvedTheme={resolvedTheme} onThemeChange={onThemeChange} />
    <section className="settings-card" aria-labelledby="welcome-settings-title" aria-busy={loading || action !== null}>
      <div className="settings-card-heading">
        <span className="settings-icon"><Icon name="receipt" /></span>
        <div><h2 id="welcome-settings-title">Ticket de bienvenida</h2><p>Editá los textos y el consumo mínimo del ticket.</p></div>
        <span className="settings-card-badge">PERSONALIZACIÓN</span>
      </div>
      <div className="settings-workspace">
        <div className="settings-editor">
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
        <aside className="settings-preview" id="welcome-ticket-preview" aria-label="Vista previa del ticket de bienvenida"><div className="settings-preview-content">
          <div className="settings-preview-heading"><span><Icon name="eye" /> TU TICKET</span><small>Ejemplo con Ana</small></div>
          <p className="settings-preview-instruction"><Icon name="edit" /> Tocá una parte del ticket para editarla.</p>
          <div className="settings-ticket">
            <div className="settings-ticket-brand"><button {...previewProps('businessName', 'Encabezado')}><span>{content.businessName || 'Encabezado'}</span></button><small>BIENVENIDA</small></div>
            <div className="settings-ticket-greeting"><button {...previewProps('greetingText', 'Bienvenida')}><strong>{content.greetingText || 'Bienvenida'}</strong></button>{content.messageText && <button {...previewProps('messageText', 'Mensaje principal')}><span>{content.messageText}</span></button>}</div>
            {content.conditionsText && <div className="settings-ticket-conditions"><button {...previewProps('conditionsText', 'Información adicional')}><span>{content.conditionsText}</span></button></div>}
            <div className="settings-ticket-amount"><button {...previewProps('minimumLabel', 'Descripción del importe')}><span>{content.minimumLabel || 'Consumo mínimo'}</span></button><button {...previewProps('amount', 'Importe')}><strong>{loading || loadError ? '—' : previewLabel}</strong></button></div>
            {content.footerText && <div className="settings-ticket-footer"><button {...previewProps('footerText', 'Mensaje final')}><span>{content.footerText}</span></button></div>}
          </div>
          <p className="settings-preview-caption">{dirty ? 'Vista previa · cambios todavía sin guardar' : 'Así se verá el próximo ticket de bienvenida.'}</p>
        </div></aside>
      </div>
      <div className={'settings-actionbar' + (dirty ? ' has-changes' : '')}>
        <div className={'settings-action-status' + (notice?.type === 'error' ? ' error' : notice?.type === 'success' ? ' success' : '')} role={notice?.type === 'error' ? 'alert' : 'status'}>
          <Icon name={notice?.type === 'error' || dirty && invalid ? 'info' : 'check'} />
          <div><strong>{notice ? notice.text : loading ? 'Cargando configuración…' : loadError ? 'Configuración no disponible' : dirty ? changeCount + (changeCount === 1 ? ' cambio pendiente' : ' cambios pendientes') : 'Sin cambios pendientes'}</strong>{dirty && invalid ? <button type="button" onClick={reviewErrors} disabled={unavailable}>Revisar los campos señalados</button> : dirty && !notice ? <span>Guardalos para actualizar los próximos tickets.</span> : null}</div>
          {notice && <button className="settings-dismiss-notice" type="button" aria-label="Cerrar mensaje" onClick={() => setNotice(null)}><Icon name="close" /></button>}
        </div>
        <div className="settings-form-actions"><button type="button" className="settings-discard" disabled={!dirty || unavailable} onClick={() => { setDraft(null); setNotice(null) }}>Descartar</button><button type="submit" form="welcome-settings-form" className="settings-save" disabled={!dirty || invalid || unavailable}>{action === 'save' ? <span className="settings-spinner" aria-hidden="true" /> : <Icon name="check" />}{action === 'save' ? 'Guardando…' : 'Guardar cambios'}</button></div>
      </div>
    </section>
  </div>
}
