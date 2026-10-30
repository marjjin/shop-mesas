export default function PurchaseCostFields({ value, onChange, disabled, required = false }) {
  return <div className="inv-purchase-cost-fields">
    <label>Total de la compra ($)<input type="number" min="0" max="9999999999.99" step="0.01" inputMode="decimal" placeholder="0,00" required={required} value={value.totalCost ?? ''} disabled={disabled} onChange={(event) => onChange({ ...value, totalCost: event.target.value })} /></label>
    <label>Medio de pago<select value={value.paymentMethod || 'cash'} disabled={disabled} onChange={(event) => onChange({ ...value, paymentMethod: event.target.value })}><option value="cash">Efectivo</option><option value="mercadoPago">Mercado Pago</option></select></label>
    {!required && value.totalCost === '' && <small>Si dejás el importe vacío, se conserva el valor registrado.</small>}
  </div>
}
