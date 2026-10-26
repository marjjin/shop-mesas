import SupplierOperations from './components/SupplierOperations.jsx'
import SupplierHistory from './components/SupplierHistory.jsx'
import TransactionDialog from './components/TransactionDialog.jsx'
import BalanceDialog from './components/BalanceDialog.jsx'
import CreateSupplierDialog from './components/CreateSupplierDialog.jsx'
import './Suppliers.css'
import { useState } from 'react'
import useSupplierAccounts from './hooks/useSupplierAccounts.js'
import useSupplierOperations from './hooks/useSupplierOperations.js'
import useSupplierTransactions from './hooks/useSupplierTransactions.js'
import { money } from '../../shared/utils/currency.js'

export default function Suppliers({ api }) {

  const [historyFilter, setHistoryFilter] = useState('all')
  const [message, setMessage] = useState('')

  const [supplierSearch, setSupplierSearch] = useState('')

  const {
    suppliers,
    name,
    setName,
    creatingSupplier,
    setCreatingSupplier,
    selectedSupplierId,
    setSelectedSupplierId,
    balances,
    setBalances,
    editingBalances,
    setEditingBalances,
    load,
    create,
    editBalances,
    deactivate,
    setSeparateCashBox
  } = useSupplierAccounts({ api, setMessage })
  const {
    purchase,
    setPurchase,
    payment,
    setPayment,
    transfer,
    setTransfer,
    exchange,
    setExchange,
    transferMode,
    setTransferMode,
    operation,
    setOperation,
    pay,
    registerPurchase,
    transferReservedFunds,
    exchangeReservedFunds
  } = useSupplierOperations({ api, load, setMessage })
  const { editingTransaction, setEditingTransaction, transactionForm, setTransactionForm, transactionBusy, beginTransactionEdit, saveTransaction, deleteTransaction } = useSupplierTransactions({ api, load, setMessage })

  const selectedSupplier = suppliers.find((supplier) => supplier.id === selectedSupplierId)
  const activeSuppliers = suppliers.filter((supplier) => supplier.isActive)
  const totalReservedCash = activeSuppliers.reduce((total, supplier) => total + supplier.reservedCashBalance, 0)
  const totalReservedMercadoPago = activeSuppliers.reduce((total, supplier) => total + supplier.reservedMercadoPagoBalance, 0)
  const normalizedSupplierSearch = supplierSearch.trim().toLocaleLowerCase('es-AR').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const visibleSuppliers = normalizedSupplierSearch
    ? activeSuppliers.filter((supplier) => supplier.name.toLocaleLowerCase('es-AR').normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(normalizedSupplierSearch))
    : activeSuppliers

  if (selectedSupplier) {
    const paidTotal = selectedSupplier.transactions
      .filter((transaction) => transaction.type === 'payment')
      .reduce((total, transaction) => total + transaction.amount, 0)
    const purchaseTotal = selectedSupplier.transactions
      .filter((transaction) => transaction.type === 'purchase')
      .reduce((total, transaction) => total + transaction.amount, 0)
    const reservedTotal = selectedSupplier.reservedCashBalance + selectedSupplier.reservedMercadoPagoBalance
    const purchaseAmount = Number(purchase.amount || 0)
    const transferTargets = suppliers.filter((supplier) => supplier.isActive && supplier.id !== selectedSupplier.id)
    const visibleTransactions = selectedSupplier.transactions.filter((transaction) => historyFilter === 'all'
      || (historyFilter === 'reservations' && transaction.type === 'allocation')
      || (historyFilter === 'purchases' && ['purchase', 'reserved_purchase'].includes(transaction.type))
      || (historyFilter === 'payments' && transaction.type === 'payment')
      || (historyFilter === 'transfers' && ['reserved_transfer_in', 'reserved_transfer_out', 'reserved_exchange'].includes(transaction.type))
      || (historyFilter === 'adjustments' && ['reserved_adjustment', 'current_account_adjustment'].includes(transaction.type)))

    return <div className="suppliers-page supplier-detail-page">
      <button type="button" className="supplier-back" onClick={() => setSelectedSupplierId(null)}>← Volver a proveedores</button>
      <header className="supplier-detail-header"><div><p className="eyebrow">CUENTA CORRIENTE</p><h1>{selectedSupplier.name}</h1><p>Administrá reservas, compras, pagos y movimientos del proveedor.</p>{selectedSupplier.isSeparateCashBox && <span className="supplier-separate-cash-box">Caja aparte</span>}</div><div className="supplier-detail-actions"><button type="button" className={`supplier-cash-box-toggle ${selectedSupplier.isSeparateCashBox ? 'active' : ''}`} onClick={() => setSeparateCashBox(selectedSupplier, !selectedSupplier.isSeparateCashBox)}>{selectedSupplier.isSeparateCashBox ? 'Caja aparte activada' : 'Marcar como caja aparte'}</button><button type="button" className="supplier-edit-balances" onClick={() => { setBalances({ reservedCashBalance: String(selectedSupplier.reservedCashBalance), reservedMercadoPagoBalance: String(selectedSupplier.reservedMercadoPagoBalance), currentAccountBalance: String(selectedSupplier.currentAccountBalance), note: '' }); setEditingBalances(true) }}>Editar saldos</button><button type="button" className="supplier-remove" onClick={() => deactivate(selectedSupplier)} title="Desactivar proveedor">Desactivar proveedor</button></div></header>
      {message && <p className="supplier-message">{message}</p>}
      {editingTransaction && <TransactionDialog editingTransaction={editingTransaction} setEditingTransaction={setEditingTransaction} saveTransaction={saveTransaction} selectedSupplier={selectedSupplier} transactionForm={transactionForm} setTransactionForm={setTransactionForm} transactionBusy={transactionBusy} />}
      {editingBalances && <BalanceDialog selectedSupplier={selectedSupplier} setEditingBalances={setEditingBalances} editBalances={editBalances} balances={balances} setBalances={setBalances} />}
      <section className="supplier-summary">
        <div className="supplier-reserved-total"><span>Fondos reservados totales</span><strong>{money.format(reservedTotal)}</strong></div>
        <div><span>Reservado en efectivo</span><strong>{money.format(selectedSupplier.reservedCashBalance)}</strong></div>
        <div><span>Reservado en Mercado Pago</span><strong>{money.format(selectedSupplier.reservedMercadoPagoBalance)}</strong></div>
        <div><span>Cuenta corriente</span><strong>{money.format(selectedSupplier.currentAccountBalance)}</strong></div>
        <div><span>Compras a cuenta</span><strong>{money.format(purchaseTotal)}</strong></div>
        <div><span>Pagos realizados</span><strong>{money.format(paidTotal)}</strong></div>
      </section>
      <section className="supplier-detail-content">
        <SupplierOperations operation={operation} setOperation={setOperation} registerPurchase={registerPurchase} selectedSupplier={selectedSupplier} purchase={purchase} setPurchase={setPurchase} reservedTotal={reservedTotal} purchaseAmount={purchaseAmount} pay={pay} payment={payment} setPayment={setPayment} transferMode={transferMode} setTransferMode={setTransferMode} exchangeReservedFunds={exchangeReservedFunds} exchange={exchange} setExchange={setExchange} transferReservedFunds={transferReservedFunds} transfer={transfer} setTransfer={setTransfer} transferTargets={transferTargets} />
        <SupplierHistory historyFilter={historyFilter} setHistoryFilter={setHistoryFilter} visibleTransactions={visibleTransactions} beginTransactionEdit={beginTransactionEdit} transactionBusy={transactionBusy} deleteTransaction={deleteTransaction} selectedSupplier={selectedSupplier} />
      </section>
    </div>
  }

  return <div className="suppliers-page">
    <header className="suppliers-list-header"><div><p className="eyebrow">CUENTAS CORRIENTES</p><h1>Proveedores</h1><p>Administrá compras a cuenta, pagos y el historial de cada proveedor.</p></div><button type="button" className="primary supplier-add-button" onClick={() => setCreatingSupplier(true)}>+ Nuevo proveedor</button></header>
    {message && <p className="supplier-message">{message}</p>}
    {creatingSupplier && <CreateSupplierDialog setCreatingSupplier={setCreatingSupplier} create={create} name={name} setName={setName} />}
    <section className="supplier-overview"><div className="supplier-overview-total"><span>Fondos reservados de todos los proveedores</span><strong>{money.format(totalReservedCash + totalReservedMercadoPago)}</strong><small>{activeSuppliers.length} {activeSuppliers.length === 1 ? 'proveedor activo' : 'proveedores activos'}</small></div><div><span>Efectivo total</span><strong>{money.format(totalReservedCash)}</strong></div><div><span>Mercado Pago total</span><strong>{money.format(totalReservedMercadoPago)}</strong></div></section>
    <section className="supplier-search-panel" aria-label="Buscar proveedores"><div className="supplier-search-heading"><label htmlFor="supplier-search">Buscar proveedor</label></div><div className="supplier-search-field"><span className="supplier-search-icon" aria-hidden="true" /><input id="supplier-search" type="search" value={supplierSearch} onChange={(event) => setSupplierSearch(event.target.value)} placeholder="Buscar por nombre..." autoComplete="off" />{supplierSearch && <button type="button" onClick={() => setSupplierSearch('')} aria-label="Limpiar búsqueda">×</button>}</div><small>{normalizedSupplierSearch ? `${visibleSuppliers.length} de ${activeSuppliers.length} ${activeSuppliers.length === 1 ? 'proveedor encontrado' : 'proveedores encontrados'}` : `${activeSuppliers.length} ${activeSuppliers.length === 1 ? 'proveedor activo' : 'proveedores activos'}`}</small></section>
    <section className="supplier-grid">
      {visibleSuppliers.map((supplier) => <article className={`supplier-card ${supplier.isSeparateCashBox ? 'separate-cash-box' : ''}`} key={supplier.id}>
        <header><div><small>PROVEEDOR</small><h2>{supplier.name}</h2>{supplier.isSeparateCashBox && <span className="supplier-card-cash-box-badge">Caja aparte</span>}</div></header>
        <div className="supplier-balance supplier-total-balance"><span>Fondos reservados totales</span><strong>{money.format(supplier.reservedCashBalance + supplier.reservedMercadoPagoBalance)}</strong></div>
        <div className="supplier-reserve-breakdown"><div><span>Efectivo</span><strong>{money.format(supplier.reservedCashBalance)}</strong></div><div><span>Mercado Pago</span><strong>{money.format(supplier.reservedMercadoPagoBalance)}</strong></div></div>
        <div className="supplier-balance supplier-current-account"><span>Cuenta corriente</span><strong>{money.format(supplier.currentAccountBalance)}</strong></div>
        <p className="supplier-card-meta">{supplier.transactions.length} {supplier.transactions.length === 1 ? 'movimiento registrado' : 'movimientos registrados'}</p>
        <button type="button" className="supplier-detail-link" onClick={() => setSelectedSupplierId(supplier.id)}>Ver detalles <span>→</span></button>
      </article>)}
      {!activeSuppliers.length && <p className="supplier-empty">Todavía no hay proveedores activos. Creá uno para reservar fondos durante el cierre de turno.</p>}
      {activeSuppliers.length > 0 && !visibleSuppliers.length && <p className="supplier-empty">No encontramos proveedores con “{supplierSearch}”. Probá con otro nombre.</p>}
    </section>
  </div>
}
