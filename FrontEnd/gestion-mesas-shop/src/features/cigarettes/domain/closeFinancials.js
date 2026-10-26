export function getCloseFinancialSummary(close, suppliers) {
  const cashDropsTotal = close.cashDropsTotal ?? (close.cashDrops || []).reduce((total, drop) => total + drop.amount, 0)
  const archaeologicalResult = (close.endingCashBalance || 0) + cashDropsTotal + (close.endingMercadoPagoBalance || 0) + (close.posnetTotal || 0) + (close.nextShiftChangeCash || 0) - (close.receivedChangeCash || 0)
  const separateSupplierIds = new Set(suppliers.filter((supplier) => supplier.isSeparateCashBox).map((supplier) => supplier.id))
  const normalSupplierReservations = (close.supplierAllocations || []).filter((allocation) => !separateSupplierIds.has(allocation.supplierId))
    .reduce((total, allocation) => total + allocation.amount, 0)
  const separateCashBoxReservations = (close.supplierAllocations || []).filter((allocation) => separateSupplierIds.has(allocation.supplierId))
    .reduce((total, allocation) => total + allocation.amount, 0)
  return {
    archaeologicalResult,
    cashDropsTotal,
    cashInBox: (close.endingCashBalance || 0) + cashDropsTotal,
    normalSupplierReservations,
    separateCashBoxReservations,
    cashTotal: archaeologicalResult - normalSupplierReservations - close.totalSales - (close.cafeteria?.totalSales || 0),
    shiftSales: archaeologicalResult + separateCashBoxReservations
  }
}

// Both new and corrected closes use the same editable balances and reservations.
export function getDraftFinancialSummary({ endingBalances, cashDrops, suppliers, allocations, cafeteriaTotal, totalSales }) {
  const cashDropsTotal = cashDrops.reduce((total, drop) => total + drop.amount, 0)
  const archaeologicalResult = Number(endingBalances.cash || 0) + cashDropsTotal + Number(endingBalances.mercadoPago || 0) + Number(endingBalances.posnet || 0) + Number(endingBalances.change || 0) - Number(endingBalances.receivedChange || 0)
  const normalSupplierReservations = suppliers.filter((supplier) => !supplier.isSeparateCashBox)
    .reduce((total, supplier) => total + Number(allocations[supplier.id]?.cashAmount || 0) + Number(allocations[supplier.id]?.mercadoPagoAmount || 0), 0)
  const cashTotal = archaeologicalResult - normalSupplierReservations - cafeteriaTotal - totalSales
  const separateCashBoxTotal = suppliers.filter((supplier) => supplier.isSeparateCashBox)
    .reduce((total, supplier) => total + Number(allocations[supplier.id]?.cashAmount || 0) + Number(allocations[supplier.id]?.mercadoPagoAmount || 0), 0)
  const dailySalesTotal = archaeologicalResult + separateCashBoxTotal
  return { archaeologicalResult, cashDropsTotal, cashTotal, separateCashBoxTotal, dailySalesTotal }
}
