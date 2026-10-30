import CigaretteCash from './cash/CigaretteCash.jsx'
import LoadingSkeleton from '../../shared/components/LoadingSkeleton.jsx'
import InventoryStock from './inventory/InventoryStock.jsx'
import InventoryPurchases from './inventory/InventoryPurchases.jsx'
import InventoryDetails from './inventory/InventoryDetails.jsx'
import './Cigarettes.css'
import './inventory/Inventory.css'
import InventoryOverview from './inventory/InventoryOverview.jsx'
import InventoryIcon from './inventory/InventoryIcon.jsx'
import { useEffect, useRef, useState } from 'react'
import useCigaretteDashboard from './hooks/useCigaretteDashboard.js'
import useCigaretteInventory from './hooks/useCigaretteInventory.js'
import { printCigaretteDailyReceipt } from '../printing/receipt.js'
import { money } from '../../shared/utils/currency.js'
import { shifts, localDateValue, previousDateValue, previousShift } from './domain/businessDate.js'
import { getCloseDraft, clearCloseDraft, getCloseContext, closeContextKey } from './domain/closeDrafts.js'
import { getCloseFinancialSummary } from './domain/closeFinancials.js'
import ShiftCloseForm from './closing/ShiftCloseForm.jsx'
import EditShiftCloseForm from './closing/EditShiftCloseForm.jsx'
import CloseCard from './closing/CloseCard.jsx'
import ClosedShiftSummary from './closing/ClosedShiftSummary.jsx'
import ClosingIcon from './closing/ClosingIcon.jsx'
import './closing/Closing.css'

const cigaretteTabs = new Set(['stock', 'purchases', 'cash', 'close', 'history'])
const inventoryTabs = [['stock', '▦', 'Stock y precios'], ['purchases', '↓', 'Compras'], ['cash', 'wallet', 'Caja']]
const closingTabs = [['close', '✓', 'Cerrar turno'], ['history', '◷', 'Calendario y cierres']]

