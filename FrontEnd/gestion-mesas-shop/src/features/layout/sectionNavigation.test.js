import assert from 'node:assert/strict'
import test from 'node:test'
import { createSectionNavigation } from './sectionNavigation.js'

function createBrowser(path = '/', savedSection = null) {
  const entries = [{ url: new URL(path, 'https://shop.example'), state: { existing: true } }]
  let index = 0
  const events = new EventTarget()
  const values = new Map([['mesa-session-token', 'existing-session']])
  if (savedSection) values.set('mesa-section', savedSection)
  const browser = {
    get location() { return entries[index].url },
    history: {
      get state() { return entries[index].state },
      get length() { return entries.length },
      replaceState: (state, unused, url) => { entries[index] = { url: new URL(url, browser.location), state } },
      pushState: (state, unused, url) => {
        entries.splice(index + 1)
        entries.push({ url: new URL(url, browser.location), state })
        index++
      },
      back: () => { if (index > 0) { index--; events.dispatchEvent(new Event('popstate')) } },
      forward: () => { if (index < entries.length - 1) { index++; events.dispatchEvent(new Event('popstate')) } },
    },
    sessionStorage: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
    },
    addEventListener: (...args) => events.addEventListener(...args),
    removeEventListener: (...args) => events.removeEventListener(...args),
  }
  return browser
}

test('the old root URL restores the saved section without adding a history entry or changing the session', () => {
  const browser = createBrowser('/', 'suppliers')
  const navigation = createSectionNavigation(browser)
  assert.equal(navigation.getSnapshot(), 'suppliers')
  navigation.initialize()
  navigation.initialize()
  assert.equal(browser.location.pathname, '/proveedores')
  assert.equal(browser.history.length, 1)
  assert.deepEqual(browser.history.state, { existing: true })
  assert.equal(browser.sessionStorage.getItem('mesa-session-token'), 'existing-session')
})

test('direct links and refresh use the URL instead of a different remembered section', () => {
  const browser = createBrowser('/cierre-turno', 'cafeteria')
  const navigation = createSectionNavigation(browser)
  assert.equal(navigation.getSnapshot(), 'shift-close')
  navigation.initialize()
  assert.equal(browser.sessionStorage.getItem('mesa-section'), 'shift-close')
  const reloaded = createSectionNavigation(browser)
  reloaded.initialize()
  assert.equal(reloaded.getSnapshot(), 'shift-close')
  assert.equal(browser.history.length, 1)
})

test('invoice links, refresh and history preserve the selected section', () => {
  const browser = createBrowser('/facturas', 'suppliers')
  const navigation = createSectionNavigation(browser)
  assert.equal(navigation.initialize(), 'invoices')
  const unsubscribe = navigation.subscribe(() => {})
  navigation.navigate('suppliers')
  browser.history.back()
  assert.equal(navigation.getSnapshot(), 'invoices')
  assert.equal(browser.location.pathname, '/facturas')
  assert.equal(createSectionNavigation(browser).initialize(), 'invoices')
  unsubscribe()
})

test('Back and Forward traverse the visited sections without pushing new entries and notify section cleanup', () => {
  const browser = createBrowser('/mesas')
  const navigation = createSectionNavigation(browser)
  navigation.initialize()
  const visited = []
  const unsubscribe = navigation.subscribe((section) => visited.push(section))
  navigation.navigate('pending')
  navigation.navigate('cafeteria')
  navigation.navigate('suppliers')
  assert.equal(browser.location.pathname, '/proveedores')
  assert.equal(browser.history.length, 4)
  browser.history.back()
  assert.equal(navigation.getSnapshot(), 'cafeteria')
  assert.equal(browser.location.pathname, '/cafeteria')
  browser.history.back()
  assert.equal(navigation.getSnapshot(), 'pending')
  assert.equal(browser.sessionStorage.getItem('mesa-section'), 'pending')
  browser.history.forward()
  assert.equal(navigation.getSnapshot(), 'cafeteria')
  assert.equal(browser.history.length, 4)
  assert.deepEqual(visited, ['pending', 'cafeteria', 'suppliers', 'cafeteria', 'pending', 'cafeteria'])
  assert.equal(browser.sessionStorage.getItem('mesa-session-token'), 'existing-session')
  unsubscribe()
})

test('the active section does not duplicate history and a new navigation after Back replaces the forward branch', () => {
  const browser = createBrowser('/mesas')
  const navigation = createSectionNavigation(browser)
  const unsubscribe = navigation.subscribe(() => {})
  navigation.navigate('pending')
  navigation.navigate('pending')
  assert.equal(browser.history.length, 2)
  navigation.navigate('cafeteria')
  browser.history.back()
  navigation.navigate('settings')
  browser.history.forward()
  assert.equal(browser.location.pathname, '/configuracion')
  assert.equal(browser.history.length, 3)
  navigation.navigate('not-a-section')
  navigation.navigate('constructor')
  assert.equal(browser.location.pathname, '/configuracion')
  assert.equal(browser.history.length, 3)
  unsubscribe()
})

test('trailing slashes and unknown paths normalize without creating extra history entries', () => {
  const browser = createBrowser('/cafeteria/?date=2026-10-28#resumen', 'pending')
  const navigation = createSectionNavigation(browser)
  navigation.initialize()
  assert.equal(navigation.getSnapshot(), 'cafeteria')
  assert.equal(browser.location.pathname, '/cafeteria')
  assert.equal(browser.location.search, '?date=2026-10-28')
  assert.equal(browser.location.hash, '#resumen')
  assert.equal(browser.history.length, 1)
  const unknown = createBrowser('/no-existe', 'settings')
  createSectionNavigation(unknown).initialize()
  assert.equal(unknown.location.pathname, '/mesas')
  const invalidSaved = createBrowser('/', 'not-a-section')
  createSectionNavigation(invalidSaved).initialize()
  assert.equal(invalidSaved.location.pathname, '/mesas')
})

test('unsubscribed listeners stay detached after remounting while remaining subscribers keep receiving browser navigation', () => {
  const browser = createBrowser('/mesas')
  const navigation = createSectionNavigation(browser)
  const first = []
  const second = []
  const stopFirst = navigation.subscribe((section) => first.push(section))
  const stopSecond = navigation.subscribe((section) => second.push(section))
  navigation.navigate('pending')
  stopFirst()
  browser.history.back()
  assert.deepEqual(first, ['pending'])
  assert.deepEqual(second, ['pending', 'salon'])
  stopSecond()
  browser.history.forward()
  assert.deepEqual(second, ['pending', 'salon'])
  const remounted = []
  const stopRemounted = navigation.subscribe((section) => remounted.push(section))
  browser.history.back()
  assert.deepEqual(remounted, ['salon'])
  stopRemounted()
})

test('URL navigation and browser history still work when session storage is blocked', () => {
  const browser = createBrowser()
  browser.sessionStorage.getItem = () => { throw new Error('Storage blocked') }
  browser.sessionStorage.setItem = () => { throw new Error('Storage blocked') }
  const navigation = createSectionNavigation(browser)
  navigation.initialize()
  const unsubscribe = navigation.subscribe(() => {})
  navigation.navigate('cash-drops')
  assert.equal(browser.location.pathname, '/tiradas')
  browser.history.back()
  assert.equal(navigation.getSnapshot(), 'salon')
  assert.equal(browser.location.pathname, '/mesas')
  unsubscribe()
})
