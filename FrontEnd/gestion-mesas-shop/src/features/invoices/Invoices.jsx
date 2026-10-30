import { useRef, useState } from 'react'
import LoadingSkeleton from '../../shared/components/LoadingSkeleton.jsx'
import useInvoices from './hooks/useInvoices.js'
import InvoiceComposer from './InvoiceComposer.jsx'
import EditInvoiceDialog from './ui/EditInvoiceDialog.jsx'
import InvoiceDocumentDialog from './ui/InvoiceDocumentDialog.jsx'
import InvoiceIcon from './ui/InvoiceIcon.jsx'
import InvoiceCard from './ui/InvoiceCard.jsx'
import { displayFileSize } from './api/invoicesApi.js'
import './Invoices.css'


export default function Invoices({ api, onOpenSuppliers }) {
  const { archive, suppliers, loading, refreshing, error, filters, setFilters, reload } = useInvoices(api)
  const [search, setSearch] = useState('')
  const [dialog, setDialog] = useState(null)
  const [notice, setNotice] = useState('')
  const [actionError, setActionError] = useState('')
  const [deleting, setDeleting] = useState(null)
  const deleteLock = useRef(false)
  const activeSuppliers = suppliers.filter((supplier) => supplier.isActive)
  const saved = (invoice) => { setDialog(null); setNotice(`Factura guardada · ${displayFileSize(invoice.sizeBytes)}.`); setActionError(''); reload() }
  const remove = async (invoice) => {
    if (deleteLock.current || !window.confirm(`¿Eliminar ${invoice.reference || `la factura #${invoice.id}`} de ${invoice.supplierName}? Se eliminará también su PDF.`)) return
    deleteLock.current = true; setDeleting(invoice.id); setActionError('')
    try { await api(`/invoices/${invoice.id}`, { method: 'DELETE' }); setNotice('Factura eliminada.'); reload() }
    catch (failure) { setActionError(failure.message) }
    finally { deleteLock.current = false; setDeleting(null) }
  }
  if (loading) return <LoadingSkeleton section="invoices" />
  return <div className="invoices-page">
    <header className="invoices-header"><div><p className="eyebrow">ARCHIVO DE DOCUMENTOS</p><h1>Facturas</h1><p>Escaneá comprobantes y consultalos por proveedor.</p></div><button type="button" className="invoice-button primary" disabled={Boolean(error) || !activeSuppliers.length} onClick={() => { setNotice(''); setDialog({ type: 'create' }) }}><InvoiceIcon name="scan" />Escanear factura</button></header>
    {error ? <section className="invoice-card invoice-empty" role="alert"><InvoiceIcon name="file" /><h2>No se pudo cargar el archivo</h2><p>{error}</p><button type="button" className="invoice-button secondary" onClick={reload}>Reintentar</button></section> : <>
      <dl className="invoice-stats"><div><span className="invoice-stat-icon"><InvoiceIcon name="file" /></span><div><dt>Facturas guardadas</dt><dd>{archive.summary.count}</dd><small>Documentos del archivo</small></div></div><div><span className="invoice-stat-icon"><InvoiceIcon name="supplier" /></span><div><dt>Proveedores con facturas</dt><dd>{archive.summary.supplierCount}</dd><small>Vinculados a documentos</small></div></div><div><span className="invoice-stat-icon"><InvoiceIcon name="storage" /></span><div><dt>Espacio utilizado</dt><dd>{displayFileSize(archive.summary.sizeBytes)}</dd><small>PDF guardados tras la compresión</small></div></div></dl>
      {notice && <div className="invoice-notice" role="status"><InvoiceIcon name="check" /><span>{notice}</span><button type="button" className="invoice-icon-button" aria-label="Cerrar aviso" onClick={() => setNotice('')}><InvoiceIcon name="close" /></button></div>}
      {actionError && <p className="invoice-error" role="alert">{actionError}</p>}
      {!activeSuppliers.length && <div className="invoice-notice"><InvoiceIcon name="supplier" /><p>Para guardar una factura necesitás un proveedor activo.</p><button type="button" className="invoice-button secondary" onClick={onOpenSuppliers}>Ir a Proveedores</button></div>}
      <section className={`invoice-card invoice-archive${refreshing ? ' is-refreshing' : ''}`} aria-busy={refreshing} aria-labelledby="invoice-archive-title"><div className="invoice-section-title"><div><h2 id="invoice-archive-title">Archivo de facturas</h2><p>Buscá por referencia, proveedor u observaciones.</p></div><span className="invoice-badge">{archive.totalCount} {archive.totalCount === 1 ? 'documento' : 'documentos'}</span></div>
        <form className="invoice-filters" onSubmit={(event) => { event.preventDefault(); setFilters({ ...filters, search: search.trim(), page: 1 }) }}><label className="invoice-search"><InvoiceIcon name="search" /><span className="invoice-sr-only">Buscar facturas</span><input type="search" maxLength={100} placeholder="Buscar referencia o proveedor…" value={search} onChange={(event) => setSearch(event.target.value)} /></label><label className="invoice-filter-supplier"><span>Proveedor</span><select value={filters.supplierId} onChange={(event) => setFilters({ search: search.trim(), supplierId: event.target.value, page: 1 })}><option value="">Todos los proveedores</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}{supplier.isActive ? '' : ' (inactivo)'}</option>)}</select></label><button className="invoice-button secondary">Buscar</button>{(filters.search || filters.supplierId) && <button type="button" className="invoice-clear-filters" onClick={() => { setSearch(''); setFilters({ search: '', supplierId: '', page: 1 }) }}>Limpiar filtros</button>}</form>
        {archive.items.length ? <div className="invoice-grid">{archive.items.map((invoice) => <InvoiceCard key={invoice.id} invoice={invoice} disabled={deleting != null} onRead={(item) => setDialog({ type: 'document', invoice: item })} onEdit={(item) => setDialog({ type: 'edit', invoice: item })} onRemove={remove} />)}</div> : <div className="invoice-empty"><span className="invoice-empty-icon"><InvoiceIcon name={filters.search || filters.supplierId ? 'search' : 'scan'} /></span><h3>{filters.search || filters.supplierId ? 'No hay facturas con estos filtros' : 'Todavía no hay facturas guardadas'}</h3><p>{filters.search || filters.supplierId ? 'Probá con otra referencia o seleccioná otro proveedor.' : 'Escaneá el comprobante, revisá las páginas y asignalo a un proveedor.'}</p>{!filters.search && !filters.supplierId && <button type="button" className="invoice-button primary" disabled={!activeSuppliers.length} onClick={() => setDialog({ type: 'create' })}><InvoiceIcon name="scan" />Escanear primera factura</button>}</div>}
        {archive.totalCount > archive.pageSize && <nav className="invoice-pagination" aria-label="Páginas de facturas"><span>Página {archive.page} de {Math.ceil(archive.totalCount / archive.pageSize)}</span><button type="button" className="invoice-button secondary" disabled={archive.page <= 1} onClick={() => setFilters({ ...filters, page: archive.page - 1 })}>Anterior</button><button type="button" className="invoice-button secondary" disabled={archive.page * archive.pageSize >= archive.totalCount} onClick={() => setFilters({ ...filters, page: archive.page + 1 })}>Siguiente</button></nav>}
      </section>
    </>}
    {dialog?.type === 'create' && <InvoiceComposer api={api} suppliers={suppliers} initialSupplierId={activeSuppliers.some((s) => s.id === Number(filters.supplierId)) ? filters.supplierId : ''} onClose={() => setDialog(null)} onSaved={saved} />}
    {dialog?.type === 'edit' && <EditInvoiceDialog invoice={dialog.invoice} api={api} suppliers={suppliers} onClose={() => setDialog(null)} onSaved={saved} />}
    {dialog?.type === 'document' && <InvoiceDocumentDialog invoice={dialog.invoice} api={api} onClose={() => setDialog(null)} />}
  </div>
}
