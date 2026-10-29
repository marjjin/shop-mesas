const paths = {
  cash: 'M2 6h20v12H2V6Zm4 0v3H2m20 0h-4V6M2 15h4v3m12 0v-3h4M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
  clock: 'M12 8v4l3 2m6-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  check: 'm5 12 4 4L19 6',
  info: 'M12 11v6m0-10v.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  lock: 'M7 10V7a5 5 0 0 1 10 0v3M5 10h14v11H5V10Zm7 4v3',
  receipt: 'M5 3h14v18l-3-2-4 2-4-2-3 2V3Zm4 5h6m-6 4h6m-6 4h3',
  print: 'M7 8V3h10v5M7 16H3V8h18v8h-4M7 13h10v8H7v-8Zm10-2h.01',
  edit: 'm15 4 5 5M4 20l5-1L21 7l-5-5L4 14v6Z',
  trash: 'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7',
  plus: 'M12 5v14M5 12h14',
  sun: 'M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5M17 12a5 5 0 1 1-10 0 5 5 0 0 1 10 0Z',
  sunset: 'M3 18h18M5 21h14M7 18a5 5 0 1 1 10 0M12 2v7m-3-3 3 3 3-3M3 12l2 2m14 0 2-2',
}

export default function CashDropIcon({ name }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>
}
