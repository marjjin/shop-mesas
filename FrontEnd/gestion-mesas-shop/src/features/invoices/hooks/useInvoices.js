import { useEffect, useState } from 'react'
import { loadInvoiceArchive } from '../api/invoicesApi.js'

export default function useInvoices(api) {
  const [filters, setFilters] = useState({ search: '', supplierId: '', page: 1 })
  const [revision, setRevision] = useState(0)
  const [result, setResult] = useState(null)
  useEffect(() => {
    const controller = new AbortController()
    let active = true
    loadInvoiceArchive(api, filters, controller.signal)
      .then((data) => { if (active) setResult({ ...data, filters, revision, api }) })
      .catch((error) => { if (active) setResult({ error: error.message || 'No se pudieron cargar las facturas.', filters, revision, api }) })
    return () => { active = false; controller.abort() }
  }, [api, filters, revision])
  const current = result?.filters === filters && result?.revision === revision && result?.api === api
  return { archive: current ? result.archive : null, suppliers: current ? result.suppliers || [] : [],
    error: current ? result.error : '', loading: !current, filters, setFilters, reload: () => setRevision((value) => value + 1) }
}
