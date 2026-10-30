import { preciseMoney as money } from '../../../shared/utils/currency.js'

export function cigaretteReservationReceiptMarkup(close) {
  const cash = close.cigaretteReservedCash
  const mercadoPago = close.cigaretteReservedMercadoPago
  const incomplete = cash == null || mercadoPago == null
  return `<section class="turn-block cigarette-reserve"><h3>RESERVA DE CIGARRILLOS</h3><div class="cash-row"><span>Efectivo reservado</span><b>${cash == null ? 'Sin registrar' : money.format(cash)}</b></div><div class="cash-row"><span>Mercado Pago reservado</span><b>${mercadoPago == null ? 'Sin registrar' : money.format(mercadoPago)}</b></div><div class="cash-total"><span>Total reservado para cigarrillos</span><b>${incomplete ? 'Incompleto' : money.format(cash + mercadoPago)}</b></div></section>`
}
