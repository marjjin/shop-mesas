import { shifts } from '../domain/businessDate.js'

export default function InventoryPurchases({
  shift,
  setShift,
  addPurchase,
  purchaseSearch,
  setPurchaseSearch,
  setPurchase,
  purchase,
  purchaseResults,
  busy,
  purchasedUnits,
  purchases,
  editingPurchase,
  savePurchase,
  selectedClose,
  setEditingPurchase,
  deletePurchase
}) {
  return <div className="cigarette-columns">
      <section className="cigarette-card accent-card"><small>REPOSICIÓN · TURNO {shifts[shift].toUpperCase()}</small><h2>Registrar compra</h2><div className="shift-switch">{Object.entries(shifts).map(([value, label]) => <button type="button" key={value} className={shift === value ? 'active' : ''} onClick={() => setShift(value)}>{label}</button>)}</div><form className="cigarette-form" onSubmit={addPurchase}><label>Producto<div className="cigarette-product-search"><span>⌕</span><input required autoComplete="off" placeholder="Buscar cigarrillo..." value={purchaseSearch} onChange={(event) => { setPurchaseSearch(event.target.value); setPurchase({ ...purchase, cigaretteProductId: '' }) }} />{purchase.cigaretteProductId && <button type="button" aria-label="Cambiar producto" title="Cambiar producto" onClick={() => { setPurchaseSearch(''); setPurchase({ ...purchase, cigaretteProductId: '' }) }}>×</button>}</div></label>{purchaseResults.length > 0 && <div className="cigarette-search-results">{purchaseResults.map((item) => <button type="button" key={item.id} onClick={() => { setPurchaseSearch(item.name); setPurchase({ ...purchase, cigaretteProductId: item.id }) }}><span>{item.name}</span><small>Stock actual: {item.stock}</small></button>)}</div>}{purchaseSearch.trim() && !purchase.cigaretteProductId && !purchaseResults.length && <p className="cigarette-search-empty">No se encontraron cigarrillos.</p>}<label className="purchase-quantity">Cantidad comprada<input required type="number" min="1" value={purchase.quantity} onChange={(event) => setPurchase({ ...purchase, quantity: event.target.value })} /></label><button className="primary wide" disabled={busy || !purchase.cigaretteProductId}>Registrar compra</button></form></section>
      <section className="cigarette-card"><div className="section-heading"><div><small>MOVIMIENTOS DEL DÍA</small><h2>Compras del turno</h2></div><b>{purchasedUnits} unidades</b></div><div className="purchase-list">{purchases.map((item) => editingPurchase?.id === item.id ? <form className="purchase-edit" key={item.id} onSubmit={savePurchase}><span><b>{item.productName}</b><small>Cantidad comprada{selectedClose ? ' · actualiza el cierre' : ''}</small></span><input required type="number" min="1" step="1" value={editingPurchase.quantity} onChange={(event) => setEditingPurchase({ ...editingPurchase, quantity: event.target.value })} /><button disabled={busy}>Guardar</button><button type="button" onClick={() => setEditingPurchase(null)}>Cancelar</button></form> : <article key={item.id}><span><b>{item.productName}</b><small>{selectedClose ? 'Compra incluida en el cierre' : 'Stock incorporado'}</small></span><strong>+{item.quantity} unidades</strong><footer><button type="button" disabled={busy} title="Editar cantidad" onClick={() => setEditingPurchase({ ...item })}>✎</button><button type="button" className="remove-purchase" disabled={busy} title="Quitar compra" onClick={() => deletePurchase(item)}>×</button></footer></article>)}{!purchases.length && <div className="cigarette-empty">No hay compras para este turno.</div>}</div></section>
    </div>
}
