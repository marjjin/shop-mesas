import { useCallback, useEffect, useRef, useState } from 'react'
import { openReceiptPrintWindow, printCashDropReceipt } from '../../printing/receipt.js'
import { money } from '../../../shared/utils/currency.js'
import { localDateValue } from '../cashDropPresentation.js'

export default function useCashDrops(api) {
  const [date, setDate] = useState(localDateValue())
  const [openShift, setOpenShift] = useState(null)
  const [drops, setDrops] = useState({ morning: [], afternoon: [] })
  const [amount, setAmount] = useState('')
  const [editing, setEditing] = useState(null)
  const [editingAmount, setEditingAmount] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [loadedDate, setLoadedDate] = useState(null)
  const loadId = useRef(0)
  const amountInputRef = useRef(null)

  const load = useCallback(async () => {
    const currentLoadId = ++loadId.current
    try {
      const [open, morning, afternoon] = await Promise.all([
        api(`/cash-drops/open?date=${date}`),
        api(`/cash-drops?date=${date}&shift=morning`),
        api(`/cash-drops?date=${date}&shift=afternoon`)
      ])
      if (currentLoadId !== loadId.current) return
      setOpenShift(open.shift ? { date: open.businessDate, shift: open.shift } : null)
      setDrops({ morning, afternoon })
      setMessage('')
    } catch (error) {
      if (currentLoadId === loadId.current) setMessage(error.message || 'No se pudieron cargar las tiradas.')
    } finally {
      if (currentLoadId === loadId.current) setLoadedDate(date)
    }
  }, [api, date])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (openShift) amountInputRef.current?.focus()
  }, [openShift, date])

  const activeDrops = openShift ? drops[openShift.shift] : []
  const activeTotal = activeDrops.reduce((total, drop) => total + drop.amount, 0)
  const totalForDate = [...drops.morning, ...drops.afternoon].reduce((total, drop) => total + drop.amount, 0)

  const create = async (event) => {
    event.preventDefault()
    const parsedAmount = Number(amount)
    if (!openShift) return setMessage('No hay un turno abierto para registrar tiradas.')
    if (!parsedAmount || parsedAmount <= 0) return setMessage('Ingresá un importe válido.')
    setBusy(true)
    const printWindow = openReceiptPrintWindow()
    try {
      const createdDrop = await api('/cash-drops', { method: 'POST', body: JSON.stringify({ amount: parsedAmount, businessDate: openShift.date, shift: openShift.shift }) })
      setAmount('')
      const printed = printCashDropReceipt(createdDrop, printWindow)
      await load()
      setMessage(printed ? 'Tirada registrada. Se abrió el ticket para imprimir.' : 'Tirada registrada correctamente. Habilitá las ventanas emergentes para imprimir el ticket automáticamente.')
      amountInputRef.current?.focus()
    } catch (error) {
      if (printWindow && !printWindow.closed) printWindow.close()
      setMessage(error.message)
    } finally {
      setBusy(false)
    }
  }

  const save = async (event) => {
    event.preventDefault()
    const parsedAmount = Number(editingAmount)
    if (!parsedAmount || parsedAmount <= 0) return setMessage('Ingresá un importe válido.')
    setBusy(true)
    try {
      await api(`/cash-drops/${editing.id}`, { method: 'PUT', body: JSON.stringify({ amount: parsedAmount }) })
      setEditing(null)
      await load()
      setMessage('Tirada actualizada correctamente.')
    } catch (error) {
      setMessage(error.message)
    } finally {
      setBusy(false)
    }
  }

  const remove = async (drop) => {
    if (!window.confirm(`¿Eliminar la tirada de ${money.format(drop.amount)}?`)) return
    setBusy(true)
    try {
      await api(`/cash-drops/${drop.id}`, { method: 'DELETE' })
      await load()
      setMessage('Tirada eliminada correctamente.')
    } catch (error) {
      setMessage(error.message)
    } finally {
      setBusy(false)
    }
  }

  const print = (drop) => {
    if (!printCashDropReceipt(drop)) setMessage('No se pudo abrir el ticket. Habilitá las ventanas emergentes del navegador.')
  }


  return { date, setDate, openShift, drops, amount, setAmount, editing, setEditing,
    editingAmount, setEditingAmount, message, busy, amountInputRef, activeDrops,
    activeTotal, totalForDate, create, save, remove, print, loading: loadedDate !== date }
}
