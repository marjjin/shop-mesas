import { useEffect, useId, useRef, useState } from 'react'
import Moveable from 'react-moveable'
import { clock } from '../../../shared/utils/date.js'
import useNow from '../../../shared/hooks/useNow.js'
import { fitFloorToWidth, getFloorBounds } from '../domain/salonPresentation.js'
import SalonIcon from './SalonIcon.jsx'

export default function FloorPlan({ tables, visibleTableIds, coworkingTableIds, selectedId, editingMode, editingId, assignmentOrder, assigningTable, onSelect, onEdit, onAssign, saveTable }) {
  const [target, setTarget] = useState(null)
  const [zoom, setZoom] = useState('fit')
  const [viewportWidth, setViewportWidth] = useState(0)
  const viewportRef = useRef(null)
  const helpId = useId()
  const now = useNow()
  const origin = useRef({ x: 0, y: 0 })
  const clickTimer = useRef(null)
  const editing = tables.find((table) => table.id === editingId)
  const { width: canvasWidth, height: canvasHeight } = getFloorBounds(tables)
  const scale = editingMode ? 1 : zoom === 'fit' ? fitFloorToWidth(viewportWidth, canvasWidth) : zoom

  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => setViewportWidth(entry.contentRect.width))
    observer.observe(viewportRef.current)
    return () => observer.disconnect()
  }, [])
  useEffect(() => () => clearTimeout(clickTimer.current), [editingMode])

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

  return <div className="salon-map">
    <div ref={viewportRef} className={`floor ${assignmentOrder ? 'assignment-mode' : ''} ${editingMode ? 'editing-mode' : ''}`} role="region" tabIndex={0} aria-label="Plano desplazable de mesas" aria-describedby={helpId}>
      <div className="floor-stage" style={{ width: Math.ceil(canvasWidth * scale), height: Math.ceil(canvasHeight * scale) }}>
        <div className="floor-canvas" style={{ width: canvasWidth, height: canvasHeight, transform: `scale(${scale})` }} onClick={() => { if (!assignmentOrder) (editingMode ? onEdit : onSelect)(null) }}>
          {tables.map((table) => <button
            key={table.id}
            type="button"
            ref={table.id === editingId ? setTarget : null}
            className={`table ${table.status} ${coworkingTableIds.has(table.id) ? 'coworking-alert' : ''} ${table.id === (editingMode ? editingId : selectedId) ? 'selected' : ''} ${assignmentOrder && table.status === 'free' ? 'assignment-target' : ''} ${assignmentOrder && table.status !== 'free' ? 'assignment-unavailable' : ''} ${!visibleTableIds.has(table.id) ? 'table-dimmed' : ''}`}
            style={{ left: table.x, top: table.y, width: table.width, height: table.height }}
            data-compact={table.height < 120}
            disabled={!visibleTableIds.has(table.id) || Boolean(assignmentOrder && (table.status !== 'free' || assigningTable))}
            aria-label={`${table.name}, ${table.status === 'occupied' ? `ocupada${table.customerName ? ` por ${table.customerName}` : ''}` : 'libre'}${coworkingTableIds.has(table.id) ? ', servicio de coworking cargado' : ''}`}
            aria-pressed={table.id === (editingMode ? editingId : selectedId)}
            onClick={(event) => selectTable(event, table)}
          >
            <span className={`salon-table-state ${table.status}`}><i />{table.status === 'occupied' ? 'Ocupada' : 'Libre'}</span>
            <b className="salon-table-name">{table.name}</b>
            {table.status === 'occupied' && table.customerName && <span className="table-customer">{table.customerName}</span>}
            {coworkingTableIds.has(table.id) && <span className="coworking-badge"><SalonIcon name="alert" />Coworking</span>}
            {table.status === 'occupied' && <span className="salon-table-clock"><small>Sin consumir</small><strong><SalonIcon name="clock" />{clock(table.lastConsumptionAt, now)}</strong></span>}
          </button>)}
          {editingMode && editingId && target && <Moveable
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
    </div>
    <div className="salon-map-footer"><div className="salon-map-legend"><span><i className="free" />Libre</span><span><i className="occupied" />Ocupada</span><span><i className="coworking" />Coworking</span></div><div className="salon-zoom-controls"><button type="button" aria-label="Alejar plano" disabled={editingMode || scale <= .25} onClick={() => setZoom(Math.max(.25, Math.round((scale - .1) * 100) / 100))}><SalonIcon name="minus" /></button><span aria-label={`Zoom del plano: ${Math.round(scale * 100)} por ciento`}>{Math.round(scale * 100)}%</span><button type="button" aria-label="Acercar plano" disabled={editingMode || scale >= 1.5} onClick={() => setZoom(Math.min(1.5, Math.round((scale + .1) * 100) / 100))}><SalonIcon name="plus" /></button><button type="button" className="salon-fit-button" aria-label="Ajustar plano al ancho disponible" aria-pressed={zoom === 'fit' && !editingMode} disabled={editingMode} onClick={() => setZoom('fit')}><SalonIcon name="fit" />Ajustar</button></div></div>
    <p className="salon-map-help" id={helpId}><SalonIcon name={editingMode ? 'edit' : 'move'} />{editingMode ? 'Edición al 100%. Mové y redimensioná la mesa seleccionada; sus cambios se guardan automáticamente.' : 'Deslizá para recorrer el plano o ajustá el zoom. Los filtros resaltan las mesas que buscás.'}</p>
  </div>
}
