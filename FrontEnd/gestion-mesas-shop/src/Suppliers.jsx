import { useCallback, useEffect, useState } from 'react'
import './Suppliers.css'

const money = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })
const editableTransactionTypes = new Set(['purchase', 'reserved_purchase', 'payment', 'reserved_adjustment', 'current_account_adjustment', 'reserved_exchange'])

function transactionLabel(type) {
  return type === 'allocation' ? 'Reserva de cierre' : type === 'purchase' ? 'Compra a cuenta corriente' : type === 'reserved_purchase' ? 'Compra con fondos reservados' : type === 'reserved_transfer_in' ? 'Fondos recibidos de otro proveedor' : type === 'reserved_transfer_out' ? 'Fondos transferidos a otro proveedor' : type === 'reserved_exchange' ? 'Movimiento entre efectivo y Mercado Pago' : type === 'reserved_adjustment' ? 'Ajuste de fondos reservados' : type === 'current_account_adjustment' ? 'Ajuste de cuenta corriente' : 'Pago de cuenta corriente'
}

function transactionFormValues(transaction) {
  const splitType = transaction.type === 'reserved_purchase' || transaction.type === 'payment'
  return {
    amount: String(transaction.amount),
    cashAmount: splitType ? String(Math.abs(transaction.cashAmount)) : String(transaction.cashAmount),
    mercadoPagoAmount: splitType ? String(Math.abs(transaction.mercadoPagoAmount)) : String(transaction.mercadoPagoAmount),
    note: transaction.note || ''
  }
}

function normalizeSuppliers(value) {
  return (Array.isArray(value) ? value : []).map((supplier) => ({
    ...supplier,
    transactions: Array.isArray(supplier.transactions) ? supplier.transactions : []
  }))
}

function sumPaymentAmounts(cashAmount, mercadoPagoAmount) {
  if (!cashAmount && !mercadoPagoAmount) return ''
  const total = Number(cashAmount || 0) + Number(mercadoPagoAmount || 0)
  return Number.isFinite(total) ? String(Math.round(total * 100) / 100) : ''
}

