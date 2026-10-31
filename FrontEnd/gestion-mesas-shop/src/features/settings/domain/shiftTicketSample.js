// Cierre ficticio para la vista previa: incluye datos en todos los bloques.
export const sampleSuppliers = [{ id: 1, isSeparateCashBox: false }, { id: 2, isSeparateCashBox: true }]

export const sampleClose = {
  businessDate: '2026-01-15', shift: 'morning', closedAt: '2026-01-15T15:00:00Z',
  totalSales: 24000, totalSold: 4,
  items: [{ productName: 'Producto de ejemplo', soldQuantity: 4, unitPrice: 6000, salesAmount: 24000, initialStock: 20, purchasedQuantity: 10, finalStock: 26 }],
  cigaretteReservedCash: 15000, cigaretteReservedMercadoPago: 9000,
  cafeteria: { saleCount: 2, totalSales: 8000, items: [{ productName: 'Café', quantity: 2, unitPrice: 4000, totalSales: 8000 }] },
  supplierAllocations: [
    { supplierId: 1, supplierName: 'Proveedor de ejemplo', amount: 20000, cashAmount: 20000, mercadoPagoAmount: 0, balance: 50000 },
    { supplierId: 2, supplierName: 'Proveedor con caja aparte', amount: 5000, cashAmount: 0, mercadoPagoAmount: 5000, balance: 5000 },
  ],
  cashDrops: [{ createdAt: '2026-01-15T13:00:00Z', amount: 20000 }], cashDropsTotal: 20000,
  endingCashBalance: 50000, endingMercadoPagoBalance: 30000, posnetTotal: 10000, nextShiftChangeCash: 15000, receivedChangeCash: 10000,
}
