import SupplierIcon from './SupplierIcon.jsx'
import { money } from '../../../shared/utils/currency.js'
import { sumPaymentAmounts } from '../domain/transactions.js'

export default function SupplierOperations({
  operation,
  setOperation,
  registerPurchase,
  selectedSupplier,
  purchase,
  setPurchase,
  reservedTotal,
  purchaseAmount,
  pay,
  payment,
  setPayment,
  transferMode,
  setTransferMode,
  exchangeReservedFunds,
  exchange,
  setExchange,
  transferReservedFunds,
  transfer,
  setTransfer,
  transferTargets
}) {
  return <section className="supplier-operation-panel">
          <div className="supplier-panel-heading"><span className="supplier-panel-icon"><SupplierIcon name="transfer" /></span><div><h2>Operaciones</h2><p>Compras, pagos y transferencias.</p></div></div>
          <div className="supplier-operation-switcher" role="tablist" aria-label="Operaciones del proveedor">
            <button type="button" className={operation === 'purchase' ? 'active' : ''} role="tab" aria-selected={operation === 'purchase'} onClick={() => setOperation('purchase')}><SupplierIcon name="purchase" />Comprar</button>
            <button type="button" className={operation === 'payment' ? 'active' : ''} role="tab" aria-selected={operation === 'payment'} onClick={() => setOperation('payment')}><SupplierIcon name="account" />Cancelar cuenta</button>
            <button type="button" className={operation === 'transfer' ? 'active' : ''} role="tab" aria-selected={operation === 'transfer'} onClick={() => setOperation('transfer')}><SupplierIcon name="transfer" />Transferir</button>
          </div>
          {operation === 'purchase' && <form className="supplier-payment supplier-payment-detail" onSubmit={(event) => registerPurchase(event, selectedSupplier)}>
            <div><small>REGISTRAR COMPRA</small><h2>Compra de mercadería</h2><p>Elegí si la compra usa los fondos reservados o queda en cuenta corriente. No modifica el stock.</p></div>
            <label>Forma de pago<select value={purchase.paymentMethod} onChange={(event) => setPurchase({ ...purchase, paymentMethod: event.target.value, cashAmount: '', mercadoPagoAmount: '', ...(event.target.value === 'reserved' ? { amount: '' } : {}) })}><option value="reserved">Con fondos reservados</option><option value="account">A cuenta corriente</option></select></label>
            <label>Importe<input type="number" min="0.01" step="0.01" value={purchase.amount} onChange={(event) => setPurchase({ ...purchase, amount: event.target.value })} placeholder="Importe" readOnly={purchase.paymentMethod === 'reserved'} />{purchase.paymentMethod === 'reserved' && <small className="supplier-input-hint">Se calcula automáticamente con la distribución del pago.</small>}</label>
            {purchase.paymentMethod === 'reserved' && <section className="supplier-split-section"><div className="supplier-split-heading"><div><small>DISTRIBUCIÓN DEL PAGO</small><b>¿Con qué fondos pagás?</b></div><span>Disponible: {money.format(reservedTotal)}</span></div><div className="supplier-payment-split"><label><span>Efectivo</span><small>Disponible: {money.format(selectedSupplier.reservedCashBalance)}</small><input type="number" min="0" max={selectedSupplier.reservedCashBalance} step="0.01" value={purchase.cashAmount} onChange={(event) => setPurchase({ ...purchase, cashAmount: event.target.value, amount: sumPaymentAmounts(event.target.value, purchase.mercadoPagoAmount) })} placeholder="$ 0" /></label><label><span>Mercado Pago</span><small>Disponible: {money.format(selectedSupplier.reservedMercadoPagoBalance)}</small><input type="number" min="0" max={selectedSupplier.reservedMercadoPagoBalance} step="0.01" value={purchase.mercadoPagoAmount} onChange={(event) => setPurchase({ ...purchase, mercadoPagoAmount: event.target.value, amount: sumPaymentAmounts(purchase.cashAmount, event.target.value) })} placeholder="$ 0" /></label></div>{purchaseAmount > 0 && <p className="supplier-split-status complete">Importe distribuido correctamente.</p>}</section>}
            <label>Detalle opcional<input maxLength="250" value={purchase.note} onChange={(event) => setPurchase({ ...purchase, note: event.target.value })} placeholder="Ej.: compra de mercadería" /></label>
            <button><SupplierIcon name="purchase" />Registrar compra</button>
          </form>}
          {operation === 'payment' && <form className="supplier-payment supplier-payment-detail" onSubmit={(event) => pay(event, selectedSupplier)}>
            <div><small>REGISTRAR PAGO</small><h2>Cancelar cuenta corriente</h2><p>El pago se descuenta de la deuda y de los fondos reservados del proveedor.</p></div>
            <div className="supplier-payment-split"><label>Efectivo disponible: {money.format(selectedSupplier.reservedCashBalance)}<input type="number" min="0" max={selectedSupplier.reservedCashBalance} step="0.01" disabled={!selectedSupplier.currentAccountBalance} value={payment[selectedSupplier.id]?.cashAmount ?? ''} onChange={(event) => setPayment({ ...payment, [selectedSupplier.id]: { ...payment[selectedSupplier.id], cashAmount: event.target.value } })} placeholder="Efectivo" /></label><label>Mercado Pago disponible: {money.format(selectedSupplier.reservedMercadoPagoBalance)}<input type="number" min="0" max={selectedSupplier.reservedMercadoPagoBalance} step="0.01" disabled={!selectedSupplier.currentAccountBalance} value={payment[selectedSupplier.id]?.mercadoPagoAmount ?? ''} onChange={(event) => setPayment({ ...payment, [selectedSupplier.id]: { ...payment[selectedSupplier.id], mercadoPagoAmount: event.target.value } })} placeholder="Mercado Pago" /></label></div>
            <button disabled={!selectedSupplier.currentAccountBalance || !selectedSupplier.reservedBalance}><SupplierIcon name="check" />Registrar pago</button>
          </form>}
          {operation === 'transfer' && <section className="supplier-transfer-actions"><div className="supplier-transfer-switcher" role="tablist" aria-label="Tipo de transferencia"><button type="button" className={transferMode === 'internal' ? 'active' : ''} role="tab" aria-selected={transferMode === 'internal'} onClick={() => setTransferMode('internal')}>Entre medios</button><button type="button" className={transferMode === 'supplier' ? 'active' : ''} role="tab" aria-selected={transferMode === 'supplier'} onClick={() => setTransferMode('supplier')}>A otro proveedor</button></div>{transferMode === 'internal' && <form className="supplier-payment supplier-payment-detail supplier-internal-transfer" onSubmit={(event) => exchangeReservedFunds(event, selectedSupplier)}>
            <div><small>MOVER ENTRE MEDIOS</small><h2>Reorganizar fondos</h2><p>Mové dinero entre efectivo y Mercado Pago sin cambiar el total reservado.</p></div>
            <label>Mover desde<select value={exchange.fromPaymentMethod} onChange={(event) => setExchange({ ...exchange, fromPaymentMethod: event.target.value })}><option value="cash">Efectivo ({money.format(selectedSupplier.reservedCashBalance)})</option><option value="mercado_pago">Mercado Pago ({money.format(selectedSupplier.reservedMercadoPagoBalance)})</option></select></label>
            <label>Importe<input type="number" min="0.01" max={exchange.fromPaymentMethod === 'cash' ? selectedSupplier.reservedCashBalance : selectedSupplier.reservedMercadoPagoBalance} step="0.01" value={exchange.amount} onChange={(event) => setExchange({ ...exchange, amount: event.target.value })} placeholder="Importe" /></label>
            <label>Detalle opcional<input maxLength="250" value={exchange.note} onChange={(event) => setExchange({ ...exchange, note: event.target.value })} placeholder="Motivo del movimiento" /></label>
            <button><SupplierIcon name="transfer" />Mover fondos</button>
          </form>}{transferMode === 'supplier' && <form className="supplier-payment supplier-payment-detail" onSubmit={(event) => transferReservedFunds(event, selectedSupplier)}>
            <div><small>TRANSFERIR FONDOS</small><h2>Enviar a otro proveedor</h2><p>El importe se descontará de los fondos reservados de {selectedSupplier.name} y se acreditará al destinatario.</p></div>
            <label>Proveedor destinatario<select required value={transfer.targetSupplierId} onChange={(event) => setTransfer({ ...transfer, targetSupplierId: event.target.value })}><option value="">Seleccionar proveedor</option>{transferTargets.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></label>
            <div className="supplier-payment-split"><label>Efectivo disponible: {money.format(selectedSupplier.reservedCashBalance)}<input type="number" min="0" max={selectedSupplier.reservedCashBalance} step="0.01" disabled={!transferTargets.length} value={transfer.cashAmount} onChange={(event) => setTransfer({ ...transfer, cashAmount: event.target.value })} placeholder="Efectivo" /></label><label>Mercado Pago disponible: {money.format(selectedSupplier.reservedMercadoPagoBalance)}<input type="number" min="0" max={selectedSupplier.reservedMercadoPagoBalance} step="0.01" disabled={!transferTargets.length} value={transfer.mercadoPagoAmount} onChange={(event) => setTransfer({ ...transfer, mercadoPagoAmount: event.target.value })} placeholder="Mercado Pago" /></label></div>
            <label>Detalle opcional<input maxLength="250" value={transfer.note} onChange={(event) => setTransfer({ ...transfer, note: event.target.value })} placeholder="Motivo de la transferencia" /></label>
            <button disabled={!selectedSupplier.reservedBalance || !transferTargets.length}><SupplierIcon name="transfer" />Transferir fondos</button>
          </form>}</section>}
        </section>
}
