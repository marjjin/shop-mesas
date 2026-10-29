import useNow from '../../../shared/hooks/useNow.js'
import { clock } from '../../../shared/utils/date.js'
import SalonIcon from './SalonIcon.jsx'

export default function TableList({ tables, coworkingTableIds, selectedId, assignmentOrder, assigningTable, onSelect, onAssign }) {
  const now = useNow()
  return <ul className="salon-table-list" aria-label="Lista de mesas del salón">{tables.map((table) => {
    const occupied = table.status === 'occupied'
    const alert = coworkingTableIds.has(table.id)
    const unavailable = Boolean(assignmentOrder && (occupied || assigningTable))
    return <li key={table.id}><button type="button" className={`salon-table-row ${table.status}${alert ? ' has-alert' : ''}${table.id === selectedId ? ' is-selected' : ''}`} disabled={unavailable} aria-pressed={table.id === selectedId} onClick={() => assignmentOrder ? onAssign(table.id) : onSelect(table.id)}>
      <span className="salon-list-table-icon"><SalonIcon name="tables" /></span>
      <span className="salon-list-table-name"><strong>{table.name}</strong>{occupied && <small>{table.customerName || 'Servicio en curso'}</small>}{alert && <span className="salon-list-alert"><SalonIcon name="alert" />Servicio de coworking cargado</span>}</span>
      <span className={`salon-table-state ${table.status}`}><i />{occupied ? 'Ocupada' : 'Libre'}</span>
      {occupied && <span className="salon-list-table-time"><SalonIcon name="clock" /><span><small>Sin consumir</small><b>{clock(table.lastConsumptionAt, now)}</b></span></span>}
      <span className="salon-list-table-arrow"><SalonIcon name="arrow" /></span>
    </button></li>
  })}</ul>
}
