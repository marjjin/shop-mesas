let pageSequence = 0

export function canUseInlineCamera(secureContext, mediaDevices) {
  return secureContext !== false && typeof mediaDevices?.getUserMedia === 'function'
}

// This ID only identifies pages inside the current scan draft, not sessions or stored files.
export function createScanPageId(cryptoApi = globalThis.crypto) {
  if (typeof cryptoApi?.randomUUID === 'function') return cryptoApi.randomUUID()
  return `scan-page-${Date.now().toString(36)}-${(++pageSequence).toString(36)}`
}
