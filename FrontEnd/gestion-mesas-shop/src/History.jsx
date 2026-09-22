import { useState } from 'react'
import './History.css'
import { downloadReceipt, localDate, localTime } from './receipt.js'

export default function History({ histories }) {
  const [visibleCount, setVisibleCount] = useState(10)
  const visibleHistories = histories.slice(0, visibleCount)

  return <>
    <header><div><p className="eyebrow">REGISTRO DE CIERRES</p><h1>Historial de mesas</h1><p>Consultá los cierres y descargá comandas térmicas de 80 mm.</p></div></header>
    <section className="history-panel">
      {histories.length ? <div className="history-list">{visibleHistories.map((history) => <article className="history-card" key={history.id}>
        <div className="history-card-header">
          <div><span>{localDate(history.closedAt)}</span><h2>{history.tableName}</h2><p>{localTime(history.openedAt)} — {localTime(history.closedAt)} · {history.items.length} {history.items.length === 1 ? 'artículo' : 'artículos'}</p></div>
          <button className="primary receipt-button" onClick={() => downloadReceipt(history)}>↓ PDF 80 mm</button>
        </div>
        <details>
          <summary>Ver detalle de artículos</summary>
          <div className="history-items">{history.items.length ? history.items.map((item) => <div key={item.id}><span><small>{item.quantity}×</small>{item.productName}</span><time>{localTime(item.createdAt)}</time></div>) : <p>La mesa se cerró sin artículos.</p>}</div>
        </details>
      </article>)}{visibleCount < histories.length && <button type="button" className="load-more-button" onClick={() => setVisibleCount((count) => count + 10)}>Cargar 10 más</button>}</div> : <div className="empty-history"><b>Todavía no hay mesas cerradas</b><span>Los próximos cierres aparecerán automáticamente en este historial.</span></div>}
    </section>
  </>
}
