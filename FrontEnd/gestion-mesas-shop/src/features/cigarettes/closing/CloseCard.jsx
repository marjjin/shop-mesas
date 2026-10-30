import CigaretteReservation from './CigaretteReservation.jsx'
import ClosingIcon from './ClosingIcon.jsx'
import { useState } from 'react'
import { printCigaretteShiftReceipt } from '../../printing/receipt.js'
import { getCloseFinancialSummary } from '../domain/closeFinancials.js'
import { shifts } from '../domain/businessDate.js'
import { money } from '../../../shared/utils/currency.js'

export default function CloseCard({ close, suppliers, onEdit, onDelete }) {
  const [open, setOpen] = useState(false)
  const { archaeologicalResult, cashTotal, shiftSales } = getCloseFinancialSummary(close, suppliers)
  const reservedTotal = (close.supplierAllocations || []).reduce((total, allocation) => total + allocation.amount, 0)
  return <article className="close-card">
    <button type="button" className="close-card-summary" onClick={() => setOpen(!open)} aria-expanded={open}>
      <span className={`shift-badge ${close.shift}`}>{shifts[close.shift]}</span>
      <span><small>FECHA</small><b>{new Date(`${close.businessDate}T12:00:00`).toLocaleDateString('es-AR')}</b></span>
      <span><small>CAJA</small><b>{money.format(cashTotal)}</b></span>
      <span><small>ARQUEO DE CAJA</small><b>{money.format(archaeologicalResult)}</b></span>
      <span className="calendar-cafeteria-total"><small>VENTA DEL TURNO</small><b>{money.format(shiftSales)}</b></span>
      <span className="close-card-action"><small>{open ? 'OCULTAR' : 'VER DETALLE'}</small><b>{open ? '−' : '+'}</b></span>
    </button>
    {open && <div className="close-card-detail"><section className="close-financial-section"><header><small>ARQUEO DEL TURNO</small><b>Saldos registrados al cierre</b></header><div className="closed-ending-balances"><span><b>Efectivo final</b><small>Arqueo de caja</small></span><strong>{money.format(close.endingCashBalance || 0)}</strong><span><b>Mercado Pago final</b><small>Arqueo de caja</small></span><strong>{money.format(close.endingMercadoPagoBalance || 0)}</strong></div><div className="close-financial-grid"><div className="closed-change-cash"><span><b>Total Posnet</b><small>Importe cobrado con terminales</small></span><strong>{money.format(close.posnetTotal || 0)}</strong></div><div className="closed-change-cash"><span><b>Cambio recibido</b><small>Del turno anterior</small></span><strong>{money.format(close.receivedChangeCash || 0)}</strong></div><div className="closed-change-cash"><span><b>Cambio preparado</b><small>Para el próximo turno</small></span><strong>{money.format(close.nextShiftChangeCash || 0)}</strong></div></div><div className="close-result-summary"><span><small>ARQUEO DE CAJA</small><b>{money.format(archaeologicalResult)}</b></span><span><small>CAJA</small><b>{money.format(cashTotal)}</b></span></div></section><section className="close-sales-section"><header><small>VENTAS Y RESERVAS</small><b>Detalle del cierre</b></header>{close.items.map((item) => <div className="close-sale-row" key={item.cigaretteProductId}><span><b>{item.productName}</b><small>{item.initialStock} inicial + {item.purchasedQuantity} compras − {item.finalStock} final</small></span><strong>{item.soldQuantity} × {money.format(item.unitPrice)}</strong><b>{money.format(item.salesAmount)}</b></div>)}<CigaretteReservation totalSales={close.totalSales} reservation={{ cash: close.cigaretteReservedCash, mercadoPago: close.cigaretteReservedMercadoPago }} readOnly /><div className="closed-cafeteria-summary"><span><b>Caja Cafetería</b><small>{close.cafeteria?.saleCount || 0} {(close.cafeteria?.saleCount || 0) === 1 ? 'venta' : 'ventas'}</small></span><strong>{money.format(close.cafeteria?.totalSales || 0)}</strong></div>{close.supplierAllocations?.length > 0 && <div className="closed-supplier-summary"><span><b>Reservas para proveedores</b><small>{close.supplierAllocations.map((allocation) => allocation.supplierName).join(', ')}</small></span>    <strong>{money.format(reservedTotal)}</strong></div>}</section><footer><button type="button" className="edit-close-button" onClick={() => onEdit(close)}><ClosingIcon name="edit" />Corregir cierre</button><button type="button" className="delete-close-button" onClick={() => onDelete(close)}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 6h18M9 6V4h6v2M5 6l1 14h12l1-14M10 10v6M14 10v6" /></svg>Eliminar cierre</button><button type="button" className="print-shift-ticket" onClick={() => printCigaretteShiftReceipt(close, suppliers)}><ClosingIcon name="print" />Imprimir ticket 80 mm</button></footer></div>}
  </article>
}
