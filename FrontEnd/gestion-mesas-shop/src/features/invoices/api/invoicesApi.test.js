import assert from 'node:assert/strict'
import test from 'node:test'
import { createApiClient } from '../../../shared/api/createApiClient.js'
import { loadInvoiceArchive, loadInvoiceDocument, uploadInvoice } from './invoicesApi.js'

test('invoice uploads preserve the multipart boundary, authenticated session and metadata', async () => {
  const api = createApiClient('https://example.test/api', async (url, options) => {
    assert.equal(url, 'https://example.test/api/invoices')
    assert.equal(options.headers.get('Authorization'), 'Bearer session')
    assert.equal(options.headers.has('Content-Type'), false)
    assert.ok(options.body instanceof FormData)
    assert.equal(options.body.get('supplierId'), '8')
    assert.equal(options.body.get('pageCount'), '2')
    assert.equal(options.body.get('originalBytes'), '3000')
    assert.equal(options.body.get('document').type, 'application/pdf')
    return Response.json({ id: 1 })
  }, { getToken: () => 'session' })
  assert.deepEqual(await uploadInvoice(api, { supplierId: 8, issueDate: '2026-10-30' }, [{ originalBytes: 1000 }, { originalBytes: 2000 }], new Blob(['%PDF-1.4'], { type: 'application/pdf' })), { id: 1 })
})

test('PDF reads return a binary blob without leaking responseType into fetch or using a token in the URL', async () => {
  const controller = new AbortController()
  const api = createApiClient('https://example.test/api', async (url, options) => {
    assert.equal(url, 'https://example.test/api/invoices/5/document')
    assert.equal(options.responseType, undefined)
    assert.equal(options.signal, controller.signal)
    assert.equal(options.headers.get('Authorization'), 'Bearer session')
    return new Response('%PDF-1.4', { headers: { 'Content-Type': 'application/pdf' } })
  }, { getToken: () => 'session' })
  assert.equal(await (await loadInvoiceDocument(api, 5, controller.signal)).text(), '%PDF-1.4')
})

test('invoice filters encode search text and reject an old server response before rendering', async () => {
  const requested = []
  const api = async (path) => { requested.push(path); return path.includes('?') ? { items: [], totalCount: 0, page: 1, pageSize: 12, summary: { count: 0, supplierCount: 0, sizeBytes: 0 } } : [] }
  await loadInvoiceArchive(api, { search: 'A & B', supplierId: '7', page: 2 })
  assert.ok(requested[0].includes('search=A+%26+B'))
  assert.ok(requested[0].includes('supplierId=7'))
  await assert.rejects(loadInvoiceArchive(async () => ({}), { page: 1 }), /versión actualizada/)
})
