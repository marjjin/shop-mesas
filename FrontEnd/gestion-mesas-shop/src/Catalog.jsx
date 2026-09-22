import { useState } from 'react'
import './Catalog.css'

const isCoworkingService = (item) => item.name.startsWith('Servicio Coworking ')

export default function Catalog({ data, api, load }) {
  const [product, setProduct] = useState({ name: '' })
  const [visibleCount, setVisibleCount] = useState(10)
  const regularProducts = data.products.filter((item) => !isCoworkingService(item))
  const visibleProducts = data.products.slice(0, visibleCount)

  const addProduct = async (event) => {
    event.preventDefault()
    await api('/products', { method: 'POST', body: JSON.stringify(product) })
    setProduct({ name: '' })
    await load()
  }

  return <>
    <header><div><p className="eyebrow">ADMINISTRACIÓN</p><h1>Artículos</h1><p>Cargá los artículos disponibles para las mesas.</p></div></header>
    <div className="catalog articles-only">
      <section>
        <div className="catalog-title"><h2>Artículos</h2>{regularProducts.length > 0 && <button className="text-button" onClick={async () => { await api('/products', { method: 'DELETE' }); await load() }}>Eliminar todos</button>}</div>
        <form className="article-form" onSubmit={addProduct}>
          <input required placeholder="Nombre del artículo" value={product.name} onChange={(event) => setProduct({ ...product, name: event.target.value })} />
          <button className="primary">Agregar artículo</button>
        </form>
        <div className="catalog-items">{data.products.length ? visibleProducts.map((item) => <div className="list" key={item.id}><span><b>{item.name}</b>{isCoworkingService(item) && <small>Servicio automático</small>}</span>{!isCoworkingService(item) && <button className="delete-item" title="Eliminar artículo" onClick={async () => { await api(`/products/${item.id}`, { method: 'DELETE' }); await load() }}>×</button>}</div>) : <div className="empty-catalog"><b>No hay artículos cargados</b><span>Usá el formulario para agregar el primero.</span></div>}</div>
        {visibleCount < data.products.length && <button type="button" className="load-more-button" onClick={() => setVisibleCount((count) => count + 10)}>Cargar 10 más</button>}
      </section>
    </div>
  </>
}
