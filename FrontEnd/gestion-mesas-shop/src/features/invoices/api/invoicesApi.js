const updateMessage = 'Facturas requiere la versión actualizada del servidor. Reinicialo o actualizá su despliegue y volvé a intentar.'
const count = (value) => Number.isSafeInteger(value) && value >= 0
const invoice = (value) => value != null && Number.isInteger(value.id) && Number.isInteger(value.supplierId)
  && ['supplierName', 'reference', 'note', 'issueDate'].every((key) => typeof value[key] === 'string')
  && count(value.sizeBytes) && count(value.pageCount) && value.pageCount > 0

export async function loadInvoiceArchive(api, filters, signal) {
  const query = new URLSearchParams({ page: String(filters.page), pageSize: '12' })
  if (filters.search) query.set('search', filters.search)
  if (filters.supplierId) query.set('supplierId', filters.supplierId)
  try {
    const [archive, suppliers] = await Promise.all([api(`/invoices?${query}`, { signal }), api('/invoices/suppliers', { signal })])
    if (!Array.isArray(archive?.items) || !archive.items.every(invoice) || !count(archive?.totalCount)
      || !count(archive?.page) || archive.page < 1 || !count(archive?.pageSize) || archive.pageSize < 1
      || !count(archive?.summary?.count) || !count(archive?.summary?.supplierCount) || !count(archive?.summary?.sizeBytes)
      || !Array.isArray(suppliers) || !suppliers.every((s) => Number.isInteger(s?.id) && typeof s.name === 'string' && typeof s.isActive === 'boolean')) throw new Error(updateMessage)
    return { archive, suppliers }
  } catch (error) { if (error.status === 404) throw new Error(updateMessage, { cause: error }); throw error }
}

export function uploadInvoice(api, metadata, pages, blob) {
  const form = new FormData()
  for (const [field, value] of Object.entries(metadata)) form.set(field, String(value ?? ''))
  form.set('pageCount', String(pages.length))
  form.set('originalBytes', String(pages.reduce((total, page) => total + page.originalBytes, 0)))
  form.set('document', blob, 'factura.pdf')
  return api('/invoices', { method: 'POST', body: form })
}

export async function loadInvoiceDocument(api, id, signal) {
  const blob = await api(`/invoices/${id}/document`, { responseType: 'blob', signal })
  if (!(blob instanceof Blob) || blob.type.split(';')[0] !== 'application/pdf') throw new Error('No se recibió un PDF válido.')
  return blob
}

export function displayFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toLocaleString('es-AR', { maximumFractionDigits: 0 })} KB`
  return `${(bytes / 1024 / 1024).toLocaleString('es-AR', { maximumFractionDigits: 1 })} MB`
}
