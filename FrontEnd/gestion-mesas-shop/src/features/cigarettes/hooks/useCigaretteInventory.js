import { useState } from 'react'
import { filterStockProducts, inventoryRetailValue } from '../domain/inventoryView.js'

export default function useCigaretteInventory({ api, execute, dashboard, date, shift }) {
  const [product, setProduct] = useState({ name: '', price: '', initialStock: '' })
  const [purchase, setPurchase] = useState({ cigaretteProductId: '', quantity: '', totalCost: '', paymentMethod: 'cash' })
  const [stockSearch, setStockSearch] = useState('')
  const [stockFilter, setStockFilter] = useState('all')
  const [stockSort, setStockSort] = useState('name')
  const [purchaseSearch, setPurchaseSearch] = useState('')
  const [editing, setEditing] = useState(null)
  const [editingPurchase, setEditingPurchase] = useState(null)
  const [visibleProductCount, setVisibleProductCount] = useState(10)
  const addProduct = async (event) => {
    event.preventDefault()
    const saved = await execute(() => api('/cigarettes/products', { method: 'POST', body: JSON.stringify({ ...product, price: Number(product.price), initialStock: Number(product.initialStock) }) }), 'Cigarrillo agregado correctamente.')
    if (saved) {
      setProduct({ name: '', price: '', initialStock: '' })
      setStockSearch('')
      setStockFilter('all')
    }
    return saved
  }
  const saveProduct = async (event) => {
    event.preventDefault()
    const saved = await execute(() => api(`/cigarettes/products/${editing.id}`, { method: 'PUT', body: JSON.stringify({ name: editing.name, price: Number(editing.price), stock: Number(editing.stock) }) }), 'Producto actualizado.')
    if (saved) setEditing(null)
    return saved
  }
  const deleteProduct = (item) => execute(() => api(`/cigarettes/products/${item.id}`, { method: 'DELETE' }), 'Producto quitado correctamente.')
  const addPurchase = async (event) => {
    event.preventDefault()
    const saved = await execute(() => api('/cigarettes/purchases', { method: 'POST', body: JSON.stringify({ cigaretteProductId: Number(purchase.cigaretteProductId), quantity: Number(purchase.quantity), totalCost: Number(purchase.totalCost), paymentMethod: purchase.paymentMethod, businessDate: date, shift }) }), 'Compra registrada y stock actualizado.')
    if (saved) {
      setPurchase({ cigaretteProductId: '', quantity: '', totalCost: '', paymentMethod: 'cash' })
      setPurchaseSearch('')
    }
    return saved
  }
  const savePurchase = async (event) => {
    event.preventDefault()
    const saved = await execute(() => api(`/cigarettes/purchases/${editingPurchase.id}`, { method: 'PUT', body: JSON.stringify({ quantity: Number(editingPurchase.quantity), totalCost: editingPurchase.totalCost === '' || editingPurchase.totalCost == null ? null : Number(editingPurchase.totalCost), paymentMethod: editingPurchase.paymentMethod || 'cash' }) }), 'Compra actualizada y cierre recalculado.')
    if (saved) setEditingPurchase(null)
    return saved
  }
  const deletePurchase = (item) => execute(() => api(`/cigarettes/purchases/${item.id}`, { method: 'DELETE' }), 'Compra eliminada correctamente y cierre recalculado.')
  const purchases = dashboard.purchases.filter((item) => item.shift === shift)
  const purchasedUnits = purchases.reduce((total, item) => total + item.quantity, 0)
  const purchaseResults = purchaseSearch.trim() && !purchase.cigaretteProductId
    ? filterStockProducts(dashboard.products, { search: purchaseSearch })
    : []
  const filteredProducts = filterStockProducts(dashboard.products, { search: stockSearch, status: stockFilter, sort: stockSort })
  const visibleProducts = filteredProducts.slice(0, visibleProductCount)
  const inventoryValue = inventoryRetailValue(dashboard.products)
  const lowStockProducts = dashboard.products.filter((item) => item.stock > 0 && item.stock <= 5)
  const outOfStockProducts = dashboard.products.filter((item) => item.stock <= 0)
  const lowStockCount = lowStockProducts.length
  const outOfStockCount = outOfStockProducts.length

  return {
    product,
    setProduct,
    purchase,
    setPurchase,
    stockSearch,
    setStockSearch,
    stockFilter,
    setStockFilter,
    stockSort,
    setStockSort,
    purchaseSearch,
    setPurchaseSearch,
    editing,
    setEditing,
    editingPurchase,
    setEditingPurchase,
    visibleProductCount,
    setVisibleProductCount,
    addProduct,
    saveProduct,
    deleteProduct,
    addPurchase,
    savePurchase,
    deletePurchase,
    purchases,
    purchasedUnits,
    purchaseResults,
    filteredProducts,
    visibleProducts,
    inventoryValue,
    lowStockProducts,
    outOfStockProducts,
    lowStockCount,
    outOfStockCount
  }
}
