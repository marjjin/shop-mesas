export function pageDimensions(page) {
  const scale = Math.min(210 / page.width, 1200 / page.height)
  return [page.width * scale, page.height * scale]
}

export async function buildInvoicePdf(pages) {
  if (!pages.length || pages.length > 10) throw new Error('Agregá entre 1 y 10 páginas a la factura.')
  const { jsPDF } = await import('jspdf')
  let doc
  for (const page of pages) {
    const [width, height] = pageDimensions(page)
    const options = { unit: 'mm', format: [width, height], orientation: width > height ? 'landscape' : 'portrait', compress: true }
    if (!doc) doc = new jsPDF(options)
    else doc.addPage([width, height], options.orientation)
    const bytes = new Uint8Array(await page.blob.arrayBuffer())
    doc.addImage(bytes, 'JPEG', 0, 0, width, height, undefined, 'NONE')
  }
  doc.setProperties({ title: 'Factura escaneada', creator: 'SHOP FAMILY' })
  const blob = doc.output('blob')
  if (blob.size > 8 * 1024 * 1024) throw new Error('El PDF supera 8 MB. Quitá páginas o guardalas en otra factura.')
  return blob
}
