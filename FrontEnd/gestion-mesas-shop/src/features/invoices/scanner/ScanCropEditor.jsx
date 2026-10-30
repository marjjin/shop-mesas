import { useRef, useState } from 'react'
import { defaultCorners, isValidQuad } from './geometry.js'

const names = ['superior izquierda', 'superior derecha', 'inferior derecha', 'inferior izquierda']

export default function ScanCropEditor({ source, busy, onApply, onCancel }) {
  const [corners, setCorners] = useState(source.corners)
  const [mode, setMode] = useState('document')
  const svg = useRef(null)
  const drag = useRef(null)
  const changePoint = (index, x, y) => setCorners((current) => current.map((p, i) => i === index ? { x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) } : p))
  const move = (event) => {
    if (drag.current == null || busy) return
    const rect = svg.current.getBoundingClientRect()
    changePoint(drag.current, (event.clientX - rect.left) / rect.width, (event.clientY - rect.top) / rect.height)
  }
  const valid = isValidQuad(corners)
  return <section className="invoice-crop">
    <div className="invoice-section-title"><div><h3>Ajustar el documento</h3><p>Mové las cuatro esquinas hasta los bordes de la factura.</p></div><button type="button" className="invoice-button secondary" disabled={busy} onClick={() => setCorners(defaultCorners())}>Restablecer</button></div>
    <div className="invoice-crop-stage" style={{ aspectRatio: `${source.image.width} / ${source.image.height}`, width: `min(100%, 650px, ${62 * source.image.width / source.image.height}dvh)` }}>
      <img src={source.url} alt="Factura original para ajustar los bordes" draggable="false" />
      <svg ref={svg} viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-label="Recorte de la factura" onPointerMove={move} onPointerUp={() => { drag.current = null }} onPointerCancel={() => { drag.current = null }}>
        <path fillRule="evenodd" d={`M0 0H1000V1000H0Z M${corners.map((p) => `${p.x * 1000} ${p.y * 1000}`).join('L')}Z`} fill="#1119" />
        <polygon points={corners.map((p) => `${p.x * 1000},${p.y * 1000}`).join(' ')} fill="transparent" stroke={valid ? '#ffad8d' : '#f66'} strokeWidth="3" vectorEffect="non-scaling-stroke" />

      </svg>
      {corners.map((p, i) => <button type="button" key={i} className="invoice-crop-handle" style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }} disabled={busy} role="slider" aria-label={`Esquina ${names[i]}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(p.x * 100)} aria-valuetext={`Horizontal ${Math.round(p.x * 100)}%, vertical ${Math.round(p.y * 100)}%. Usá las flechas para mover.`} onPointerDown={(event) => { if (busy) return; event.preventDefault(); drag.current = i; svg.current.setPointerCapture(event.pointerId) }} onKeyDown={(event) => { const offsets = { ArrowLeft: [-.01, 0], ArrowRight: [.01, 0], ArrowUp: [0, -.01], ArrowDown: [0, .01] }; if (offsets[event.key]) { event.preventDefault(); const [dx, dy] = offsets[event.key]; changePoint(i, p.x + dx, p.y + dy) } }} />)}
    </div>
    {!valid && <p className="invoice-error" role="alert">Las esquinas no deben cruzarse. Ajustalas para abarcar el documento.</p>}
    <div className="invoice-scan-options"><label>Tratamiento<select value={mode} disabled={busy} onChange={(event) => setMode(event.target.value)}><option value="document">Documento · mejorar texto y sombras</option><option value="color">Color · conservar sellos y colores</option></select></label><p>El escaneo corrige la perspectiva y comprime la página.</p></div>
    <div className="invoice-dialog-actions"><button type="button" className="invoice-button secondary" disabled={busy} onClick={onCancel}>Cambiar imagen</button><button type="button" className="invoice-button primary" disabled={busy || !valid} onClick={() => onApply(corners, mode)}>{busy ? 'Procesando escaneo…' : 'Escanear página'}</button></div>
  </section>
}
