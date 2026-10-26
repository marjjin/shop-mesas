import FloorPlan from './components/FloorPlan.jsx'
import TableEditor from './components/TableEditor.jsx'

export default function Salon({ data, message, salon, coffee }) {
  const { editingMode, setEditingMode, editingId, setEditingId, setSelectedId, assigningPendingOrder, assigningTable,
    setAssigningPendingOrderId, coworkingTables, coworkingTableIds, saveTable, deleteTable, addTable, assignPendingOrderToTable } = salon
  const { sellingCoffee, registerCoffeeSale, coffeeSummary } = coffee
  return <>
        <header><div><p className="eyebrow">OPERACIÓN EN VIVO</p><h1>Salón principal</h1><p>{editingMode ? 'Seleccioná una mesa para cambiar su nombre, moverla, redimensionarla o eliminarla.' : 'Un clic abre el menú. Usá Editar para modificar las mesas.'}</p></div><div className="salon-actions"><button type="button" className="coffee-sales-button" disabled={sellingCoffee} onClick={registerCoffeeSale} aria-label={`Registrar venta de cafetería. Total de hoy: ${coffeeSummary.saleCount}`}><span>☕ {sellingCoffee ? 'REGISTRANDO…' : 'VENTA CAFÉ'}</span><b>{coffeeSummary.saleCount}</b></button><button type="button" className={editingMode ? 'edit-mode-button active' : 'primary'} onClick={() => { setEditingMode((value) => !value); setSelectedId(null); setEditingId(null) }}>{editingMode ? '✓ Listo' : '✎ Editar'}</button></div></header>
        {assigningPendingOrder && <div className="table-assignment-notice" role="status"><div><strong>Elegí una mesa para {assigningPendingOrder.customerName}</strong><span>Las mesas libres están resaltadas en verde. Al elegir una se abrirá y se imprimirá el ticket.</span></div><button type="button" disabled={assigningTable} onClick={() => setAssigningPendingOrderId(null)}>Cancelar</button></div>}
        {coworkingTables.length > 0 && <div className="coworking-notice" role="alert"><strong>⚠ Alerta de coworking</strong><span>{coworkingTables.map((table) => table.name).join(', ')} {coworkingTables.length === 1 ? 'tiene' : 'tienen'} un servicio de coworking cargado.</span></div>}
        {message && <p className="error">{message}</p>}
        {editingMode && <TableEditor key={editingId ?? 'none'} table={data.tables.find((table) => table.id === editingId)} saveTable={saveTable} deleteTable={deleteTable} addTable={addTable} finishEditing={() => { setEditingMode(false); setEditingId(null) }} />}
        <FloorPlan tables={data.tables} coworkingTableIds={coworkingTableIds} editingMode={editingMode} editingId={editingId} assignmentOrder={assigningPendingOrder} assigningTable={assigningTable} onSelect={(id) => { setSelectedId(id); setEditingId(null) }} onEdit={(id) => { setSelectedId(null); setEditingId(id) }} onAssign={assignPendingOrderToTable} saveTable={saveTable} />

  </>
}
