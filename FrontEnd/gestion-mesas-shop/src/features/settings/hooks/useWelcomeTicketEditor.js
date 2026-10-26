import { useEffect, useState } from 'react'
import { requireWelcomeMessageSettings, welcomeMessageContent, welcomeMessageDefaults, welcomeTextFields } from '../../../shared/utils/welcomeMessage.js'
import { preciseMoney as money } from '../../../shared/utils/currency.js'

export default function useWelcomeTicketEditor({ api, welcomeSettings, loadError, onWelcomeSettingsChange }) {
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


  return {
    draft, setDraft, notice, setNotice, action, activeTab, setActiveTab, activeField,
    setActiveField, saved, values, amount, loading, fieldError, textErrors, amountDirty,
    textDirty, changeCount, dirty, invalid, unavailable, content, savedLabel,
    previewLabel, change, save, retry, moveTab, previewProps, reviewErrors, loadError,
  }
}
