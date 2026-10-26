import { useState } from 'react'

export default function useSession(api, setMessage) {
  const [user, setUser] = useState(() => JSON.parse(sessionStorage.getItem('mesa-user') || 'null'))
  const [login, setLogin] = useState({ username: 'admin', password: 'admin' })

  const loginSubmit = async (event) => {
    event.preventDefault()
    try {
      const result = await api('/login', { method: 'POST', body: JSON.stringify(login) })
      sessionStorage.setItem('mesa-user', JSON.stringify(result.user))
      setUser(result.user)
    } catch (error) {
      setMessage(error.message)
    }
  }

  const signOut = () => {
    sessionStorage.removeItem('mesa-user')
    setUser(null)
  }
  return { user, login, setLogin, loginSubmit, signOut }
}
