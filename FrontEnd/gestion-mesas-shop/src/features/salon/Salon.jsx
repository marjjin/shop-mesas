import { useRef, useState } from 'react'
import FloorPlan from './components/FloorPlan.jsx'
import TableEditor from './components/TableEditor.jsx'
import TableList from './components/TableList.jsx'
import SalonIcon from './components/SalonIcon.jsx'
import SalonToast from './components/SalonToast.jsx'
import { filterSalonTables, getSalonSummary } from './domain/salonPresentation.js'
import './styles/Salon.css'

export default function Salon({ data, message, onDismissMessage, salon, coffee }) {
  const { editingMode, setEditingMode, editingId, setEditingId, selectedId, setSelectedId, assigningPendingOrder, assigningTable,
    setAssigningPendingOrderId, coworkingTables, coworkingTableIds, saveTable, deleteTable, addTable, assignPendingOrderToTable } = salon
  const { sellingCoffee, registerCoffeeSale, coffeeSummary } = coffee
  const [view, setView] = useState(() => window.matchMedia('(max-width: 680px)').matches ? 'list' : 'map')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [addingTable, setAddingTable] = useState(false)
  const searchRef = useRef(null)
  const summary = getSalonSummary(data.tables)
  const activeView = editingMode ? 'map' : view
  const activeFilter = editingMode ? 'all' : assigningPendingOrder ? 'free' : filter
  const filteredTables = filterSalonTables(data.tables, { search: editingMode ? '' : search, status: activeFilter })
  const visibleTableIds = new Set(filteredTables.map((table) => table.id))
  const filters = [['all', 'Todas', summary.total], ['free', 'Libres', summary.free], ['occupied', 'Ocupadas', summary.occupied]]

  const selectTable = (id) => { setSelectedId(id); setEditingId(null) }
  const finishEditing = () => { setEditingMode(false); setEditingId(null) }
  const toggleEditing = () => {
    setEditingMode((value) => !value)
    setSelectedId(null)
    setEditingId(null)
    setSearch('')
    setFilter('all')
  }
  const createTable = async () => {
    if (addingTable) return
    setAddingTable(true)
    setEditingMode(true)
    try { await addTable() } finally { setAddingTable(false) }
  }
  const clearFilters = () => {
    setSearch('')
    setFilter('all')
    searchRef.current?.focus()
  }

  return <div className="salon-page">
    <header className="salon-header">
      <div><p className="eyebrow">OPERACIÓN EN VIVO</p><h1>Salón principal</h1><p>Todo tu salón de un vistazo. Seleccioná una mesa para atenderla.</p></div>
      <div className="salon-header-actions">
        <button type="button" className="salon-coffee-button" disabled={sellingCoffee} onClick={registerCoffeeSale} aria-label={`Registrar venta de cafetería. Ventas del turno: ${coffeeSummary.saleCount}`}><SalonIcon name="coffee" /><span>{sellingCoffee ? 'Registrando…' : 'Venta café'}<small>Ventas del turno</small></span><b>{coffeeSummary.saleCount}</b></button>
        <button type="button" className={`salon-edit-button${editingMode ? ' active' : ''}`} disabled={Boolean(assigningPendingOrder)} aria-pressed={editingMode} onClick={toggleEditing}><SalonIcon name={editingMode ? 'check' : 'edit'} />{editingMode ? 'Finalizar edición' : 'Editar plano'}</button>
      </div>
    </header>

    <section className="salon-overview" aria-label="Resumen de ocupación del salón">
      <div className="salon-metric"><span className="salon-metric-icon"><SalonIcon name="tables" /></span><div><span>Mesas del salón</span><strong>{summary.total}<small>en total</small></strong></div></div>
      <div className="salon-metric free"><span className="salon-metric-icon"><SalonIcon name="check" /></span><div><span>Libres</span><strong>{summary.free}<small>disponibles</small></strong></div></div>
      <div className="salon-metric occupied"><span className="salon-metric-icon"><SalonIcon name="users" /></span><div><span>Ocupadas</span><strong>{summary.occupied}<small>en servicio</small></strong></div></div>
      <div className="salon-occupancy"><div><span>Ocupación</span><strong>{summary.occupancy}%</strong></div><div className="salon-occupancy-track" role="meter" aria-label="Porcentaje de mesas ocupadas" aria-valuemin={0} aria-valuemax={100} aria-valuenow={summary.occupancy}><span style={{ width: `${summary.occupancy}%` }} /></div></div>
    </section>

    {assigningPendingOrder && <div className="salon-assignment-notice" role="status"><SalonIcon name="users" /><div><strong>Elegí una mesa para {assigningPendingOrder.customerName}</strong><span>Seleccioná una mesa libre para asignar el pedido e imprimir su ticket.</span></div><button type="button" disabled={assigningTable} onClick={() => setAssigningPendingOrderId(null)}>Cancelar asignación</button></div>}
    {coworkingTables.length > 0 && <div className="salon-coworking-notice" role="alert"><SalonIcon name="alert" /><div><strong>Revisá los servicios de coworking</strong><span>{coworkingTables.map((table) => table.name).join(', ')} {coworkingTables.length === 1 ? 'tiene' : 'tienen'} un servicio automático cargado.</span></div></div>}
    {message && <SalonToast key={message} message={message} onDismiss={onDismissMessage} />}
    {editingMode && <TableEditor key={editingId ?? 'none'} table={data.tables.find((table) => table.id === editingId)} saveTable={saveTable} deleteTable={deleteTable} addTable={createTable} addingTable={addingTable} finishEditing={finishEditing} />}

    <section className="salon-plan" aria-labelledby="salon-plan-title">
      <div className="salon-plan-heading"><div className="salon-plan-title"><span><SalonIcon name="tables" /></span><div><h2 id="salon-plan-title">{editingMode ? 'Diseñá tu salón' : 'Distribución de mesas'}</h2><p>{editingMode ? 'Elegí una mesa para moverla, redimensionarla o cambiar su nombre.' : assigningPendingOrder ? 'Las mesas libres están disponibles para asignar el pedido.' : 'Seleccioná una mesa para abrir su cuenta y cargar consumos.'}</p></div></div><div className="salon-view-switch" role="group" aria-label="Vista de mesas"><button type="button" aria-pressed={activeView === 'map'} disabled={editingMode} onClick={() => setView('map')}><SalonIcon name="tables" />Plano</button><button type="button" aria-pressed={activeView === 'list'} disabled={editingMode} onClick={() => setView('list')}><SalonIcon name="list" />Lista</button></div></div>

      <div className="salon-plan-toolbar"><div className="salon-search"><SalonIcon name="search" /><input ref={searchRef} type="search" aria-label="Buscar mesa o cliente" placeholder="Buscar mesa o cliente…" value={search} disabled={editingMode} onChange={(event) => setSearch(event.target.value)} />{search && <button type="button" aria-label="Limpiar búsqueda" onClick={() => { setSearch(''); searchRef.current?.focus() }}><SalonIcon name="close" /></button>}</div><div className="salon-filters" role="group" aria-label="Filtrar mesas por estado">{filters.map(([value, label, count]) => <button key={value} type="button" aria-pressed={activeFilter === value} disabled={editingMode || Boolean(assigningPendingOrder)} onClick={() => setFilter(value)}>{value !== 'all' && <i className={value} />}{label}<span>{count}</span></button>)}</div></div>

      {!data.tables.length ? <div className="salon-empty"><span><SalonIcon name="tables" /></span><h3>Tu salón empieza acá</h3><p>Agregá tu primera mesa y acomodala en el plano.</p><button type="button" disabled={addingTable} onClick={createTable}><SalonIcon name="plus" />{addingTable ? 'Agregando…' : 'Agregar primera mesa'}</button></div>
        : !filteredTables.length ? <div className="salon-empty"><span><SalonIcon name="search" /></span><h3>No hay mesas que coincidan</h3><p>{assigningPendingOrder && !summary.free ? 'Todas las mesas están ocupadas. Esperá a que se libere una para asignar el pedido.' : 'Probá con otro nombre o cambiá el filtro de estado.'}</p>{(!assigningPendingOrder || summary.free > 0) && <button type="button" onClick={clearFilters}>Limpiar filtros<SalonIcon name="arrow" /></button>}</div>
          : activeView === 'map' ? <FloorPlan tables={data.tables} visibleTableIds={visibleTableIds} coworkingTableIds={coworkingTableIds} selectedId={selectedId} editingMode={editingMode} editingId={editingId} assignmentOrder={assigningPendingOrder} assigningTable={assigningTable} onSelect={selectTable} onEdit={(id) => { setSelectedId(null); setEditingId(id) }} onAssign={assignPendingOrderToTable} saveTable={saveTable} />
            : <TableList tables={filteredTables} coworkingTableIds={coworkingTableIds} selectedId={selectedId} assignmentOrder={assigningPendingOrder} assigningTable={assigningTable} onSelect={selectTable} onAssign={assignPendingOrderToTable} />}

      <div className="salon-plan-caption"><span role="status">{filteredTables.length} de {summary.total} {summary.total === 1 ? 'mesa' : 'mesas'}{activeFilter !== 'all' || search ? ' coinciden' : ' en el salón'}</span><span><i />Actualización automática</span></div>
    </section>
  </div>
}
