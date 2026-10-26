import { useCallback, useEffect, useState } from 'react'
import { normalizeSuppliers } from '../domain/transactions.js'

export default function useSupplierAccounts({ api, setMessage }) {
  const [suppliers, setSuppliers] = useState([])
  const [name, setName] = useState('')
  const [balances, setBalances] = useState({ reservedCashBalance: '', reservedMercadoPagoBalance: '', currentAccountBalance: '', note: '' })
  const [editingBalances, setEditingBalances] = useState(false)
  const [creatingSupplier, setCreatingSupplier] = useState(false)
  const [selectedSupplierId, setSelectedSupplierId] = useState(() => {
    const storedSupplierId = Number(sessionStorage.getItem('mesa-supplier-id'))
    return Number.isInteger(storedSupplierId) && storedSupplierId > 0 ? storedSupplierId : null
  })
  const load = useCallback(async () => {
    try { setSuppliers(normalizeSuppliers(await api('/suppliers'))); setMessage('') } catch (error) { setMessage(error.message) }
  }, [api, setMessage])
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

  return {
    suppliers,
    name,
    setName,
    creatingSupplier,
    setCreatingSupplier,
    selectedSupplierId,
    setSelectedSupplierId,
    balances,
    setBalances,
    editingBalances,
    setEditingBalances,
    load,
    create,
    editBalances,
    deactivate,
    setSeparateCashBox
  }
}
