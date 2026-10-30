import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import test from 'node:test'
import { buildInvoicePdf } from './buildInvoicePdf.js'

// Two-by-two synthetic checkerboard, generated for this regression fixture.
const jpeg = '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/2wBDAQMEBAUEBQkFBQkUDQsNFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBT/wAARCAACAAIDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD4+/aF/aF+KfgL4+/Evwx4Y+JfjDw54b0XxNqem6Xo2k69dWtnYWsN1JHDbwQxyBIokRVRUUBVVQAABRRRQB//2Q=='

test('generated PDF embeds JPEG pages in order with the correct portrait and landscape sizes', async () => {
  const blob = new Blob([Buffer.from(jpeg, 'base64')], { type: 'image/jpeg' })
  const pdf = await buildInvoicePdf([{ width: 100, height: 200, blob }, { width: 200, height: 100, blob }])
  assert.equal(pdf.type, 'application/pdf')
  const text = Buffer.from(await pdf.arrayBuffer()).toString('latin1')
  assert.ok(text.startsWith('%PDF-'))
  assert.ok(text.trimEnd().endsWith('%%EOF'))
  assert.equal([...text.matchAll(/\/Type \/Page\b/g)].length, 2)
  assert.ok(text.includes('/DCTDecode'))
  const boxes = [...text.matchAll(/\/MediaBox \[0 0 ([\d.]+) ([\d.]+)\]/g)].map((match) => [Number(match[1]), Number(match[2])])
  assert.equal(boxes.length, 2)
  assert.ok(boxes[0][1] > boxes[0][0])
  assert.ok(boxes[1][0] > boxes[1][1])
  assert.ok(Math.abs(boxes[0][0] / boxes[0][1] - .5) < .001)
  assert.ok(Math.abs(boxes[1][0] / boxes[1][1] - 2) < .001)
})

test('empty and oversized page sets cannot produce a PDF', async () => {
  await assert.rejects(buildInvoicePdf([]), /entre 1 y 10/)
  await assert.rejects(buildInvoicePdf(Array(11).fill({})), /entre 1 y 10/)
})
