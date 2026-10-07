import { useEffect, useRef, useState } from 'react'
import Moveable from 'react-moveable'
import { clock } from '../../../shared/utils/date.js'

export default function FloorPlan({ tables, coworkingTableIds, editingMode, editingId, assignmentOrder, assigningTable, onSelect, onEdit, onAssign, saveTable }) {
  const [target, setTarget] = useState(null)
  const [now, setNow] = useState(() => Date.now())
  const origin = useRef({ x: 0, y: 0 })
  const clickTimer = useRef(null)
  const editing = tables.find((table) => table.id === editingId)
  const canvasWidth = Math.max(760, ...tables.map((table) => table.x + table.width + 60))
  const canvasHeight = Math.max(560, ...tables.map((table) => table.y + table.height + 60))

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => { clearInterval(timer); clearTimeout(clickTimer.current) }
  }, [])

  const selectTable = (event, table) => {
    event.stopPropagation()
    clearTimeout(clickTimer.current)
    if (assignmentOrder) {
      if (table.status === 'free' && !assigningTable) onAssign(table.id)
      return
    }
    clickTimer.current = setTimeout(() => (editingMode ? onEdit(table.id) : onSelect(table.id)), 220)
  }
  const begin = (set) => {
    origin.current = { x: editing?.x ?? 0, y: editing?.y ?? 0 }
    set?.([0, 0])
  }
  const move = (element, delta) => {
    element.style.left = `${origin.current.x + delta[0]}px`
    element.style.top = `${origin.current.y + delta[1]}px`
  }
  const finish = (width, height) => {
    if (!target || !editing) return
    saveTable(editing.id, {
      x: target.offsetLeft,
      y: target.offsetTop,
      ...(width ? { width: Math.round(width), height: Math.round(height) } : {}),
    })
  }

  return <div className={`floor ${assignmentOrder ? 'assignment-mode' : ''} ${editingMode ? 'editing-mode' : ''}`} aria-label="Plano desplazable de mesas">
    <div className="floor-canvas" style={{ minWidth: canvasWidth, minHeight: canvasHeight }} onClick={() => { if (!assignmentOrder) (editingMode ? onEdit : onSelect)(null) }}>
      <small className="floor-instructions">{assignmentOrder ? `ELEGÍ UNA MESA LIBRE PARA ${assignmentOrder.customerName.toUpperCase()}` : editingMode ? 'EDICIÓN · ELEGÍ UNA MESA PARA RENOMBRARLA, MOVERLA O ELIMINARLA' : 'SALÓN · TOCÁ UNA MESA PARA OPERAR · DESLIZÁ PARA RECORRER'}</small>
      {tables.map((table) => <button
        key={table.id}
        type="button"
        ref={table.id === editingId ? setTarget : null}
        className={`table ${table.status} ${coworkingTableIds.has(table.id) ? 'coworking-alert' : ''} ${table.id === editingId ? 'selected' : ''} ${assignmentOrder && table.status === 'free' ? 'assignment-target' : ''} ${assignmentOrder && table.status !== 'free' ? 'assignment-unavailable' : ''}`}
        style={{ left: table.x, top: table.y, width: table.width, height: table.height }}
        aria-disabled={Boolean(assignmentOrder && table.status !== 'free')}
        onClick={(event) => selectTable(event, table)}
      >
        <em>{table.status === 'occupied' ? '● OCUPADA' : '○ LIBRE'}</em>
        <b>{table.name}</b>
        {table.status === 'occupied' && table.customerName && <span className="table-customer">{table.customerName}</span>}
        {coworkingTableIds.has(table.id) && <span className="coworking-badge">⚠ SERVICIO COWORKING</span>}
        {table.status === 'occupied' && <div className="table-times"><span><small>SIN CONSUMIR</small><strong>{clock(table.lastConsumptionAt, now)}</strong></span></div>}
      </button>)}
      {editingId && target && <Moveable
        key={editingId} target={target} draggable resizable throttleDrag={0}
        onDragStart={({ set }) => begin(set)}
        onDrag={({ target: element, beforeTranslate }) => move(element, beforeTranslate)}
        onDragEnd={({ lastEvent }) => { if (lastEvent) finish() }}
        onResizeStart={({ dragStart }) => begin(dragStart?.set)}
        onResize={({ target: element, width, height, drag }) => { element.style.width = `${width}px`; element.style.height = `${height}px`; move(element, drag.beforeTranslate) }}
        onResizeEnd={({ lastEvent }) => { if (lastEvent) finish(lastEvent.width, lastEvent.height) }}
      />}
    </div>
  </div>
}
