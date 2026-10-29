import { useEffect, useRef, useState } from 'react'
import { shifts } from '../domain/businessDate.js'
import InventoryIcon from './InventoryIcon.jsx'
import InventoryConfirm from './InventoryConfirm.jsx'

export default function InventoryPurchases({ shift, setShift, addPurchase, purchaseSearch, setPurchaseSearch, setPurchase,
  purchase, purchaseResults, busy, purchasedUnits, purchases, editingPurchase, savePurchase, selectedClose,
  setEditingPurchase, deletePurchase, message, date }) {
  const [removing, setRemoving] = useState(null)
  const [removeFailed, setRemoveFailed] = useState(false)
  const [resultIndex, setResultIndex] = useState(0)
  const [searchOpen, setSearchOpen] = useState(false)
  const searchRef = useRef(null)
  const quantityRef = useRef(null)
  const editRef = useRef(null)
  const resultRefs = useRef([])
  const editingId = editingPurchase?.id
  const selectedIndex = Math.min(resultIndex, Math.max(0, purchaseResults.length - 1))
  const showResults = searchOpen && Boolean(purchaseSearch.trim()) && !purchase.cigaretteProductId
  const validQuantity = purchase.quantity !== '' && Number.isInteger(Number(purchase.quantity)) && Number(purchase.quantity) > 0
  const chooseProduct = (item) => {
    setPurchaseSearch(item.name)
    setPurchase({ ...purchase, cigaretteProductId: item.id })
    setSearchOpen(false)
    quantityRef.current?.focus()
  }
  useEffect(() => { if (editingId != null) editRef.current?.focus() }, [editingId])
  useEffect(() => { if (showResults) resultRefs.current[selectedIndex]?.scrollIntoView({ block: 'nearest' }) }, [selectedIndex, showResults])
  const submitPurchase = async (event) => {
    if (await addPurchase(event)) requestAnimationFrame(() => searchRef.current?.focus())
  }
  const confirmRemoval = async () => {
    if (busy) return
    setRemoveFailed(false)
    if (await deletePurchase(removing)) setRemoving(null)
    else setRemoveFailed(true)
  }
  const handleSearchKey = (event) => {
    if (event.key === 'Escape') { setSearchOpen(false); event.preventDefault(); return }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      setSearchOpen(true)
      setResultIndex(Math.max(0, Math.min(selectedIndex + (event.key === 'ArrowDown' ? 1 : -1), purchaseResults.length - 1)))
    }
    if (event.key === 'Enter' && !purchase.cigaretteProductId) {
      event.preventDefault()
      if (showResults && purchaseResults[selectedIndex]) chooseProduct(purchaseResults[selectedIndex])
      else setSearchOpen(true)
    }
  }

  return <div className="inv-workspace inv-purchases-layout">
    <section className="inv-card inv-purchase-form" aria-labelledby="inv-purchase-heading"><div className="inv-section-heading"><span className="inv-heading-icon accent"><InventoryIcon name="purchase" /></span><div><h2 id="inv-purchase-heading">Registrar compra</h2><p>Ingresá unidades al inventario.</p></div></div><div className="inv-shift-switch" role="group" aria-label="Turno de la compra">{Object.entries(shifts).map(([value, label]) => <button type="button" key={value} disabled={busy || Boolean(editingPurchase)} aria-pressed={shift === value} onClick={() => setShift(value)}>{label}</button>)}</div><p className="inv-date-note">{new Date(`${date}T12:00:00`).toLocaleDateString('es-AR')} · Turno {shifts[shift].toLowerCase()}</p>
      {selectedClose && <p className="inv-notice"><InventoryIcon name="info" />Este turno está cerrado. La compra actualizará también el cierre.</p>}
      <form className="inv-form" onSubmit={submitPurchase} aria-busy={busy}><label htmlFor="inv-purchase-product">Variedad</label><div className="inv-purchase-search" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setSearchOpen(false) }}><div className="inv-search"><InventoryIcon name={purchase.cigaretteProductId ? 'check' : 'search'} /><input ref={searchRef} id="inv-purchase-product" required autoComplete="off" role="combobox" aria-expanded={showResults} aria-controls="inv-purchase-results" aria-autocomplete="list" aria-activedescendant={showResults && purchaseResults.length ? `inv-purchase-option-${purchaseResults[selectedIndex].id}` : undefined} placeholder="Buscar marca o presentación…" value={purchaseSearch} disabled={busy} onFocus={() => setSearchOpen(true)} onKeyDown={handleSearchKey} onChange={(event) => { setPurchaseSearch(event.target.value); setPurchase({ ...purchase, cigaretteProductId: '' }); setResultIndex(0); setSearchOpen(true) }} />{purchaseSearch && <button type="button" className="inv-clear" aria-label="Limpiar variedad seleccionada" disabled={busy} onClick={() => { setPurchaseSearch(''); setPurchase({ ...purchase, cigaretteProductId: '' }); searchRef.current?.focus() }}><InventoryIcon name="close" /></button>}</div>
        {showResults && <div className="inv-purchase-results" id="inv-purchase-results" role="listbox" aria-label="Variedades disponibles">{purchaseResults.length ? purchaseResults.map((item, index) => <button type="button" key={item.id} id={`inv-purchase-option-${item.id}`} ref={(element) => { resultRefs.current[index] = element }} role="option" tabIndex={-1} aria-selected={index === selectedIndex} disabled={busy} onMouseDown={(event) => event.preventDefault()} onMouseEnter={() => setResultIndex(index)} onClick={() => chooseProduct(item)}><b>{item.name}</b><span>Stock: {item.stock}</span></button>) : <p>No hay variedades con ese nombre.</p>}</div>}
      </div><label htmlFor="inv-purchase-quantity">Cantidad comprada</label><input ref={quantityRef} id="inv-purchase-quantity" required type="number" min="1" step="1" inputMode="numeric" placeholder="Cantidad de unidades" value={purchase.quantity} disabled={busy} onChange={(event) => setPurchase({ ...purchase, quantity: event.target.value })} /><button className="inv-primary inv-full" disabled={busy || !purchase.cigaretteProductId || !validQuantity}><InventoryIcon name="plus" />{busy ? 'Guardando…' : 'Registrar compra'}</button></form>
      <p className="inv-footnote"><InventoryIcon name="info" />La cantidad ingresada se suma al stock de la variedad seleccionada.</p>
    </section>
    <section className="inv-card inv-purchase-history" aria-labelledby="inv-purchases-heading"><div className="inv-section-heading"><span className="inv-heading-icon"><InventoryIcon name="purchase" /></span><div><h2 id="inv-purchases-heading">Compras del turno</h2><p>{shifts[shift]} · {purchases.length} {purchases.length === 1 ? 'movimiento' : 'movimientos'}</p></div><span className="inv-count">{purchasedUnits} unidades</span></div><ul className="inv-purchase-list">{purchases.map((item) => editingPurchase?.id === item.id ? <li key={item.id}><form className="inv-edit" onSubmit={savePurchase} aria-label={`Editar compra de ${item.productName}`}><h3>{item.productName}</h3><label>Cantidad comprada<input ref={editRef} required type="number" min="1" step="1" inputMode="numeric" value={editingPurchase.quantity} disabled={busy} onChange={(event) => setEditingPurchase({ ...editingPurchase, quantity: event.target.value })} /></label>{selectedClose && <p className="inv-footnote">La modificación recalculará el cierre del turno.</p>}<div className="inv-edit-actions"><button type="button" className="inv-secondary" disabled={busy} onClick={() => setEditingPurchase(null)}>Cancelar</button><button className="inv-primary" disabled={busy || !Number.isInteger(Number(editingPurchase.quantity)) || Number(editingPurchase.quantity) < 1}>{busy ? 'Guardando…' : 'Guardar cambios'}</button></div></form></li> : <li className="inv-purchase-row" key={item.id}><span className="inv-product-icon"><InventoryIcon name="purchase" /></span><div><b>{item.productName}</b><small>{selectedClose ? 'Incluida en el cierre' : 'Stock incorporado'}</small></div><strong>+{item.quantity}<small>unidades</small></strong><div className="inv-row-actions"><button type="button" className="inv-icon-button" disabled={busy || Boolean(editingPurchase)} aria-label={`Editar compra de ${item.productName}`} title="Editar cantidad" onClick={() => setEditingPurchase({ ...item })}><InventoryIcon name="edit" /></button><button type="button" className="inv-icon-button danger" disabled={busy || Boolean(editingPurchase)} aria-label={`Quitar compra de ${item.productName}`} title="Quitar compra" onClick={() => { setRemoveFailed(false); setRemoving(item) }}><InventoryIcon name="trash" /></button></div></li>)}</ul>{!purchases.length && <div className="inv-empty"><InventoryIcon name="purchase" /><h3>Sin compras en este turno</h3><p>Los ingresos de mercadería aparecerán aquí cuando los registres.</p></div>}</section>
    {removing && <InventoryConfirm title="¿Quitar esta compra?" busy={busy} error={removeFailed ? message : ''} onDismiss={() => setRemoving(null)} onConfirm={confirmRemoval}>Se quitará la compra de <b>{removing.quantity} unidades de {removing.productName}</b>. El stock se descontará{selectedClose ? ' y se recalculará el cierre de este turno' : ''}.</InventoryConfirm>}
  </div>
}
