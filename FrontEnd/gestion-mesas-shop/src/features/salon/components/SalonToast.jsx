import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import SalonIcon from './SalonIcon.jsx'
import '../styles/SalonToast.css'

export default function SalonToast({ message, onDismiss }) {
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const saleRegistered = message === 'Venta de cafetería registrada.'

  useEffect(() => {
    if (!saleRegistered || hovered || focused) return
    const timer = setTimeout(() => onDismiss(message), 5000)
    return () => clearTimeout(timer)
  }, [message, saleRegistered, hovered, focused, onDismiss])

  return createPortal(<div className="salon-toast" onPointerEnter={() => setHovered(true)} onPointerLeave={() => setHovered(false)} onFocusCapture={() => setFocused(true)} onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false) }}>
    <span className="salon-toast-icon"><SalonIcon name={saleRegistered ? 'check' : 'info'} /></span>
    <span className="salon-toast-message" role="status" aria-atomic="true">{message}</span>
    <button type="button" className="salon-toast-close" aria-label="Cerrar notificación" onClick={() => onDismiss(message)}><SalonIcon name="close" /></button>
  </div>, document.body)
}
