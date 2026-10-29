const paths = {
  supplier: 'M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6M8 9h1m6 0h1m-8 3h1m6 0h1',
  wallet: 'M20 7H5a2 2 0 0 1 0-4h13v4M3 5v14a2 2 0 0 0 2 2h15V7M16 12h5v5h-5v-5Z',
  cash: 'M2 6h20v12H2V6Zm4 0v3H2m20 0h-4V6M2 15h4v3m12 0v-3h4M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
  card: 'M3 5h18v14H3V5Zm0 5h18M7 15h3',
  account: 'M5 3h14v18l-3-2-4 2-4-2-3 2V3Zm4 5h6m-6 4h6m-6 4h3',
  purchase: 'M3 3h2l2 12h12l2-8H6M9 20h.01M18 20h.01',
  check: 'm5 12 4 4L19 6',
  transfer: 'M4 7h16m-4-4 4 4-4 4M20 17H4m4-4-4 4 4 4',
  clock: 'M12 8v4l3 2m6-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  search: 'm21 21-5-5m2-6a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z',
  plus: 'M12 5v14M5 12h14',
  left: 'M19 12H5m5-5-5 5 5 5',
  arrow: 'M5 12h14m-5-5 5 5-5 5',
  edit: 'm15 4 5 5M4 20l5-1L21 7l-5-5L4 14v6Z',
  close: 'm6 6 12 12M6 18 18 6',
  info: 'M12 11v6m0-10v.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  more: 'M12 5h.01M12 12h.01M12 19h.01',
  archive: 'M3 3h18v5H3V3Zm2 5v13h14V8M9 12h6',
}

export default function SupplierIcon({ name }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>
}
