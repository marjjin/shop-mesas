import { useEffect, useRef, useState } from 'react'
import { canvasBlob } from './scanClient.js'
import InvoiceIcon from '../ui/InvoiceIcon.jsx'

export default function CameraCapture({ onImage, busy }) {
  const [stream, setStream] = useState(null)
  const [starting, setStarting] = useState(false)
  const [ready, setReady] = useState(false)
  const [capturing, setCapturing] = useState(false)
  const [error, setError] = useState('')
  const video = useRef(null)
  const currentStream = useRef(null)
  const mounted = useRef(false)
  const stop = () => { currentStream.current?.getTracks().forEach((track) => track.stop()); currentStream.current = null; setStream(null); setReady(false) }
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; currentStream.current?.getTracks().forEach((track) => track.stop()) } }, [])
  useEffect(() => { if (video.current && stream) video.current.srcObject = stream }, [stream])
  const start = async () => {
    if (!navigator.mediaDevices?.getUserMedia) { setError('La cámara necesita una conexión HTTPS o localhost. También podés usar «Elegir imagen».'); return }
    setStarting(true); setError('')
    try {
      const media = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false })
      if (!mounted.current) { media.getTracks().forEach((track) => track.stop()); return }
      currentStream.current = media; setStream(media)
    } catch { if (mounted.current) setError('No se pudo abrir la cámara. Revisá el permiso del navegador o elegí una imagen.') }
    finally { if (mounted.current) setStarting(false) }
  }
  const capture = async () => {
    if (capturing) return
    setCapturing(true)
    try {
      const canvas = document.createElement('canvas')
      canvas.width = video.current.videoWidth; canvas.height = video.current.videoHeight
      canvas.getContext('2d').drawImage(video.current, 0, 0)
      const blob = await canvasBlob(canvas, .92)
      if (mounted.current) { stop(); onImage(new File([blob], 'captura.jpg', { type: 'image/jpeg' })) }
    } catch { if (mounted.current) setError('No se pudo capturar la página. Intentá nuevamente.') }
    finally { if (mounted.current) setCapturing(false) }
  }
  return <div className="invoice-camera">
    {stream ? <><div className="invoice-camera-video"><video ref={video} autoPlay muted playsInline onLoadedData={() => setReady(true)} /><span aria-hidden="true" /></div><div className="invoice-dialog-actions"><button type="button" className="invoice-button secondary" disabled={busy} onClick={stop}>Cerrar cámara</button><button type="button" className="invoice-button primary" disabled={busy || !ready} onClick={capture}><InvoiceIcon name="scan" />Capturar página</button></div></> : <div className="invoice-capture-choice"><span className="invoice-capture-symbol"><InvoiceIcon name="scan" /></span><h3>Escanear una factura</h3><p>Apoyala sobre una superficie plana, con buena luz y los bordes visibles.</p><div><button type="button" className="invoice-button primary" disabled={busy || starting} onClick={start}><InvoiceIcon name="camera" />{starting ? 'Abriendo cámara…' : 'Abrir cámara'}</button><label className={`invoice-button secondary${busy ? ' disabled' : ''}`}><InvoiceIcon name="image" />Elegir imagen<input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" disabled={busy} onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; if (file) onImage(file) }} /></label></div><small>JPG, PNG o WebP · Hasta 20 MB por imagen</small></div>}
    {error && <p className="invoice-error" role="alert">{error}</p>}
  </div>
}
