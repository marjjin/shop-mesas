import assert from 'node:assert/strict'
import test from 'node:test'
import { getSessionToken, saveSessionToken, clearSessionToken, expireSession, onSessionExpired } from './sessionToken.js'

test('session expiration cannot erase a newer login and logout removes obsolete local identity', (context) => {
  const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage')
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
  const values = new Map([['mesa-user', JSON.stringify({ username: 'forged-admin' })]])
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  }
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: storage })
  Object.defineProperty(globalThis, 'window', { configurable: true, value: new EventTarget() })
  context.after(() => {
    if (originalStorage) Object.defineProperty(globalThis, 'sessionStorage', originalStorage)
    else delete globalThis.sessionStorage
    if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow)
    else delete globalThis.window
  })
  assert.equal(getSessionToken(), null)
  saveSessionToken('old-session')
  assert.equal(storage.getItem('mesa-user'), null)
  saveSessionToken('new-session')
  let notifications = 0
  const unsubscribe = onSessionExpired(() => { notifications++ })
  expireSession('old-session')
  assert.equal(getSessionToken(), 'new-session')
  assert.equal(notifications, 0)
  expireSession('new-session')
  assert.equal(getSessionToken(), null)
  assert.equal(notifications, 1)
  unsubscribe()
  saveSessionToken('another-session')
  assert.equal(clearSessionToken('different-session'), false)
  assert.equal(clearSessionToken(), true)
  assert.equal(getSessionToken(), null)
})
