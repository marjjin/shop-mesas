import { useState } from 'react'

export default function useCigaretteInventory({ api, execute, dashboard, date, shift }) {
  const [product, setProduct] = useState({ name: '', price: '', initialStock: '' })
  const [purchase, setPurchase] = useState({ cigaretteProductId: '', quantity: '' })
  const [stockSearch, setStockSearch] = useState('')
  const [purchaseSearch, setPurchaseSearch] = useState('')
  const [editing, setEditing] = useState(null)
  const [editingPurchase, setEditingPurchase] = useState(null)
  const [visibleProductCount, setVisibleProductCount] = useState(10)
  const addProduct = async (event) => {
    event.preventDefault()
    const saved = await execute(() => api('/cigarettes/products', { method: 'POST', body: JSON.stringify({ ...product, price: Number(product.price), initialStock: Number(product.initialStock) }) }), 'Cigarrillo agregado correctamente.')
    if (saved) setProduct({ name: '', price: '', initialStock: '' })
  }
  const saveProduct = async (event) => {
    event.preventDefault()
    const saved = await execute(() => api(`/cigarettes/products/${editing.id}`, { method: 'PUT', body: JSON.stringify({ name: editing.name, price: Number(editing.price), stock: Number(editing.stock) }) }), 'Producto actualizado.')
    if (saved) setEditing(null)
  }
  const deleteProduct = (item) => {
    if (window.confirm(`¿Quitar ${item.name}?`))
      execute(() => api(`/cigarettes/products/${item.id}`, { method: 'DELETE' }), 'Producto quitado.')
  }
  const addPurchase = async (event) => {
    event.preventDefault()
    const saved = await execute(() => api('/cigarettes/purchases', { method: 'POST', body: JSON.stringify({ cigaretteProductId: Number(purchase.cigaretteProductId), quantity: Number(purchase.quantity), businessDate: date, shift }) }), 'Compra registrada y stock actualizado.')
    if (saved) {
      setPurchase({ cigaretteProductId: '', quantity: '' })
      setPurchaseSearch('')
    }
  }
  const savePurchase = async (event) => {
    event.preventDefault()
    const saved = await execute(() => api(`/cigarettes/purchases/${editingPurchase.id}`, { method: 'PUT', body: JSON.stringify({ quantity: Number(editingPurchase.quantity) }) }), 'Compra actualizada y cierre recalculado.')
    if (saved) setEditingPurchase(null)
  }
  const deletePurchase = async (item) => {
    if (!window.confirm(`¿Quitar la compra de ${item.quantity} unidades de ${item.productName}? El stock se descontará.`)) return
    await execute(() => api(`/cigarettes/purchases/${item.id}`, { method: 'DELETE' }), 'Compra eliminada y cierre recalculado.')
  }
  const purchases = dashboard.purchases.filter((item) => item.shift === shift)
  const purchasedUnits = purchases.reduce((total, item) => total + item.quantity, 0)
  const purchaseResults = purchaseSearch.trim() && !purchase.cigaretteProductId
    ? dashboard.products.filter((item) => item.name.toLowerCase().includes(purchaseSearch.trim().toLowerCase()))
    : []
  const filteredProducts = dashboard.products.filter((item) => item.name.toLowerCase().includes(stockSearch.trim().toLowerCase()))
  const visibleProducts = filteredProducts.slice(0, visibleProductCount)
  const inventoryValue = dashboard.products.reduce((total, item) => total + item.stock * item.price, 0)
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
