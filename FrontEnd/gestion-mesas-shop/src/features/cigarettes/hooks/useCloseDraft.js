import { useState } from 'react'
import { getCloseDraft, saveCloseDraft, clearCloseDraft } from '../domain/closeDrafts.js'

export default function useCloseDraft({ products, date, shift, previousChangeCash, onAllocationsChange }) {
  const [storedDraft] = useState(() => getCloseDraft(date, shift))
  const [finalStocks, setFinalStocks] = useState(() => Object.fromEntries(products.map((product) => [product.id, storedDraft?.finalStocks?.[product.id] ?? product.stock])))
  const [cigaretteReservation, setCigaretteReservation] = useState(() => storedDraft?.cigaretteReservation || { cash: '', mercadoPago: '' })
  const [hasDraft, setHasDraft] = useState(Boolean(storedDraft))
  const [endingBalances, setEndingBalances] = useState(() => storedDraft?.endingBalances || { cash: '', mercadoPago: '', posnet: '', receivedChange: '', change: '' })
  const [receivedChangeEdited, setReceivedChangeEdited] = useState(() => Object.hasOwn(storedDraft?.endingBalances || {}, 'receivedChange'))
  const [appliedPreviousChange, setAppliedPreviousChange] = useState(null)

  // Only a newly loaded previous shift can fill an untouched field. Keeping the
  // last applied value also preserves the user's explicit discard of a draft.
  if (previousChangeCash !== appliedPreviousChange) {
    setAppliedPreviousChange(previousChangeCash)
    if (!receivedChangeEdited && previousChangeCash !== null)
      setEndingBalances((balances) => ({ ...balances, receivedChange: String(previousChangeCash) }))
  }

  const changeFinalStock = (productId, value) => {
    const updated = { ...finalStocks, [productId]: value }
    setFinalStocks(updated)
    saveCloseDraft(date, shift, { finalStocks: updated })
    setHasDraft(true)
  }
  const changeEndingBalances = (updated) => {
    setEndingBalances(updated)
    saveCloseDraft(date, shift, { endingBalances: updated })
    setHasDraft(true)
  }
  const changeAllocations = (updated) => {
    onAllocationsChange(updated)
    saveCloseDraft(date, shift, { supplierAllocations: updated })
    setHasDraft(true)
  }
  const changeCigaretteReservation = (updated) => {
    setCigaretteReservation(updated)
    saveCloseDraft(date, shift, { cigaretteReservation: updated })
    setHasDraft(true)
  }
  const discardDraft = () => {
    clearCloseDraft(date, shift)
    setFinalStocks(Object.fromEntries(products.map((product) => [product.id, product.stock])))
    setEndingBalances({ cash: '', mercadoPago: '', posnet: '', receivedChange: '', change: '' })
    onAllocationsChange({})
    setCigaretteReservation({ cash: '', mercadoPago: '' })
    setHasDraft(false)
  }

  return { cigaretteReservation, changeCigaretteReservation, finalStocks, hasDraft, endingBalances, setReceivedChangeEdited, changeFinalStock, changeEndingBalances, changeAllocations, discardDraft }
}
