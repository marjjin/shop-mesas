import { localDate, localTime } from '../../shared/utils/date.js'

export async function downloadReceipt(history) {
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
  pdf.line(7, y, 70, y)
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
  pdf.line(7, y, 70, y)
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
    pdf.text(localTime(item.createdAt), 68, y, { align: 'right' })
    y += itemHeights[index]
  })

  if (!history.items.length) {
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(9)
    pdf.text('Sin artículos cargados', 7, y)
    y += 8
  }

  pdf.line(7, y, 70, y)
  y += 7
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(9)
  pdf.text('COMANDA DE MESA', 40, y, { align: 'center' })
  const filename = `${history.tableName}-${localDate(history.closedAt).replaceAll('/', '-')}.pdf`
  pdf.save(filename)
}
