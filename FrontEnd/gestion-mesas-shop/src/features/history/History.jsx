import { useState } from 'react'
import HistoryIcon from './HistoryIcon.jsx'
import './History.css'
import { openReceiptPrintWindow, printReceipt, localDate, localTime } from '../printing/receipt.js'

export default function History({ histories }) {
  const [visibleCount, setVisibleCount] = useState(10)
  const [printError, setPrintError] = useState('')
  const visibleHistories = histories.slice(0, visibleCount)

  const printHistory = (history) => {
    setPrintError('')
    let printWindow
    try {
      printWindow = openReceiptPrintWindow()
      if (!printReceipt(history, printWindow)) {
        setPrintError('No se pudo abrir la impresión. Habilitá las ventanas emergentes del navegador y volvé a intentar.')
      }
    } catch {
      if (printWindow && !printWindow.closed) printWindow.close()
      setPrintError('No se pudo preparar el comprobante para imprimir. Volvé a intentarlo.')
    }
  }

  return <div className="table-history-page">
    <header className="history-page-header"><div><p className="eyebrow">REGISTRO DE CIERRES</p><h1>Historial de mesas</h1><p>Consultá los cierres e imprimí los comprobantes de cada mesa.</p></div><span className="history-format"><HistoryIcon name="print" /><span>Impresión de comprobantes<small>Formato térmico · 80 mm</small></span></span></header>
    {printError && <p className="history-print-error" role="alert">{printError}</p>}
    <section className="history-panel" aria-labelledby="history-records-title">
      <div className="history-list-heading"><div><span className="history-heading-icon"><HistoryIcon name="clock" /></span><h2 id="history-records-title">Cierres registrados <span>{histories.length}</span></h2></div>{histories.length > 0 && <span className="history-visible-count">Mostrando {visibleHistories.length} de {histories.length}</span>}</div>
      {histories.length ? <div className="history-list">{visibleHistories.map((history) => <article className="history-card" key={history.id}>
        <div className="history-card-header">
          <div className="history-record-identity"><span className="history-table-icon"><HistoryIcon name="table" /></span><div><div className="history-record-title"><h3>{history.tableName}</h3><span className="history-closed-badge"><HistoryIcon name="check" />Cerrada</span></div><p className="history-record-date"><HistoryIcon name="calendar" />{localDate(history.closedAt)}</p></div></div>
          <dl className="history-session"><div><dt>Apertura</dt><dd>{localTime(history.openedAt)}</dd></div><div><dt>Cierre</dt><dd>{localTime(history.closedAt)}</dd></div><div><dt>Artículos</dt><dd>{history.items.length}<span> {history.items.length === 1 ? 'artículo' : 'artículos'}</span></dd></div></dl>
          <button className="receipt-button" aria-label={`Imprimir ticket de ${history.tableName}`} onClick={() => printHistory(history)}><HistoryIcon name="print" />Imprimir ticket</button>
        </div>
        <details>
          <summary><HistoryIcon name="receipt" /><span>Ver detalle de artículos</span><span className="history-detail-count">{history.items.length}</span><HistoryIcon name="down" /></summary>
          <div className="history-items">{history.items.length ? <><div className="history-items-heading" aria-hidden="true"><span>Artículo y cantidad</span><span>Hora de registro</span></div>{history.items.map((item) => <div className="history-item-row" key={item.id}><span><small>{item.quantity}×</small><b>{item.productName}</b></span><time>{localTime(item.createdAt)}</time></div>)}</> : <p><HistoryIcon name="receipt" />La mesa se cerró sin artículos.</p>}</div>
        </details>
      </article>)}{visibleCount < histories.length && <div className="history-list-footer"><span>Mostrando {visibleHistories.length} de {histories.length} cierres</span><button type="button" className="load-more-button" onClick={() => setVisibleCount((count) => count + 10)}>Cargar 10 más</button></div>}</div> : <div className="empty-history"><span className="history-empty-icon"><HistoryIcon name="clock" /></span><b>Todavía no hay mesas cerradas</b><span>Los próximos cierres aparecerán automáticamente en este historial.</span></div>}
    </section>
  </div>
}
