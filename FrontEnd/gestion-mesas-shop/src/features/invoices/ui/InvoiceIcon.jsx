const paths = {
  file: 'M6 3h8l4 4v14H6V3Zm8 0v5h4M9 12h6m-6 4h6',
  scan: 'M3 8V3h5m8 0h5v5m0 8v5h-5M8 21H3v-5M7 7h10v10H7V7Zm-3 5h16',
  camera: 'M8 5 10 2h4l2 3h5v16H3V5h5Zm9 8a5 5 0 1 1-10 0 5 5 0 0 1 10 0Z',
  image: 'M3 3h18v18H3V3Zm0 14 5-5 4 4 3-3 6 6M8 7h.01',
  plus: 'M12 5v14M5 12h14', search: 'm21 21-5-5m2-6a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z',
  close: 'm6 6 12 12M6 18 18 6', download: 'M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4',
  edit: 'm15 4 5 5M4 20l5-1L21 7l-5-5L4 14v6Z', trash: 'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7',
  supplier: 'M3 7h11v12H3V7Zm11 4h4l3 4v4h-7M8 19a2 2 0 1 1-4 0 2 2 0 0 1 4 0Zm12 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z',
  storage: 'M4 3h16v18H4V3Zm0 6h16M8 6h.01M8 13h.01m0 5h.01', check: 'm5 12 4 4L19 6',
  up: 'm6 14 6-6 6 6', down: 'm6 10 6 6 6-6',
}
export default function InvoiceIcon({ name }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>
}