export default function Suppliers({ api }) {
  const [suppliers, setSuppliers] = useState([])
  const [name, setName] = useState('')
  const [purchase, setPurchase] = useState({ amount: '', note: '', paymentMethod: 'reserved', cashAmount: '', mercadoPagoAmount: '' })
  const [payment, setPayment] = useState({})
  const [transfer, setTransfer] = useState({ targetSupplierId: '', cashAmount: '', mercadoPagoAmount: '', note: '' })
  const [exchange, setExchange] = useState({ amount: '', fromPaymentMethod: 'cash', note: '' })
  const [transferMode, setTransferMode] = useState('internal')
  const [balances, setBalances] = useState({ reservedCashBalance: '', reservedMercadoPagoBalance: '', currentAccountBalance: '', note: '' })
  const [operation, setOperation] = useState('purchase')
  const [editingBalances, setEditingBalances] = useState(false)
  const [creatingSupplier, setCreatingSupplier] = useState(false)
  const [historyFilter, setHistoryFilter] = useState('all')
  const [message, setMessage] = useState('')
  const [editingTransaction, setEditingTransaction] = useState(null)
  const [transactionForm, setTransactionForm] = useState({ amount: '', cashAmount: '', mercadoPagoAmount: '', note: '' })
  const [transactionBusy, setTransactionBusy] = useState(false)
  const [selectedSupplierId, setSelectedSupplierId] = useState(() => {
    const storedSupplierId = Number(sessionStorage.getItem('mesa-supplier-id'))
    return Number.isInteger(storedSupplierId) && storedSupplierId > 0 ? storedSupplierId : null
  })

  const load = useCallback(async () => {
    try { setSuppliers(normalizeSuppliers(await api('/suppliers'))); setMessage('') } catch (error) { setMessage(error.message) }
  }, [api])
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load() }, [load])
  useEffect(() => {
    if (selectedSupplierId) sessionStorage.setItem('mesa-supplier-id', String(selectedSupplierId))
    else sessionStorage.removeItem('mesa-supplier-id')
  }, [selectedSupplierId])
  useEffect(() => {
    if (selectedSupplierId && suppliers.length && !suppliers.some((supplier) => supplier.id === selectedSupplierId && supplier.isActive))
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedSupplierId(null)
  }, [selectedSupplierId, suppliers])

  const create = async (event) => {
    event.preventDefault()
    try {
      await api('/suppliers', { method: 'POST', body: JSON.stringify({ name }) })
      setName('')
      setCreatingSupplier(false)
      await load()
    } catch (error) { setMessage(error.message) }
  }
  const pay = async (event, supplier) => {
    event.preventDefault()
    const cashAmount = Number(payment[supplier.id]?.cashAmount || 0)
    const mercadoPagoAmount = Number(payment[supplier.id]?.mercadoPagoAmount || 0)
    const amount = cashAmount + mercadoPagoAmount
    if (!amount || amount <= 0) return setMessage('Ingresá un importe de pago válido.')
    if (amount > supplier.currentAccountBalance) return setMessage(`El pago no puede superar el saldo de cuenta corriente de ${supplier.name}.`)
    if (cashAmount > supplier.reservedCashBalance || mercadoPagoAmount > supplier.reservedMercadoPagoBalance) return setMessage(`El pago no puede superar los fondos reservados seleccionados de ${supplier.name}.`)
    try {
      await api(`/suppliers/${supplier.id}/payments`, { method: 'POST', body: JSON.stringify({ cashAmount, mercadoPagoAmount }) })
      setPayment({ ...payment, [supplier.id]: { cashAmount: '', mercadoPagoAmount: '' } })
      await load()
    } catch (error) { setMessage(error.message) }
  }
  const registerPurchase = async (event, supplier) => {
    event.preventDefault()
    const amount = Number(purchase.amount || 0)
    if (!amount || amount <= 0) return setMessage('Ingresá un importe de compra válido.')
    try {
      const cashAmount = Number(purchase.cashAmount || 0)
      const mercadoPagoAmount = Number(purchase.mercadoPagoAmount || 0)
      const splitAmount = Number(sumPaymentAmounts(purchase.cashAmount, purchase.mercadoPagoAmount) || 0)
      if (purchase.paymentMethod === 'reserved' && amount !== splitAmount) return setMessage('El efectivo y Mercado Pago deben sumar el importe de la compra.')
      if (cashAmount > supplier.reservedCashBalance || mercadoPagoAmount > supplier.reservedMercadoPagoBalance) return setMessage(`La compra no puede superar los fondos reservados seleccionados de ${supplier.name}.`)
      await api(`/suppliers/${supplier.id}/purchases`, { method: 'POST', body: JSON.stringify({ amount, note: purchase.note, paymentMethod: purchase.paymentMethod, cashAmount, mercadoPagoAmount }) })
      setPurchase({ amount: '', note: '', paymentMethod: 'reserved', cashAmount: '', mercadoPagoAmount: '' })
      await load()
    } catch (error) { setMessage(error.message) }
  }
  const beginTransactionEdit = (transaction) => {
    setEditingTransaction(transaction)
    setTransactionForm(transactionFormValues(transaction))
  }
  const saveTransaction = async (event, supplier) => {
    event.preventDefault()
    const amount = Number(transactionForm.amount)
    const cashAmount = Number(transactionForm.cashAmount || 0)
    const mercadoPagoAmount = Number(transactionForm.mercadoPagoAmount || 0)
    setTransactionBusy(true)
    try {
      await api(`/suppliers/${supplier.id}/transactions/${editingTransaction.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ amount, cashAmount, mercadoPagoAmount, note: transactionForm.note })
      })
      setEditingTransaction(null)
      await load()
    } catch (error) { setMessage(error.message) } finally { setTransactionBusy(false) }
  }
  const deleteTransaction = async (transaction, supplier) => {
    if (!window.confirm(`¿Eliminar ${transactionLabel(transaction.type).toLowerCase()}? Esta acción ajustará los saldos del proveedor.`)) return
    setTransactionBusy(true)
    try {
      await api(`/suppliers/${supplier.id}/transactions/${transaction.id}`, { method: 'DELETE' })
      await load()
    } catch (error) { setMessage(error.message) } finally { setTransactionBusy(false) }
  }
  const transferReservedFunds = async (event, supplier) => {
    event.preventDefault()
    const cashAmount = Number(transfer.cashAmount || 0)
    const mercadoPagoAmount = Number(transfer.mercadoPagoAmount || 0)
    const amount = cashAmount + mercadoPagoAmount
    const targetSupplierId = Number(transfer.targetSupplierId)
    if (!targetSupplierId) return setMessage('Elegí el proveedor que recibirá los fondos.')
    if (!amount || amount <= 0) return setMessage('Ingresá un importe de transferencia válido.')
    if (cashAmount > supplier.reservedCashBalance || mercadoPagoAmount > supplier.reservedMercadoPagoBalance) return setMessage(`La transferencia no puede superar los fondos reservados seleccionados de ${supplier.name}.`)
    try {
      await api('/suppliers/transfers', { method: 'POST', body: JSON.stringify({ sourceSupplierId: supplier.id, targetSupplierId, cashAmount, mercadoPagoAmount, note: transfer.note }) })
      setTransfer({ targetSupplierId: '', cashAmount: '', mercadoPagoAmount: '', note: '' })
      await load()
    } catch (error) { setMessage(error.message) }
  }
  const exchangeReservedFunds = async (event, supplier) => {
    event.preventDefault()
    const amount = Number(exchange.amount || 0)
    const available = exchange.fromPaymentMethod === 'cash' ? supplier.reservedCashBalance : supplier.reservedMercadoPagoBalance
    if (!amount || amount <= 0) return setMessage('Ingresá un importe válido para mover.')
    if (amount > available) return setMessage('El importe no puede superar los fondos disponibles en el medio de origen.')
    try {
      await api(`/suppliers/${supplier.id}/exchanges`, { method: 'POST', body: JSON.stringify({ amount, fromPaymentMethod: exchange.fromPaymentMethod, note: exchange.note }) })
      setExchange({ amount: '', fromPaymentMethod: exchange.fromPaymentMethod, note: '' })
      await load()
    } catch (error) { setMessage(error.message) }
  }
  const editBalances = async (event, supplier) => {
    event.preventDefault()
    const reservedCashBalance = Number(balances.reservedCashBalance)
    const reservedMercadoPagoBalance = Number(balances.reservedMercadoPagoBalance)
    const currentAccountBalance = Number(balances.currentAccountBalance)
    if (reservedCashBalance < 0 || reservedMercadoPagoBalance < 0 || currentAccountBalance < 0) return setMessage('Los saldos no pueden ser negativos.')
    try {
      await api(`/suppliers/${supplier.id}/balances`, { method: 'PATCH', body: JSON.stringify({ reservedCashBalance, reservedMercadoPagoBalance, currentAccountBalance, note: balances.note }) })
      await load()
      setEditingBalances(false)
    } catch (error) { setMessage(error.message) }
  }
  const deactivate = async (supplier) => {
    if (!window.confirm(`¿Desactivar ${supplier.name}? Se conservará su historial.`)) return
    try {
      await api(`/suppliers/${supplier.id}`, { method: 'DELETE' })
      if (selectedSupplierId === supplier.id) setSelectedSupplierId(null)
      await load()
    } catch (error) { setMessage(error.message) }
  }
  const setSeparateCashBox = async (supplier, isSeparateCashBox) => {
    try {
      await api(`/suppliers/${supplier.id}`, { method: 'PUT', body: JSON.stringify({ name: supplier.name, isSeparateCashBox }) })
      await load()
    } catch (error) { setMessage(error.message) }
  }

  const selectedSupplier = suppliers.find((supplier) => supplier.id === selectedSupplierId)
  const activeSuppliers = suppliers.filter((supplier) => supplier.isActive)
  const totalReservedCash = activeSuppliers.reduce((total, supplier) => total + supplier.reservedCashBalance, 0)
  const totalReservedMercadoPago = activeSuppliers.reduce((total, supplier) => total + supplier.reservedMercadoPagoBalance, 0)

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
      {editingTransaction && <div className="supplier-modal-backdrop" role="presentation"><section className="supplier-balance-modal" role="dialog" aria-modal="true" aria-labelledby="supplier-transaction-modal-title"><div className="supplier-modal-header"><div><small>EDITAR MOVIMIENTO</small><h2 id="supplier-transaction-modal-title">{transactionLabel(editingTransaction.type)}</h2><p>El cambio actualizará automáticamente los saldos del proveedor.</p></div><button type="button" onClick={() => setEditingTransaction(null)} aria-label="Cerrar edición de movimiento">×</button></div><form className="supplier-payment" onSubmit={(event) => saveTransaction(event, selectedSupplier)}><label>Importe<input required type="number" step="0.01" value={transactionForm.amount} onChange={(event) => setTransactionForm({ ...transactionForm, amount: event.target.value })} /></label>{(editingTransaction.type === 'reserved_purchase' || editingTransaction.type === 'payment' || editingTransaction.type === 'reserved_adjustment') && <div className="supplier-payment-split"><label>{editingTransaction.type === 'reserved_adjustment' ? 'Cambio en efectivo' : 'Efectivo'}<input type="number" step="0.01" value={transactionForm.cashAmount} onChange={(event) => setTransactionForm({ ...transactionForm, cashAmount: event.target.value })} /></label><label>{editingTransaction.type === 'reserved_adjustment' ? 'Cambio en Mercado Pago' : 'Mercado Pago'}<input type="number" step="0.01" value={transactionForm.mercadoPagoAmount} onChange={(event) => setTransactionForm({ ...transactionForm, mercadoPagoAmount: event.target.value })} /></label></div>}<label>Detalle opcional<input maxLength="250" value={transactionForm.note} onChange={(event) => setTransactionForm({ ...transactionForm, note: event.target.value })} placeholder="Detalle del movimiento" /></label><div className="supplier-modal-buttons"><button type="button" className="supplier-modal-cancel" onClick={() => setEditingTransaction(null)}>Cancelar</button><button disabled={transactionBusy}>Guardar cambios</button></div></form></section></div>}
      {editingBalances && <div className="supplier-modal-backdrop" role="presentation"><section className="supplier-balance-modal" role="dialog" aria-modal="true" aria-labelledby="supplier-balance-modal-title"><div className="supplier-modal-header"><div><small>CONFIGURACIÓN DE SALDOS</small><h2 id="supplier-balance-modal-title">Editar saldos de {selectedSupplier.name}</h2><p>Los cambios quedarán registrados en el historial del proveedor.</p></div><button type="button" onClick={() => setEditingBalances(false)} aria-label="Cerrar edición de saldos">×</button></div><form className="supplier-payment" onSubmit={(event) => editBalances(event, selectedSupplier)}><label>Reservado en efectivo<input required type="number" min="0" step="0.01" value={balances.reservedCashBalance} onChange={(event) => setBalances({ ...balances, reservedCashBalance: event.target.value })} placeholder="Importe" /></label><label>Reservado en Mercado Pago<input required type="number" min="0" step="0.01" value={balances.reservedMercadoPagoBalance} onChange={(event) => setBalances({ ...balances, reservedMercadoPagoBalance: event.target.value })} placeholder="Importe" /></label><label>Cuenta corriente<input required type="number" min="0" step="0.01" value={balances.currentAccountBalance} onChange={(event) => setBalances({ ...balances, currentAccountBalance: event.target.value })} placeholder="Importe" /></label><label>Motivo opcional<input maxLength="250" value={balances.note} onChange={(event) => setBalances({ ...balances, note: event.target.value })} placeholder="Ej.: saldo inicial del proveedor" /></label><div className="supplier-modal-buttons"><button type="button" className="supplier-modal-cancel" onClick={() => setEditingBalances(false)}>Cancelar</button><button>Guardar saldos</button></div></form></section></div>}
      <section className="supplier-summary">
        <div className="supplier-reserved-total"><span>Fondos reservados totales</span><strong>{money.format(reservedTotal)}</strong></div>
        <div><span>Reservado en efectivo</span><strong>{money.format(selectedSupplier.reservedCashBalance)}</strong></div>
        <div><span>Reservado en Mercado Pago</span><strong>{money.format(selectedSupplier.reservedMercadoPagoBalance)}</strong></div>
        <div><span>Cuenta corriente</span><strong>{money.format(selectedSupplier.currentAccountBalance)}</strong></div>
        <div><span>Compras a cuenta</span><strong>{money.format(purchaseTotal)}</strong></div>
        <div><span>Pagos realizados</span><strong>{money.format(paidTotal)}</strong></div>
      </section>
      <section className="supplier-detail-content">
        <section className="supplier-operation-panel">
          <div className="supplier-operation-switcher" role="tablist" aria-label="Operaciones del proveedor">
            <button type="button" className={operation === 'purchase' ? 'active' : ''} role="tab" aria-selected={operation === 'purchase'} onClick={() => setOperation('purchase')}>Comprar</button>
            <button type="button" className={operation === 'payment' ? 'active' : ''} role="tab" aria-selected={operation === 'payment'} onClick={() => setOperation('payment')}>Cancelar cuenta</button>
            <button type="button" className={operation === 'transfer' ? 'active' : ''} role="tab" aria-selected={operation === 'transfer'} onClick={() => setOperation('transfer')}>Transferir</button>
          </div>
          {operation === 'purchase' && <form className="supplier-payment supplier-payment-detail" onSubmit={(event) => registerPurchase(event, selectedSupplier)}>
            <div><small>REGISTRAR COMPRA</small><h2>Compra de mercadería</h2><p>Elegí si la compra usa los fondos reservados o queda en cuenta corriente. No modifica el stock.</p></div>
            <label>Forma de pago<select value={purchase.paymentMethod} onChange={(event) => setPurchase({ ...purchase, paymentMethod: event.target.value, cashAmount: '', mercadoPagoAmount: '', ...(event.target.value === 'reserved' ? { amount: '' } : {}) })}><option value="reserved">Con fondos reservados</option><option value="account">A cuenta corriente</option></select></label>
            <label>Importe<input type="number" min="0.01" step="0.01" value={purchase.amount} onChange={(event) => setPurchase({ ...purchase, amount: event.target.value })} placeholder="Importe" readOnly={purchase.paymentMethod === 'reserved'} />{purchase.paymentMethod === 'reserved' && <small className="supplier-input-hint">Se calcula automáticamente con la distribución del pago.</small>}</label>
            {purchase.paymentMethod === 'reserved' && <section className="supplier-split-section"><div className="supplier-split-heading"><div><small>DISTRIBUCIÓN DEL PAGO</small><b>¿Con qué fondos pagás?</b></div><span>Disponible: {money.format(reservedTotal)}</span></div><div className="supplier-payment-split"><label><span>Efectivo</span><small>Disponible: {money.format(selectedSupplier.reservedCashBalance)}</small><input type="number" min="0" max={selectedSupplier.reservedCashBalance} step="0.01" value={purchase.cashAmount} onChange={(event) => setPurchase({ ...purchase, cashAmount: event.target.value, amount: sumPaymentAmounts(event.target.value, purchase.mercadoPagoAmount) })} placeholder="$ 0" /></label><label><span>Mercado Pago</span><small>Disponible: {money.format(selectedSupplier.reservedMercadoPagoBalance)}</small><input type="number" min="0" max={selectedSupplier.reservedMercadoPagoBalance} step="0.01" value={purchase.mercadoPagoAmount} onChange={(event) => setPurchase({ ...purchase, mercadoPagoAmount: event.target.value, amount: sumPaymentAmounts(purchase.cashAmount, event.target.value) })} placeholder="$ 0" /></label></div>{purchaseAmount > 0 && <p className="supplier-split-status complete">Importe distribuido correctamente.</p>}</section>}
            <label>Detalle opcional<input maxLength="250" value={purchase.note} onChange={(event) => setPurchase({ ...purchase, note: event.target.value })} placeholder="Ej.: compra de mercadería" /></label>
            <button>Registrar compra</button>
          </form>}
          {operation === 'payment' && <form className="supplier-payment supplier-payment-detail" onSubmit={(event) => pay(event, selectedSupplier)}>
            <div><small>REGISTRAR PAGO</small><h2>Cancelar cuenta corriente</h2><p>El pago se descuenta de la deuda y de los fondos reservados del proveedor.</p></div>
            <div className="supplier-payment-split"><label>Efectivo disponible: {money.format(selectedSupplier.reservedCashBalance)}<input type="number" min="0" max={selectedSupplier.reservedCashBalance} step="0.01" disabled={!selectedSupplier.currentAccountBalance} value={payment[selectedSupplier.id]?.cashAmount ?? ''} onChange={(event) => setPayment({ ...payment, [selectedSupplier.id]: { ...payment[selectedSupplier.id], cashAmount: event.target.value } })} placeholder="Efectivo" /></label><label>Mercado Pago disponible: {money.format(selectedSupplier.reservedMercadoPagoBalance)}<input type="number" min="0" max={selectedSupplier.reservedMercadoPagoBalance} step="0.01" disabled={!selectedSupplier.currentAccountBalance} value={payment[selectedSupplier.id]?.mercadoPagoAmount ?? ''} onChange={(event) => setPayment({ ...payment, [selectedSupplier.id]: { ...payment[selectedSupplier.id], mercadoPagoAmount: event.target.value } })} placeholder="Mercado Pago" /></label></div>
            <button disabled={!selectedSupplier.currentAccountBalance || !selectedSupplier.reservedBalance}>Registrar pago</button>
          </form>}
          {operation === 'transfer' && <section className="supplier-transfer-actions"><div className="supplier-transfer-switcher" role="tablist" aria-label="Tipo de transferencia"><button type="button" className={transferMode === 'internal' ? 'active' : ''} role="tab" aria-selected={transferMode === 'internal'} onClick={() => setTransferMode('internal')}>Entre medios</button><button type="button" className={transferMode === 'supplier' ? 'active' : ''} role="tab" aria-selected={transferMode === 'supplier'} onClick={() => setTransferMode('supplier')}>A otro proveedor</button></div>{transferMode === 'internal' && <form className="supplier-payment supplier-payment-detail supplier-internal-transfer" onSubmit={(event) => exchangeReservedFunds(event, selectedSupplier)}>
            <div><small>MOVER ENTRE MEDIOS</small><h2>Reorganizar fondos</h2><p>Mové dinero entre efectivo y Mercado Pago sin cambiar el total reservado.</p></div>
            <label>Mover desde<select value={exchange.fromPaymentMethod} onChange={(event) => setExchange({ ...exchange, fromPaymentMethod: event.target.value })}><option value="cash">Efectivo ({money.format(selectedSupplier.reservedCashBalance)})</option><option value="mercado_pago">Mercado Pago ({money.format(selectedSupplier.reservedMercadoPagoBalance)})</option></select></label>
            <label>Importe<input type="number" min="0.01" max={exchange.fromPaymentMethod === 'cash' ? selectedSupplier.reservedCashBalance : selectedSupplier.reservedMercadoPagoBalance} step="0.01" value={exchange.amount} onChange={(event) => setExchange({ ...exchange, amount: event.target.value })} placeholder="Importe" /></label>
            <label>Detalle opcional<input maxLength="250" value={exchange.note} onChange={(event) => setExchange({ ...exchange, note: event.target.value })} placeholder="Motivo del movimiento" /></label>
            <button>Mover fondos</button>
          </form>}{transferMode === 'supplier' && <form className="supplier-payment supplier-payment-detail" onSubmit={(event) => transferReservedFunds(event, selectedSupplier)}>
            <div><small>TRANSFERIR FONDOS</small><h2>Enviar a otro proveedor</h2><p>El importe se descontará de los fondos reservados de {selectedSupplier.name} y se acreditará al destinatario.</p></div>
            <label>Proveedor destinatario<select required value={transfer.targetSupplierId} onChange={(event) => setTransfer({ ...transfer, targetSupplierId: event.target.value })}><option value="">Seleccionar proveedor</option>{transferTargets.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></label>
            <div className="supplier-payment-split"><label>Efectivo disponible: {money.format(selectedSupplier.reservedCashBalance)}<input type="number" min="0" max={selectedSupplier.reservedCashBalance} step="0.01" disabled={!transferTargets.length} value={transfer.cashAmount} onChange={(event) => setTransfer({ ...transfer, cashAmount: event.target.value })} placeholder="Efectivo" /></label><label>Mercado Pago disponible: {money.format(selectedSupplier.reservedMercadoPagoBalance)}<input type="number" min="0" max={selectedSupplier.reservedMercadoPagoBalance} step="0.01" disabled={!transferTargets.length} value={transfer.mercadoPagoAmount} onChange={(event) => setTransfer({ ...transfer, mercadoPagoAmount: event.target.value })} placeholder="Mercado Pago" /></label></div>
            <label>Detalle opcional<input maxLength="250" value={transfer.note} onChange={(event) => setTransfer({ ...transfer, note: event.target.value })} placeholder="Motivo de la transferencia" /></label>
            <button disabled={!selectedSupplier.reservedBalance || !transferTargets.length}>Transferir fondos</button>
          </form>}</section>}
        </section>
        <section className="supplier-movements"><div className="supplier-history-header"><div><small>HISTORIAL</small><h2>Movimientos del proveedor</h2></div><label>Filtrar<select value={historyFilter} onChange={(event) => setHistoryFilter(event.target.value)}><option value="all">Todos</option><option value="reservations">Reservas</option><option value="purchases">Compras</option><option value="payments">Pagos</option><option value="transfers">Transferencias</option><option value="adjustments">Ajustes</option></select></label></div>
          {visibleTransactions.length ? <div className="supplier-history">{visibleTransactions.map((transaction) => <div key={transaction.id} className={`supplier-history-item ${transaction.type}`}><div className="supplier-history-main"><span><b>{transactionLabel(transaction.type)}</b><small>{new Date(`${transaction.businessDate}T12:00:00`).toLocaleDateString('es-AR')}{transaction.shift ? ` · Turno ${transaction.shift === 'morning' ? 'mañana' : 'tarde'}` : ''}{transaction.note ? ` · ${transaction.note}` : ''}</small></span><strong className={`${transaction.type} ${transaction.amount < 0 ? 'debit' : 'credit'}`}>{transaction.type === 'reserved_exchange' ? '↔' : transaction.type === 'purchase' || transaction.type === 'allocation' || transaction.type === 'reserved_transfer_in' || (transaction.type === 'reserved_adjustment' && transaction.amount > 0) || (transaction.type === 'current_account_adjustment' && transaction.amount > 0) ? '+' : '−'}{money.format(Math.abs(transaction.amount))}</strong></div>{editableTransactionTypes.has(transaction.type) ? <details className="supplier-history-actions"><summary aria-label={`Acciones para ${transactionLabel(transaction.type)}`} title="Acciones del movimiento">⋮</summary><div><button type="button" onClick={() => beginTransactionEdit(transaction)}>Editar</button><button type="button" className="danger" disabled={transactionBusy} onClick={() => deleteTransaction(transaction, selectedSupplier)}>Eliminar</button></div></details> : <span className="supplier-history-action-placeholder" aria-hidden="true" />}</div>)}</div> : <p className="supplier-empty">{selectedSupplier.transactions.length ? 'No hay movimientos para este filtro.' : 'Este proveedor todavía no tiene movimientos.'}</p>}
        </section>
      </section>
    </div>
  }

  return <div className="suppliers-page">
    <header className="suppliers-list-header"><div><p className="eyebrow">CUENTAS CORRIENTES</p><h1>Proveedores</h1><p>Administrá compras a cuenta, pagos y el historial de cada proveedor.</p></div><button type="button" className="primary supplier-add-button" onClick={() => setCreatingSupplier(true)}>+ Nuevo proveedor</button></header>
    {message && <p className="supplier-message">{message}</p>}
    {creatingSupplier && <div className="supplier-modal-backdrop" role="presentation"><section className="supplier-balance-modal supplier-create-modal" role="dialog" aria-modal="true" aria-labelledby="supplier-create-modal-title"><div className="supplier-modal-header"><div><small>NUEVO PROVEEDOR</small><h2 id="supplier-create-modal-title">Agregar proveedor</h2><p>Creá el proveedor y luego cargá sus saldos desde el detalle.</p></div><button type="button" onClick={() => setCreatingSupplier(false)} aria-label="Cerrar alta de proveedor">×</button></div><form className="supplier-payment" onSubmit={create}><label>Nombre del proveedor<input required maxLength="100" autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="Ej.: Distribuidora Norte" /></label><div className="supplier-modal-buttons"><button type="button" className="supplier-modal-cancel" onClick={() => setCreatingSupplier(false)}>Cancelar</button><button>Crear proveedor</button></div></form></section></div>}
    <section className="supplier-overview"><div className="supplier-overview-total"><span>Fondos reservados de todos los proveedores</span><strong>{money.format(totalReservedCash + totalReservedMercadoPago)}</strong><small>{activeSuppliers.length} {activeSuppliers.length === 1 ? 'proveedor activo' : 'proveedores activos'}</small></div><div><span>Efectivo total</span><strong>{money.format(totalReservedCash)}</strong></div><div><span>Mercado Pago total</span><strong>{money.format(totalReservedMercadoPago)}</strong></div></section>
    <section className="supplier-grid">
      {activeSuppliers.map((supplier) => <article className={`supplier-card ${supplier.isSeparateCashBox ? 'separate-cash-box' : ''}`} key={supplier.id}>
        <header><div><small>PROVEEDOR</small><h2>{supplier.name}</h2>{supplier.isSeparateCashBox && <span className="supplier-card-cash-box-badge">Caja aparte</span>}</div></header>
        <div className="supplier-balance supplier-total-balance"><span>Fondos reservados totales</span><strong>{money.format(supplier.reservedCashBalance + supplier.reservedMercadoPagoBalance)}</strong></div>
        <div className="supplier-reserve-breakdown"><div><span>Efectivo</span><strong>{money.format(supplier.reservedCashBalance)}</strong></div><div><span>Mercado Pago</span><strong>{money.format(supplier.reservedMercadoPagoBalance)}</strong></div></div>
        <div className="supplier-balance supplier-current-account"><span>Cuenta corriente</span><strong>{money.format(supplier.currentAccountBalance)}</strong></div>
        <p className="supplier-card-meta">{supplier.transactions.length} {supplier.transactions.length === 1 ? 'movimiento registrado' : 'movimientos registrados'}</p>
        <button type="button" className="supplier-detail-link" onClick={() => setSelectedSupplierId(supplier.id)}>Ver detalles <span>→</span></button>
      </article>)}
      {!activeSuppliers.length && <p className="supplier-empty">Todavía no hay proveedores activos. Creá uno para reservar fondos durante el cierre de turno.</p>}
    </section>
  </div>
}
