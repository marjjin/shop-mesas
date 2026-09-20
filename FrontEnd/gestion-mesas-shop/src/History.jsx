import './History.css'

function localDate(value) {
  const date = /(?:Z|[+-]\d{2}:\d{2})$/.test(value) ? value : `${value}Z`
  return new Intl.DateTimeFormat('es-AR', { dateStyle: 'short' }).format(new Date(date))
}

function localTime(value) {
  const date = /(?:Z|[+-]\d{2}:\d{2})$/.test(value) ? value : `${value}Z`
  return new Intl.DateTimeFormat('es-AR', { hour: '2-digit', minute: '2-digit' }).format(new Date(date))
}

async function downloadReceipt(history) {
  const { jsPDF } = await import('jspdf')
  const itemHeights = history.items.map((item) => Math.max(8, Math.ceil(`${item.quantity}x ${item.productName}`.length / 32) * 4 + 3))
  const height = Math.max(75, 67 + itemHeights.reduce((sum, value) => sum + value, 0))
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [80, height] })
  let y = 9

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(16)
  pdf.text('SHOP FAMILY', 40, y, { align: 'center' })
  y += 5
  pdf.setLineWidth(.3)
  pdf.line(7, y, 73, y)
  y += 7

  pdf.setFontSize(11)
  pdf.text(history.tableName, 7, y)
  y += 6
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(9)
  pdf.text(`Fecha: ${localDate(history.closedAt)}`, 7, y)
  y += 5
  pdf.text(`Ingreso: ${localTime(history.openedAt)}`, 7, y)
  y += 5
  pdf.text(`Finalización: ${localTime(history.closedAt)}`, 7, y)
  y += 6
  pdf.line(7, y, 73, y)
  y += 6

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(10)
  pdf.text('ARTÍCULOS', 7, y)
  y += 6

  history.items.forEach((item, index) => {
    const lines = pdf.splitTextToSize(`${item.quantity}x ${item.productName}`, 52)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(9)
    pdf.text(lines, 7, y)
    pdf.setFontSize(8)
    pdf.text(localTime(item.createdAt), 72, y, { align: 'right' })
    y += itemHeights[index]
  })

  if (!history.items.length) {
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(9)
    pdf.text('Sin artículos cargados', 7, y)
    y += 8
  }

  pdf.line(7, y, 73, y)
  y += 7
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(9)
  pdf.text('COMANDA DE MESA', 40, y, { align: 'center' })
  const filename = `${history.tableName}-${localDate(history.closedAt).replaceAll('/', '-')}.pdf`
  pdf.save(filename)
}

export default function History({ histories }) {
  return <>
    <header><div><p className="eyebrow">REGISTRO DE CIERRES</p><h1>Historial de mesas</h1><p>Consultá los cierres y descargá comandas térmicas de 80 mm.</p></div></header>
    <section className="history-panel">
      {histories.length ? <div className="history-list">{histories.map((history) => <article className="history-card" key={history.id}>
        <div className="history-card-header">
          <div><span>{localDate(history.closedAt)}</span><h2>{history.tableName}</h2><p>{localTime(history.openedAt)} — {localTime(history.closedAt)} · {history.items.length} {history.items.length === 1 ? 'artículo' : 'artículos'}</p></div>
          <button className="primary receipt-button" onClick={() => downloadReceipt(history)}>↓ PDF 80 mm</button>
        </div>
        <details>
          <summary>Ver detalle de artículos</summary>
          <div className="history-items">{history.items.length ? history.items.map((item) => <div key={item.id}><span><small>{item.quantity}×</small>{item.productName}</span><time>{localTime(item.createdAt)}</time></div>) : <p>La mesa se cerró sin artículos.</p>}</div>
        </details>
      </article>)}</div> : <div className="empty-history"><b>Todavía no hay mesas cerradas</b><span>Los próximos cierres aparecerán automáticamente en este historial.</span></div>}
    </section>
  </>
}