export default function Cigarettes({ api, mode = 'inventory', onShiftClosed }) {
  const isClosingView = mode === 'shift-close'
  const availableTabs = isClosingView ? closingTabs : inventoryTabs
  const [tab, setTab] = useState(() => {
    const savedTab = sessionStorage.getItem('mesa-cigarette-tab')
    return cigaretteTabs.has(savedTab) && availableTabs.some(([value]) => value === savedTab)
      ? savedTab
      : availableTabs[0][0]
  })
  const [date, setDate] = useState(() => getCloseContext()?.date || localDateValue())
  const [shift, setShift] = useState(() => getCloseContext()?.shift || 'morning')

  const [supplierAllocations, setSupplierAllocations] = useState(() => getCloseDraft(date, shift)?.supplierAllocations || {})

  const [editingClose, setEditingClose] = useState(null)
  const [repairDate, setRepairDate] = useState('')
  const [repairShift, setRepairShift] = useState('afternoon')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const actionRef = useRef(false)

  const [closeWarning, setCloseWarning] = useState(null)
  const [closeConfirmation, setCloseConfirmation] = useState(null)
  const [inventoryDetails, setInventoryDetails] = useState(null)

  const { loading, dashboard, suppliers, cafeteriaSummary, cafeteriaError, previousChangeCash, monthlyRanking, loadingRanking, rankingError, load, loadMonthlyRanking } = useCigaretteDashboard({ api, date, shift, setMessage })
  const dailyShiftSalesTotal = dashboard.closes.reduce((total, close) => total + getCloseFinancialSummary(close, suppliers).shiftSales, 0)

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setTab(isClosingView ? 'close' : 'stock') }, [isClosingView])
  useEffect(() => { sessionStorage.setItem('mesa-cigarette-tab', tab) }, [tab])
  useEffect(() => { sessionStorage.setItem(closeContextKey, JSON.stringify({ date, shift })) }, [date, shift])
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setSupplierAllocations(getCloseDraft(date, shift)?.supplierAllocations || {}) }, [date, shift])

  const execute = async (operation, successMessage, reload = true) => {
    if (actionRef.current) return false
    actionRef.current = true
    setBusy(true)
    setMessage('')
    try {
      await operation()
      if (reload) await load()
      setMessage(successMessage)
      return true
    } catch (error) {
      setMessage(error.message || 'No se pudo completar la operación.')
      return false
    } finally { actionRef.current = false; setBusy(false) }
  }

  const {
    product,
    setProduct,
    purchase,
    setPurchase,
    stockSearch,
    setStockSearch,
    purchaseSearch,
    setPurchaseSearch,
    editing,
    setEditing,
    editingPurchase,
    setEditingPurchase,
    visibleProductCount,
    setVisibleProductCount,
    addProduct,
    saveProduct,
    deleteProduct,
    addPurchase,
    savePurchase,
    deletePurchase,
    purchases,
    purchasedUnits,
    purchaseResults,
    filteredProducts,
    visibleProducts,
    inventoryValue,
    lowStockProducts,
    outOfStockProducts,
    lowStockCount,
    outOfStockCount,
    stockFilter,
    setStockFilter,
    stockSort,
    setStockSort
  } = useCigaretteInventory({ api, execute, dashboard, date, shift })

  const saveShiftClose = async (request, sourceDraft = request) => {
    let close
    const saved = await execute(async () => { close = await api('/cigarettes/closes', { method: 'POST', body: JSON.stringify(request) }) }, 'Turno cerrado correctamente.')
    if (saved) {
      clearCloseDraft(sourceDraft.businessDate, sourceDraft.shift)
      clearCloseDraft(request.businessDate, request.shift)
      setDate(request.businessDate)
      setShift(request.shift)
      setSupplierAllocations({})
      setTab('history')
      onShiftClosed?.(close)
    }
  }
  const closeShift = async (request) => {
    const previous = previousShift(request.businessDate, request.shift)
    setMessage('Comprobando el turno anterior…')
    try {
      const previousDashboard = previous.businessDate === date ? dashboard : await api(`/cigarettes?date=${previous.businessDate}`)
      setMessage('')
      const previousIsClosed = previousDashboard.closes.some((close) => close.shift === previous.shift)
      if (!previousIsClosed) {
        setCloseWarning({ request, previous })
        return
      }
    } catch {
      setMessage('No se pudo comprobar si el turno anterior está cerrado. Intentá nuevamente.')
      return
    }
    setCloseConfirmation({ request })
  }
  const continueClosingShift = async () => {
    const request = closeWarning?.request
    setCloseWarning(null)
    if (request) setCloseConfirmation({ request })
  }
  const closeInPendingShift = async () => {
    if (!closeWarning) return
    const { request, previous } = closeWarning
    setCloseWarning(null)
    const correctedRequest = { ...request, businessDate: previous.businessDate, shift: previous.shift }
    setCloseConfirmation({ request: correctedRequest, sourceDraft: request })
  }
  const confirmShiftClose = async () => {
    if (!closeConfirmation || busy) return
    const { request, sourceDraft } = closeConfirmation
    setCloseConfirmation(null)
    await saveShiftClose(request, sourceDraft)
  }
  const saveCloseCorrection = async (request) => {
    const targetDate = request.businessDate || date
    const targetShift = request.shift || editingClose.shift
    const saved = await execute(() => api(`/cigarettes/closes/${editingClose.id}`, { method: 'PUT', body: JSON.stringify(request) }), 'Cierre corregido y stock actualizado.', targetDate === date)
    if (saved) {
      setEditingClose(null)
      setDate(targetDate)
      setShift(targetShift)
      setTab('history')
    }
  }
  const startEditingClose = (close) => {
    setShift(close.shift)
    setEditingClose(close)
    setTab('close')
  }
  const deleteClose = async (close) => {
    if (!window.confirm(`¿Eliminar el cierre ${shifts[close.shift]} del ${new Date(`${close.businessDate}T12:00:00`).toLocaleDateString('es-AR')}? Se reabrirá el turno, se restaurará el stock vendido y se liberarán las reservas de proveedores. Las ventas de cafetería y las tiradas se conservarán.`)) return
    const deleted = await execute(() => api(`/cigarettes/closes/${close.id}`, { method: 'DELETE' }), 'Cierre eliminado y turno reabierto.')
    if (deleted) {
      setEditingClose(null)
      setShift(close.shift)
      setTab('close')
    }
  }
  const consolidateClose = async () => {
    if (busy || !editingClose) return
    const source = editingClose
    const targetDate = repairDate || previousDateValue(source.businessDate)
    try {
      const targetDashboard = await api(`/cigarettes?date=${targetDate}`)
      const target = targetDashboard.closes.find((close) => close.shift === repairShift)
      if (!window.confirm(`¿Recuperar las ${source.totalSold} unidades vendidas por ${money.format(source.totalSales)} en el turno ${shifts[repairShift]} del ${targetDate}? La cafetería quedará en sus fechas actuales y el stock actual no cambiará. El turno ${shifts[source.shift]} del ${source.businessDate} quedará abierto. ${target ? 'Se consolidarán los dos cierres conservando la caja del destino.' : 'Se trasladará el cierre original conservando su caja e incorporando las tiradas del destino.'}`)) return
      let repaired
      const saved = await execute(async () => {
        repaired = await api(`/cigarettes/closes/${source.id}/consolidate`, { method: 'POST', body: JSON.stringify({ targetCloseId: target?.id ?? null, targetDate, targetShift: repairShift }) })
      }, 'Cierre reparado. El turno de origen quedó abierto; cafetería y stock conservados.')
      if (saved) {
        clearCloseDraft(source.businessDate, source.shift)
        clearCloseDraft(targetDate, repairShift)
        setEditingClose(null)
        setDate(targetDate)
        setShift(repairShift)
        setTab('history')
        onShiftClosed?.(repaired)
      }
    } catch (error) {
      setMessage(error.message || 'No se pudo comprobar el cierre de destino.')
    }
  }

  const selectedClose = dashboard.closes.find((close) => close.shift === shift)
  const cashDrops = dashboard.cashDrops.filter((drop) => drop.shift === shift && !drop.isClosed)

  const bestSeller = monthlyRanking[0]
  const showMonthlyRanking = () => {
    setInventoryDetails('ranking')
    if (rankingError) loadMonthlyRanking()
  }

  if (loading) return <LoadingSkeleton section={isClosingView ? 'shift-close' : 'cigarettes'} />

  return <div className={`cigarettes-page${isClosingView ? ' shift-closing-page' : ' cigarettes-inventory-page'}`}>
    <header className="cigarettes-header"><div><p className="eyebrow">{isClosingView ? 'ARQUEO Y REGISTRO' : 'CONTROL DE INVENTARIO'}</p><h1>{isClosingView ? 'Cierre de turno' : 'Cigarrillos'}</h1><p>{isClosingView ? 'Cerrá los turnos, consultá sus registros e imprimí los comprobantes.' : 'Consultá existencias, actualizá precios y registrá compras por turno.'}</p></div><label className="date-picker"><span>Fecha de trabajo</span><input type="date" disabled={busy} value={date} onChange={(event) => { if (event.target.value) { setEditingPurchase(null); setDate(event.target.value); setSupplierAllocations({}) } }} /></label></header>
    <nav className="cigarette-tabs" aria-label={isClosingView ? 'Secciones de cierre de turno' : 'Secciones de cigarrillos'}>
      {availableTabs.map(([value, icon, label]) => <button key={value} disabled={busy} className={tab === value ? 'active' : ''} aria-pressed={tab === value} onClick={() => setTab(value)}>{isClosingView ? <ClosingIcon name={icon === '✓' ? 'receipt' : 'calendar'} /> : <InventoryIcon name={value === 'stock' ? 'box' : value === 'cash' ? 'wallet' : 'purchase'} />}{label}</button>)}
    </nav>
    {!isClosingView && tab !== 'cash' && <InventoryOverview disabled={busy || Boolean(editing)} products={dashboard.products} inventoryValue={inventoryValue} bestSeller={bestSeller} loadingRanking={loadingRanking} rankingError={rankingError} date={date} onRanking={showMonthlyRanking} lowStockCount={lowStockCount} outOfStockCount={outOfStockCount} onFilter={(filter) => { setStockFilter(filter); setStockSearch(''); setVisibleProductCount(10); setEditing(null); setTab('stock') }} />}
    {message && <p role="status" className={message.includes('correctamente') || message.includes('actualizado') ? 'cigarette-message success' : 'cigarette-message'}>{message}</p>}
    {busy && <p role="status" className="cigarette-message processing">Procesando operación…</p>}
    {closeConfirmation && <div className="shift-warning-backdrop" role="presentation"><section className="shift-warning" role="dialog" aria-modal="true" aria-labelledby="close-confirmation-title"><button type="button" className="shift-alert-dismiss" aria-label="Cerrar confirmación" onClick={() => setCloseConfirmation(null)}>×</button><span className="shift-warning-icon">✓</span><div><h2 id="close-confirmation-title">Confirmar cierre de turno</h2><p>Se cerrará el turno <b>{shifts[closeConfirmation.request.shift].toLowerCase()}</b> del <b>{new Date(`${closeConfirmation.request.businessDate}T12:00:00`).toLocaleDateString('es-AR')}</b> con los stocks y los importes que cargaste.</p></div><footer><button type="button" className="secondary" onClick={() => setCloseConfirmation(null)}>Seguir revisando</button><button type="button" className="primary" disabled={busy} onClick={confirmShiftClose}>Confirmar cierre</button></footer></section></div>}
    {inventoryDetails && <InventoryDetails inventoryDetails={inventoryDetails} date={date} setInventoryDetails={setInventoryDetails} loadingRanking={loadingRanking} rankingError={rankingError} monthlyRanking={monthlyRanking} lowStockProducts={lowStockProducts} outOfStockProducts={outOfStockProducts} onRetry={loadMonthlyRanking} />}
    {closeWarning && <div className="shift-warning-backdrop" role="presentation"><section className="shift-warning" role="dialog" aria-modal="true" aria-labelledby="shift-warning-title"><button type="button" className="shift-alert-dismiss" aria-label="Cerrar aviso de turno pendiente" onClick={() => setCloseWarning(null)}>×</button><span className="shift-warning-icon">!</span><div><small>REVISÁ LA SECUENCIA DE CIERRES</small><h2 id="shift-warning-title">Hay un turno pendiente</h2><p>Antes de cerrar <b>{shifts[closeWarning.request.shift].toLowerCase()} del {new Date(`${closeWarning.request.businessDate}T12:00:00`).toLocaleDateString('es-AR')}</b>, falta cerrar <b>{shifts[closeWarning.previous.shift].toLowerCase()} del {new Date(`${closeWarning.previous.businessDate}T12:00:00`).toLocaleDateString('es-AR')}</b>.</p><p className="shift-warning-note">Podés cerrar ese turno ahora usando los stocks que ya cargaste; no tendrás que ingresarlos otra vez.</p></div><footer><button type="button" className="secondary" onClick={continueClosingShift}>Cerrar en el turno elegido</button><button type="button" className="primary" onClick={closeInPendingShift}>Cerrar en el turno correcto</button></footer></section></div>}

    {tab === 'close' && editingClose && <section className="cigarette-card close-repair-section"><h2>Reparar o reasignar cierre</h2><p>Elegí dónde corresponde este cierre. La cafetería permanece en su fecha y turno, el stock actual no cambia y el turno de origen queda abierto. Si el destino ya está cerrado, solo se permite unirlo cuando no tiene ventas y sus inventarios coinciden.</p><div className="close-date-edit"><label>Fecha de destino<input type="date" required value={repairDate || previousDateValue(editingClose.businessDate)} onChange={(event) => setRepairDate(event.target.value)} /></label><label>Turno de destino<select value={repairShift} onChange={(event) => setRepairShift(event.target.value)}><option value="morning">Mañana</option><option value="afternoon">Tarde</option></select></label></div><button className="primary" type="button" disabled={busy} onClick={consolidateClose}>Reparar en el turno elegido</button></section>}

    {tab === 'stock' && <InventoryStock dashboard={dashboard} stockSearch={stockSearch} setStockSearch={setStockSearch} setVisibleProductCount={setVisibleProductCount} visibleProducts={visibleProducts} editing={editing} saveProduct={saveProduct} setEditing={setEditing} busy={busy} deleteProduct={deleteProduct} filteredProducts={filteredProducts} visibleProductCount={visibleProductCount} addProduct={addProduct} product={product} setProduct={setProduct} stockFilter={stockFilter} setStockFilter={setStockFilter} stockSort={stockSort} setStockSort={setStockSort} message={message} />}

    {tab === 'cash' && <CigaretteCash key={date} api={api} date={date} />}

    {tab === 'purchases' && <InventoryPurchases shift={shift} setShift={setShift} addPurchase={addPurchase} purchaseSearch={purchaseSearch} setPurchaseSearch={setPurchaseSearch} setPurchase={setPurchase} purchase={purchase} purchaseResults={purchaseResults} busy={busy} purchasedUnits={purchasedUnits} purchases={purchases} editingPurchase={editingPurchase} savePurchase={savePurchase} selectedClose={selectedClose} setEditingPurchase={setEditingPurchase} deletePurchase={deletePurchase} message={message} date={date} />}

    {tab === 'close' && <><section className="cigarette-card close-section"><div className="section-heading"><span className="closing-block-icon"><ClosingIcon name="receipt" /></span><div><small>ARQUEO Y CIERRE DE CAJA</small><h2>{editingClose ? 'Corregir cierre' : 'Cierre de turno'}</h2></div><div className="shift-switch">{Object.entries(shifts).map(([value, label]) => <button key={value} className={shift === value ? 'active' : ''} onClick={() => { setShift(value); setSupplierAllocations({}); setEditingClose(null) }}>{label}</button>)}</div></div><p className="close-help">{editingClose ? 'Corregí el stock físico final. Las ventas y el stock actual se ajustarán automáticamente.' : selectedClose ? 'Consultá los importes registrados al finalizar el turno o corregí el cierre si hace falta.' : 'Registrá los saldos de caja, las reservas para proveedores y el stock final para completar el cierre.'}</p>{editingClose && selectedClose?.id === editingClose.id ? <EditShiftCloseForm key={editingClose.id} close={editingClose} suppliers={suppliers} cafeteria={editingClose.cafeteria} cashDrops={editingClose.cashDrops || []} onSave={saveCloseCorrection} onCancel={() => setEditingClose(null)} busy={busy} /> : selectedClose ? <ClosedShiftSummary close={selectedClose} suppliers={suppliers} onEdit={setEditingClose} /> : <ShiftCloseForm key={`${date}-${shift}-${dashboard.products.map((item) => item.stock).join('-')}`} products={dashboard.products} purchases={dashboard.purchases} cashDrops={cashDrops} suppliers={suppliers} allocations={supplierAllocations} onAllocationsChange={setSupplierAllocations} cafeteriaSummary={cafeteriaSummary} cafeteriaError={cafeteriaError} shift={shift} date={date} previousChangeCash={previousChangeCash} onClose={closeShift} />}</section></>}

    {tab === 'history' && <section className="cigarette-card history-section"><div className="calendar-hero"><div className="closing-calendar-title"><span className="closing-block-icon"><ClosingIcon name="calendar" /></span><div><small>CALENDARIO</small><h2>Cierres del {new Date(`${date}T12:00:00`).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })}</h2><p>{dashboard.closes.length} {dashboard.closes.length === 1 ? 'turno cerrado' : 'turnos cerrados'}. Tocá un turno para ver Caja, Arqueo de caja y el detalle de la venta.</p></div></div><div className="daily-total"><small>VENTAS DEL DÍA</small><b>{money.format(dailyShiftSalesTotal)}</b><span>Suma de las ventas por turno</span><button type="button" onClick={() => printCigaretteDailyReceipt(dashboard.closes, suppliers, date)} disabled={!dashboard.closes.length}><ClosingIcon name="print" />Imprimir resumen</button></div></div><div className="closes-list">{dashboard.closes.map((close) => <CloseCard key={close.id} close={close} suppliers={suppliers} onEdit={startEditingClose} onDelete={deleteClose} />)}{!dashboard.closes.length && <div className="cigarette-empty large">No hay cierres registrados en esta fecha.</div>}</div></section>}
  </div>
}
