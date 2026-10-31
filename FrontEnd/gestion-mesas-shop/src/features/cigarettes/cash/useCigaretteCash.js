// Carga con cancelación: AbortController corta el pedido si cambia la fecha o la página.
import { useEffect, useState } from 'react'
import { loadCigaretteCash } from './cigaretteCashApi.js'

export default function useCigaretteCash(api, date) {
  const [page, setPage] = useState(1)
  const [revision, setRevision] = useState(0)
  const [result, setResult] = useState(null)
  // La clave identifica la consulta: un resultado con otra clave se considera viejo.
  const key = `${date}:${page}:${revision}`
  useEffect(() => {
    const controller = new AbortController()
    let active = true
    loadCigaretteCash(api, date, page, controller.signal)
      .then((data) => { if (active) setResult({ key, data }) })
      .catch((error) => { if (active) setResult({ key, error: error.message || 'No se pudo cargar la caja.' }) })
    return () => { active = false; controller.abort() }
  }, [api, date, page, key])
  return { data: result?.key === key ? result.data : null, error: result?.key === key ? result.error : '',
    loading: result?.key !== key, page, setPage, reload: () => setRevision((value) => value + 1) }
}
