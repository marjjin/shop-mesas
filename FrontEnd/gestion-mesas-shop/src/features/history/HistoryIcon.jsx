const paths = {
  table: 'M4 4h6v6H4V4Zm10 0h6v6h-6V4ZM4 14h6v6H4v-6Zm10 0h6v6h-6v-6Z',
  calendar: 'M4 5h16v16H4V5Zm3-3v6m10-6v6M4 10h16',
  receipt: 'M5 3h14v18l-3-2-4 2-4-2-3 2V3Zm4 5h6m-6 4h6m-6 4h3',
  print: 'M7 8V3h10v5M7 16H3V8h18v8h-4M7 13h10v8H7v-8Zm10-2h.01',
  check: 'm5 12 4 4L19 6',
  down: 'm6 9 6 6 6-6',
  clock: 'M12 8v4l3 2m6-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
}

export default function HistoryIcon({ name }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>
}
