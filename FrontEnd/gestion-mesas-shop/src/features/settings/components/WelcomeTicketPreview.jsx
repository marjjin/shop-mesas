import Icon from './SettingsIcon.jsx'

export default function WelcomeTicketPreview({ editor }) {
  const { content, previewProps, loading, loadError, previewLabel, dirty } = editor

  return <aside className="settings-preview" id="welcome-ticket-preview" aria-label="Vista previa del ticket de bienvenida"><div className="settings-preview-content">
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
}
