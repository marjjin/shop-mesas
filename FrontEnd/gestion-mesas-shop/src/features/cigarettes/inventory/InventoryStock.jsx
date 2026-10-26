import { money } from '../../../shared/utils/currency.js'

export default function InventoryStock({
  dashboard,
  stockSearch,
  setStockSearch,
  setVisibleProductCount,
  visibleProducts,
  editing,
  saveProduct,
  setEditing,
  busy,
  deleteProduct,
  filteredProducts,
  visibleProductCount,
  addProduct,
  product,
  setProduct
}) {
  return <div className="cigarette-columns">
      <section className="cigarette-card"><div className="section-heading"><div><small>INVENTARIO ACTUAL</small><h2>Productos cargados</h2></div><span>{dashboard.products.length} variedades</span></div>
        <div className="cigarette-product-search stock-search"><span>⌕</span><input type="search" autoComplete="off" aria-label="Buscar en productos cargados" placeholder="Buscar cigarrillo..." value={stockSearch} onChange={(event) => { setStockSearch(event.target.value); setVisibleProductCount(10) }} />{stockSearch && <button type="button" aria-label="Limpiar búsqueda" title="Limpiar búsqueda" onClick={() => { setStockSearch(''); setVisibleProductCount(10) }}>×</button>}</div>
        <div className="stock-list">{visibleProducts.map((item) => editing?.id === item.id ? <form className="stock-edit" key={item.id} onSubmit={saveProduct}><input required aria-label="Nombre" maxLength="100" value={editing.name} onChange={(event) => setEditing({ ...editing, name: event.target.value })} /><input required aria-label="Precio de venta" type="number" min="0.01" step="0.01" value={editing.price} onChange={(event) => setEditing({ ...editing, price: event.target.value })} /><input required aria-label="Stock actual" type="number" min="0" step="1" value={editing.stock} onChange={(event) => setEditing({ ...editing, stock: event.target.value })} /><button disabled={busy}>Guardar</button><button type="button" onClick={() => setEditing(null)}>Cancelar</button></form> : <article className="stock-item" key={item.id}><div className="cigarette-pack">▥</div><span><b>{item.name}</b><small>{money.format(item.price)} por unidad</small></span><strong className={item.stock <= 5 ? 'low' : ''}>{item.stock}<small>EN STOCK</small></strong><button title="Editar" onClick={() => setEditing({ ...item })}>✎</button><button className="remove-cigarette" title="Quitar" onClick={() => deleteProduct(item)}>×</button></article>)}{!dashboard.products.length && <div className="cigarette-empty">Todavía no hay cigarrillos cargados.</div>}{dashboard.products.length > 0 && !filteredProducts.length && <div className="cigarette-empty">No se encontraron cigarrillos.</div>}</div>
        {visibleProductCount < filteredProducts.length && <button type="button" className="load-more-button" onClick={() => setVisibleProductCount((count) => count + 10)}>Cargar 10 más</button>}
      </section>
      <section className="cigarette-card accent-card"><small>NUEVA VARIEDAD</small><h2>Cargar cigarrillo</h2><p>Definí el precio de venta y el stock con el que comenzás.</p><form className="cigarette-form" onSubmit={addProduct}><label>Marca y presentación<input required maxLength="100" placeholder="Ej.: Marlboro Box 20" value={product.name} onChange={(event) => setProduct({ ...product, name: event.target.value })} /></label><div><label>Precio de venta<input required type="number" min="0.01" step="0.01" placeholder="$ 0" value={product.price} onChange={(event) => setProduct({ ...product, price: event.target.value })} /></label><label>Stock inicial<input required type="number" min="0" placeholder="0" value={product.initialStock} onChange={(event) => setProduct({ ...product, initialStock: event.target.value })} /></label></div><button className="primary wide" disabled={busy}>+ Agregar al inventario</button></form></section>
    </div>
}
