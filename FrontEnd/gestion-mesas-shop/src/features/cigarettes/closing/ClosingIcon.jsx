const paths = {
  receipt: 'M5 3h14v18l-3-2-4 2-4-2-3 2V3Zm4 5h6m-6 4h6m-6 4h3',
  wallet: 'M20 7H5a2 2 0 0 1 0-4h13v4M3 5v14a2 2 0 0 0 2 2h15V7M16 12h5v5h-5v-5Z',
  cash: 'M2 6h20v12H2V6Zm4 0v3H2m20 0h-4V6M2 15h4v3m12 0v-3h4M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
  supplier: 'M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6M8 9h1m6 0h1m-8 3h1m6 0h1',
  coffee: 'M4 8h13v7a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V8Zm13 1h2a3 3 0 1 1 0 6h-2M7 3v2m4-2v2m4-2v2M2 23h18',
  box: 'm3 7 9-4 9 4v10l-9 4-9-4V7Zm0 0 9 4 9-4M12 11v10M7.5 5l9 4',
  calendar: 'M4 5h16v16H4V5Zm3-3v6m10-6v6M4 10h16M8 14h2m4 0h2m-8 3h2',
  check: 'm5 12 4 4L19 6',
  close: 'm6 6 12 12M6 18 18 6',
  print: 'M7 8V3h10v5M7 16H3V8h18v8h-4M7 13h10v8H7v-8Zm10-2h.01',
  edit: 'm15 4 5 5M4 20l5-1L21 7l-5-5L4 14v6Z',
}

export default function ClosingIcon({ name }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>
}
