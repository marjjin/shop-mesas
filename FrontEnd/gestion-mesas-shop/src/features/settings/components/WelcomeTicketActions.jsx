import Icon from './SettingsIcon.jsx'

export default function WelcomeTicketActions({ editor }) {
  const { dirty, notice, invalid, loading, loadError, changeCount, reviewErrors,
    unavailable, setNotice, setDraft, action } = editor

  return <div className={'settings-actionbar' + (dirty ? ' has-changes' : '')}>
    <div className={'settings-action-status' + (notice?.type === 'error' ? ' error' : notice?.type === 'success' ? ' success' : '')} role={notice?.type === 'error' ? 'alert' : 'status'}>
      <Icon name={notice?.type === 'error' || dirty && invalid ? 'info' : 'check'} />
      <div><strong>{notice ? notice.text : loading ? 'Cargando configuración…' : loadError ? 'Configuración no disponible' : dirty ? changeCount + (changeCount === 1 ? ' cambio pendiente' : ' cambios pendientes') : 'Sin cambios pendientes'}</strong>{dirty && invalid ? <button type="button" onClick={reviewErrors} disabled={unavailable}>Revisar los campos señalados</button> : dirty && !notice ? <span>Guardalos para actualizar los próximos tickets.</span> : null}</div>
      {notice && <button className="settings-dismiss-notice" type="button" aria-label="Cerrar mensaje" onClick={() => setNotice(null)}><Icon name="close" /></button>}
    </div>
    <div className="settings-form-actions"><button type="button" className="settings-discard" disabled={!dirty || unavailable} onClick={() => { setDraft(null); setNotice(null) }}>Descartar</button><button type="submit" form="welcome-settings-form" className="settings-save" disabled={!dirty || invalid || unavailable}>{action === 'save' ? <span className="settings-spinner" aria-hidden="true" /> : <Icon name="check" />}{action === 'save' ? 'Guardando…' : 'Guardar cambios'}</button></div>
  </div>
}
