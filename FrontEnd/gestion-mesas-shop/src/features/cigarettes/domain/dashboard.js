export function normalizeCigaretteDashboard(value) {
  const dashboard = value && typeof value === 'object' ? value : {}
  return {
    ...dashboard,
    products: Array.isArray(dashboard.products) ? dashboard.products : [],
    purchases: Array.isArray(dashboard.purchases) ? dashboard.purchases : [],
    closes: Array.isArray(dashboard.closes) ? dashboard.closes.map((close) => ({
      ...close,
      items: Array.isArray(close.items) ? close.items : [],
      supplierAllocations: Array.isArray(close.supplierAllocations) ? close.supplierAllocations : [],
      cashDrops: Array.isArray(close.cashDrops) ? close.cashDrops : [],
      cafeteria: close.cafeteria || { saleCount: 0, totalSales: 0, items: [] }
    })) : [],
    cashDrops: Array.isArray(dashboard.cashDrops) ? dashboard.cashDrops : []
  }
}

export function buildMonthlyRanking(closes) {
  return [...(Array.isArray(closes) ? closes : []).flatMap((close) => Array.isArray(close.items) ? close.items : []).reduce((sales, item) => {
    const current = sales.get(item.cigaretteProductId) || { id: item.cigaretteProductId, name: item.productName, quantity: 0 }
    sales.set(item.cigaretteProductId, { ...current, quantity: current.quantity + item.soldQuantity })
    return sales
  }, new Map()).values()].sort((left, right) => right.quantity - left.quantity || left.name.localeCompare(right.name, 'es'))
}
