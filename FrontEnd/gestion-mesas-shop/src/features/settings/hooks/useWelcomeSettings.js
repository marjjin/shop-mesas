import { useEffect, useState } from 'react'
import { requireWelcomeMessageSettings } from '../../../shared/utils/welcomeMessage.js'

export default function useWelcomeSettings(api, user, section) {
  const [welcomeSettings, setWelcomeSettings] = useState(null)
  const [welcomeSettingsError, setWelcomeSettingsError] = useState('')
  useEffect(() => {
    if (!user) return
    let cancelled = false
    api('/settings/welcome-message', { cache: 'no-store' }).then((setting) => {
      if (!cancelled) { setWelcomeSettings(requireWelcomeMessageSettings(setting)); setWelcomeSettingsError('') }
    }).catch((error) => { if (!cancelled) setWelcomeSettingsError(error.message) })
    return () => { cancelled = true }
  }, [user, api, section])
  const updateWelcomeSettings = (settings) => {
    setWelcomeSettings(settings)
    setWelcomeSettingsError('')
  }
  return { welcomeSettings, welcomeSettingsError, updateWelcomeSettings }
}
