import { useEffect, useRef } from 'react'
import { preciseMoney as money } from '../../../shared/utils/currency.js'
import { SkeletonRows } from '../../../shared/components/LoadingSkeleton.jsx'
import InventoryIcon from './InventoryIcon.jsx'

export default function InventoryDetails({ inventoryDetails, date, setInventoryDetails, loadingRanking, rankingError, monthlyRanking, lowStockProducts, outOfStockProducts, onRetry }) {
  const dialogRef = useRef(null)
  const isRanking = inventoryDetails === 'ranking'
  const stockProducts = inventoryDetails === 'low' ? lowStockProducts : outOfStockProducts
  useEffect(() => { dialogRef.current.showModal() }, [])
  return <dialog ref={dialogRef} className="inv-dialog inv-details" aria-labelledby="inv-details-title" onClose={() => setInventoryDetails(null)}><div className="inv-section-heading"><span className="inv-heading-icon"><InventoryIcon name={isRanking ? 'ranking' : 'box'} /></span><div><h2 id="inv-details-title">{isRanking ? 'Ranking de ventas' : inventoryDetails === 'low' ? 'Variedades con bajo stock' : 'Variedades agotadas'}</h2><p>{isRanking ? new Date(`${date}T12:00:00`).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' }) : 'Existencias del inventario actual'}</p></div><button type="button" autoFocus className="inv-icon-button" aria-label="Cerrar detalle" onClick={() => dialogRef.current.close()}><InventoryIcon name="close" /></button></div>
    {isRanking ? loadingRanking ? <SkeletonRows count={5} label="Cargando ranking mensual" /> : rankingError ? <div className="inv-empty" role="alert"><InventoryIcon name="info" /><h3>No se pudo consultar el ranking</h3><p>{rankingError}</p><button type="button" className="inv-secondary" onClick={onRetry}>Reintentar</button></div> : monthlyRanking.length ? <><p className="inv-footnote">Unidades vendidas según los cierres registrados en el mes.</p><ol className="inv-ranking-list">{monthlyRanking.map((item, index) => <li key={item.id}><span className={`inv-ranking-position${index === 0 ? ' first' : ''}`}>{index + 1}</span><b>{item.name}</b><strong>{item.quantity}<small>unidades</small></strong></li>)}</ol></> : <div className="inv-empty"><InventoryIcon name="ranking" /><h3>Sin ventas registradas</h3><p>El ranking se completa con las ventas de los cierres del mes.</p></div> : stockProducts.length ? <ul className="inv-ranking-list">{stockProducts.map((item) => <li key={item.id}><span><b>{item.name}</b><small>{money.format(item.price)} por unidad</small></span><strong>{item.stock}<small>unidades</small></strong></li>)}</ul> : <div className="inv-empty"><InventoryIcon name="check" /><h3>No hay variedades en esta categoría</h3></div>}
  </dialog>
}
