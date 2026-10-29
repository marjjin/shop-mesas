const paths = {
  box: 'm3 7 9-4 9 4v10l-9 4-9-4V7Zm0 0 9 4 9-4M12 11v10M7.5 5l9 4',
  search: 'm21 21-5-5m2-6a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z',
  plus: 'M12 5v14M5 12h14',
  edit: 'm15 4 5 5M4 20l5-1L21 7l-5-5L4 14v6Z',
  trash: 'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7',
  close: 'm6 6 12 12M6 18 18 6',
  info: 'M12 11v6m0-10v.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  check: 'm5 12 4 4L19 6',
  warning: 'M12 9v4m0 4v.01M12 3 2 21h20L12 3Z',
  ranking: 'M4 14h4v7H4v-7Zm6-11h4v18h-4V3Zm6 6h4v12h-4V9Z',
  arrow: 'M5 12h14m-5-5 5 5-5 5',
  purchase: 'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5',
  stock: 'M4 4h16v16H4V4Zm4 4v8m4-8v8m4-8v8',
}

export default function InventoryIcon({ name }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>
}
