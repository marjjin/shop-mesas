import { SkeletonBlock } from '../../../shared/components/LoadingSkeleton.jsx'
import { preciseMoney as money } from '../../../shared/utils/currency.js'
import InventoryIcon from './InventoryIcon.jsx'

export default function InventoryOverview({ products, inventoryValue, bestSeller, loadingRanking, rankingError, date, onRanking, onFilter, lowStockCount, outOfStockCount, disabled }) {
  const month = new Date(`${date}T12:00:00`).toLocaleDateString('es-AR', { month: 'long' })
  return <section className="inv-overview" aria-label="Resumen de inventario">
    <article className="inv-metric inv-value"><div className="inv-metric-label"><span className="inv-metric-icon green"><InventoryIcon name="stock" /></span><span>Valor del inventario</span></div><strong>{money.format(inventoryValue)}</strong><p>{products.length} variedades · {products.reduce((total, item) => total + item.stock, 0)} unidades</p><small>Valuado al precio de venta actual.</small></article>
    <article className="inv-metric inv-best"><div className="inv-metric-label"><span className="inv-metric-icon"><InventoryIcon name="ranking" /></span><span>Más vendido · {month}</span></div><b>{loadingRanking ? <SkeletonBlock className="skeleton-line" /> : rankingError ? 'Ranking no disponible' : bestSeller?.name || 'Sin ventas registradas'}</b><p>{loadingRanking ? <SkeletonBlock className="skeleton-line skeleton-short" /> : rankingError ? 'Volvé a consultar el detalle.' : bestSeller ? `${bestSeller.quantity} unidades en cierres del mes` : 'Según los cierres del mes.'}</p><button type="button" className="inv-text-button" disabled={disabled} onClick={onRanking}>Ver ranking<InventoryIcon name="arrow" /></button></article>
    <article className="inv-metric"><div className="inv-metric-label"><span className="inv-metric-icon warning"><InventoryIcon name="warning" /></span><span>Bajo stock</span></div><strong className="warning">{lowStockCount}</strong><p>Variedades con 1 a 5 unidades.</p><button type="button" className="inv-text-button" disabled={disabled} onClick={() => onFilter('low')}>Ver variedades<InventoryIcon name="arrow" /></button></article>
    <article className="inv-metric"><div className="inv-metric-label"><span className="inv-metric-icon danger"><InventoryIcon name="box" /></span><span>Sin stock</span></div><strong className="danger">{outOfStockCount}</strong><p>Variedades agotadas.</p><button type="button" className="inv-text-button" disabled={disabled} onClick={() => onFilter('out')}>Ver variedades<InventoryIcon name="arrow" /></button></article>
  </section>
}
