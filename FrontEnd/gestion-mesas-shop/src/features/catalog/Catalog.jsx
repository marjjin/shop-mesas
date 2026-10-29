import { useRef, useState } from 'react'
import { isCoworkingService } from '../../shared/utils/products.js'
import { filterCatalogProducts } from './domain/catalogProducts.js'
import CatalogIcon from './components/CatalogIcon.jsx'
import DeleteProductDialog from './components/DeleteProductDialog.jsx'
import './Catalog.css'

export default function Catalog({ data, api, load }) {
  const [name, setName] = useState('')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [sort, setSort] = useState('recent')
  const [visibleCount, setVisibleCount] = useState(10)
  const [action, setAction] = useState(null)
  const [notice, setNotice] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [deleteError, setDeleteError] = useState('')
  const nameRef = useRef(null)
  const searchRef = useRef(null)
  const regularCount = data.products.filter((item) => !isCoworkingService(item)).length
  const automaticCount = data.products.length - regularCount
  const filteredProducts = filterCatalogProducts(data.products, { search, filter, sort })
  const visibleProducts = filteredProducts.slice(0, visibleCount)
  const hasFilters = search !== '' || filter !== 'all'
  const filters = [['all', 'Todos', data.products.length], ['articles', 'Artículos', regularCount], ['automatic', 'Automáticos', automaticCount]]

  const addProduct = async (event) => {
    event.preventDefault()
    if (action || !name.trim()) return
    setAction('create')
    setNotice(null)
    try {
      await api('/products', { method: 'POST', body: JSON.stringify({ name: name.trim() }) })
      setName('')
      setSearch('')
      setFilter('all')
      setSort('recent')
      setVisibleCount(10)
      await load()
      setNotice({ type: 'success', text: 'Artículo agregado. Ya está disponible en el menú de las mesas.' })
    } catch (error) {
      setNotice({ type: 'error', text: error.message || 'No se pudo agregar el artículo. Volvé a intentar.' })
    } finally {
      setAction(null)
      nameRef.current?.focus()
    }
  }

  const requestDelete = (item) => {
    setDeleteError('')
    setDeleting(item)
  }

  const deleteProducts = async () => {
    if (action || !deleting) return
    setAction('delete')
    setDeleteError('')
    setNotice(null)
    try {
      await api(deleting.all ? '/products' : `/products/${deleting.id}`, { method: 'DELETE' })
      await load()
      setNotice({ type: 'success', text: deleting.all ? 'Se eliminaron los artículos. Los servicios automáticos se conservaron.' : `Se eliminó “${deleting.name}” del catálogo.` })
      setDeleting(null)
      requestAnimationFrame(() => searchRef.current?.focus())
    } catch (error) {
      setDeleteError(error.message || 'No se pudo eliminar. Volvé a intentar.')
    } finally {
      setAction(null)
    }
  }

  const resetFilters = () => {
    setSearch('')
    setFilter('all')
    setVisibleCount(10)
    searchRef.current?.focus()
  }

  return <div className="catalog-page">
    <header className="catalog-header">
      <div><p className="eyebrow">ADMINISTRACIÓN</p><h1>Artículos</h1><p>Tu catálogo, listo para cada mesa. Organizá los artículos que ofrecés en el salón.</p></div>
      <span className="catalog-live-badge"><CatalogIcon name="box" />Catálogo del salón</span>
    </header>

    {notice && <div className={`catalog-notice catalog-notice-${notice.type}`} role={notice.type === 'error' ? 'alert' : 'status'}>
      <CatalogIcon name={notice.type === 'error' ? 'info' : 'check'} /><span>{notice.text}</span>
      <button type="button" aria-label="Cerrar mensaje" onClick={() => setNotice(null)}><CatalogIcon name="close" /></button>
    </div>}

    <div className="catalog-workspace">
      <section className="catalog-library" aria-labelledby="catalog-library-title">
        <div className="catalog-library-heading"><div><span className="catalog-overline">CATÁLOGO DEL SALÓN</span><h2 id="catalog-library-title">Tus artículos <span>{data.products.length}</span></h2></div><span className="catalog-library-icon"><CatalogIcon name="box" /></span></div>

        <div className="catalog-toolbar">
          <div className="catalog-search"><CatalogIcon name="search" /><input ref={searchRef} type="search" aria-label="Buscar artículos por nombre" placeholder="Buscar un artículo…" autoComplete="off" value={search} onChange={(event) => { setSearch(event.target.value); setVisibleCount(10) }} />{search && <button type="button" aria-label="Limpiar búsqueda" onClick={() => { setSearch(''); setVisibleCount(10); searchRef.current?.focus() }}><CatalogIcon name="close" /></button>}</div>
          <label className="catalog-sort"><span className="catalog-visually-hidden">Ordenar artículos</span><CatalogIcon name="sort" /><select value={sort} onChange={(event) => { setSort(event.target.value); setVisibleCount(10) }}><option value="recent">Más recientes</option><option value="name">Nombre: A–Z</option></select></label>
        </div>

        <div className="catalog-filter-bar"><div className="catalog-filters" role="group" aria-label="Filtrar por tipo">{filters.map(([value, label, count]) => <button key={value} type="button" aria-pressed={filter === value} onClick={() => { setFilter(value); setVisibleCount(10) }}>{label}<span>{count}</span></button>)}</div></div>

        <div className="catalog-list-head" aria-hidden="true"><span>NOMBRE DEL ARTÍCULO</span><span>TIPO</span><span /></div>
        {visibleProducts.length ? <ul className="catalog-product-list" aria-label="Artículos del catálogo">{visibleProducts.map((item) => {
          const automatic = isCoworkingService(item)
          return <li className="catalog-product-row" key={item.id}>
            <span className={`catalog-product-icon${automatic ? ' automatic' : ''}`}><CatalogIcon name={automatic ? 'clock' : 'box'} /></span>
            <div className="catalog-product-name"><strong>{item.name}</strong><span>{automatic ? 'Se agrega según el tiempo de la mesa' : 'Disponible para agregar a una mesa'}</span></div>
            <span className={`catalog-type${automatic ? ' automatic' : ''}`}>{automatic ? 'Automático' : 'Artículo'}</span>
            {automatic ? <span className="catalog-protected" title="Servicio automático protegido" aria-label="Servicio automático protegido"><CatalogIcon name="lock" /></span> : <button type="button" className="catalog-delete" aria-label={`Eliminar ${item.name}`} title={`Eliminar ${item.name}`} disabled={action !== null} onClick={() => requestDelete(item)}><CatalogIcon name="trash" /></button>}
          </li>
        })}</ul> : <div className="catalog-empty"><span><CatalogIcon name={hasFilters ? 'search' : 'box'} /></span><h3>{hasFilters ? 'No encontramos coincidencias' : 'Tu catálogo empieza acá'}</h3><p>{hasFilters ? 'Probá con otro nombre o cambiá el filtro seleccionado.' : 'Agregá tu primer artículo y empezá a usarlo en las mesas del salón.'}</p><button type="button" onClick={hasFilters ? resetFilters : () => nameRef.current?.focus()}>{hasFilters ? 'Limpiar filtros' : 'Agregar mi primer artículo'}<CatalogIcon name="arrow" /></button></div>}

        <footer className="catalog-list-footer"><span role="status">{filteredProducts.length ? `${visibleProducts.length} de ${filteredProducts.length} ${filteredProducts.length === 1 ? 'resultado' : 'resultados'}` : '0 resultados'}</span>{visibleCount < filteredProducts.length && <button type="button" onClick={() => setVisibleCount((count) => count + 10)}>Mostrar {Math.min(10, filteredProducts.length - visibleCount)} más<CatalogIcon name="down" /></button>}</footer>
      </section>

      <aside className="catalog-aside">
        <section className="catalog-create" aria-labelledby="catalog-create-title">
          <span className="catalog-create-icon"><CatalogIcon name="plus" /></span>
          <h2 id="catalog-create-title">Nuevo artículo</h2><p>Sumá un producto al menú de tus mesas.</p>
          <form onSubmit={addProduct} aria-busy={action === 'create'}>
            <label htmlFor="catalog-product-name">Nombre del artículo</label>
            <input ref={nameRef} id="catalog-product-name" required maxLength={100} placeholder="Ej.: Café con leche" autoComplete="off" value={name} readOnly={action !== null} aria-describedby="catalog-name-help" onChange={(event) => setName(event.target.value)} />
            <span id="catalog-name-help">Usá un nombre fácil de reconocer en el menú.</span>
            <button type="submit" disabled={action !== null || !name.trim()}><CatalogIcon name="plus" />{action === 'create' ? 'Agregando…' : 'Agregar artículo'}</button>
          </form>
          <div className="catalog-create-note"><CatalogIcon name="check" /><span>Disponible en las mesas al guardarlo.</span></div>
        </section>

        <section className="catalog-help" aria-labelledby="catalog-help-title"><CatalogIcon name="clock" /><div><h3 id="catalog-help-title">Servicios automáticos</h3><p>Los servicios de coworking se cargan según el tiempo de uso de cada mesa. Siempre se conservan en el catálogo.</p><span><CatalogIcon name="lock" />Administrados por el sistema</span></div></section>
      </aside>
    </div>

    {regularCount > 0 && <div className="catalog-management"><div><CatalogIcon name="info" /><span>¿Necesitás renovar el catálogo? Podés quitar todos los artículos y empezar de nuevo.</span></div><button type="button" disabled={action !== null} onClick={() => requestDelete({ all: true })}><CatalogIcon name="trash" />Eliminar artículos</button></div>}
    {deleting && <DeleteProductDialog item={deleting} count={regularCount} busy={action === 'delete'} error={deleteError} onCancel={() => setDeleting(null)} onConfirm={deleteProducts} />}
  </div>
}
