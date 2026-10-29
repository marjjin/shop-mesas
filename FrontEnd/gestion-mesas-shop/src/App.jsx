import { useEffect, useState } from 'react'
import Catalog from './features/catalog/Catalog.jsx'
import Cafeteria from './features/cafeteria/Cafeteria.jsx'
import Cigarettes from './features/cigarettes/Cigarettes.jsx'
import History from './features/history/History.jsx'
import PendingOrders from './features/pending-orders/PendingOrders.jsx'
import Suppliers from './features/suppliers/Suppliers.jsx'
import CashDrops from './features/cash-drops/CashDrops.jsx'
import Settings from './features/settings/Settings.jsx'
import { api } from './shared/api/client.js'
import useTheme from './shared/hooks/useTheme.js'
import useNow from './shared/hooks/useNow.js'
import useSession from './features/auth/useSession.js'
import useNavigation from './features/layout/useNavigation.js'
import useRestaurantData from './app/useRestaurantData.js'
import useQuickCoffeeSale from './features/cafeteria/useQuickCoffeeSale.js'
import useWelcomeSettings from './features/settings/hooks/useWelcomeSettings.js'
import useSalon from './features/salon/hooks/useSalon.js'
import LoginForm from './features/auth/LoginForm.jsx'
import Sidebar from './features/layout/Sidebar.jsx'
import Salon from './features/salon/Salon.jsx'
import TableMenu from './features/salon/components/TableMenu.jsx'
import LoadingSkeleton, { SessionSkeleton } from './shared/components/LoadingSkeleton.jsx'
import './styles/base.css'
import './features/salon/styles/Panel.css'
import './features/layout/Navigation.css'
import './features/salon/styles/FloorPlan.css'
import './features/cafeteria/CoffeeSales.css'
import './styles/Theme.css'

export default function App() {
  const { preference, resolvedTheme, changeTheme } = useTheme()
  const [message, setMessage] = useState('')
  const session = useSession(api, setMessage)
  const { user, login, setLogin, loginSubmit } = session
  const { section, setSection, subscribeToSectionChanges } = useNavigation()
  const { data, setData, histories, load, loadHistory, loading, loadingHistory, dataError, historyError } = useRestaurantData(api, user, section, setMessage)
  const coffee = useQuickCoffeeSale(api, user, setMessage)
  const { setCoffeeSummary, loadCoffeeSummary } = coffee
  const { welcomeSettings, welcomeSettingsError, updateWelcomeSettings } = useWelcomeSettings(api, user, section)
  const salon = useSalon({ api, data, setData, load, loadHistory, setMessage, setSection })
  const { selected, orders, setSelectedId, chooseTableForPendingOrder, closeTable, updateOpenedAt, changeSection: changeSalonSection } = salon
  const now = useNow()

  useEffect(() => subscribeToSectionChanges((nextSection) => {
    changeSalonSection(nextSection)
    if (user && nextSection === 'salon') loadCoffeeSummary().catch(() => {})
  }), [subscribeToSectionChanges, changeSalonSection, user, loadCoffeeSummary])
  const signOut = async () => { if (await session.signOut()) salon.reset() }

  if (session.restoring) return <SessionSkeleton section={section} />

  if (!user) return <LoginForm login={login} error={message} onLoginChange={setLogin} onSubmit={loginSubmit} resolvedTheme={resolvedTheme} onThemeChange={changeTheme} busy={session.busy} restoring={session.restoring} />

  const sectionLoading = section === 'history' ? loadingHistory : ['salon', 'pending', 'catalog'].includes(section) && loading
  const sectionError = section === 'history' ? historyError : ['pending', 'catalog'].includes(section) ? dataError : ''

  return <main className="layout">
    <Sidebar user={user} section={section} pendingOrdersCount={data.pendingOrders?.length} onSectionChange={setSection} onSignOut={signOut} resolvedTheme={resolvedTheme} onThemeChange={changeTheme} />
    <section className="page">
      {sectionLoading ? <LoadingSkeleton section={section} /> : <>
        {sectionError && <p className="error" role="alert">{sectionError} <button type="button" onClick={section === 'history' ? loadHistory : load}>Reintentar</button></p>}
        {section === 'salon' ? <Salon data={data} message={message} salon={salon} coffee={coffee} /> : section === 'pending' ? <PendingOrders data={data} api={api} load={load} onChooseTable={chooseTableForPendingOrder} /> : section === 'catalog' ? <Catalog data={data} api={api} load={load} /> : section === 'cafeteria' ? <Cafeteria api={api} onSummaryChange={setCoffeeSummary} /> : section === 'cigarettes' ? <Cigarettes api={api} /> : section === 'suppliers' ? <Suppliers api={api} /> : section === 'cash-drops' ? <CashDrops api={api} /> : section === 'shift-close' ? <Cigarettes api={api} mode="shift-close" onShiftClosed={(close) => { setCoffeeSummary({ saleCount: 0, totalSales: 0 }); loadCoffeeSummary(close.businessDate).catch(() => {}) }} /> : section === 'history' ? <History histories={histories} /> : null}
        {section === 'settings' && <Settings api={api} welcomeSettings={welcomeSettings} loadError={welcomeSettingsError} onWelcomeSettingsChange={updateWelcomeSettings} themePreference={preference} resolvedTheme={resolvedTheme} onThemeChange={changeTheme} />}
      </>}
    </section>
    {selected && <TableMenu key={selected.id} table={selected} data={data} orders={orders} now={now} api={api} load={load} closePanel={() => setSelectedId(null)} closeTable={closeTable} updateOpenedAt={updateOpenedAt} />}
  </main>
}
