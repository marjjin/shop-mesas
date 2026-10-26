export default function SettingsIcon({ name }) {
  const paths = {
    receipt: 'M7 3h10v18l-2.5-2-2.5 2-2.5-2L7 21V3Zm3 5h4m-4 4h4',
    check: 'm5 12 4 4L19 6',
    info: 'M12 11v6m0-10v.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
    eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Zm13 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
    chevron: 'm9 5 7 7-7 7',
    edit: 'm15 5 4 4M4 20l4-1L20 7a2.8 2.8 0 0 0-4-4L4 15v5Z',
    close: 'm6 6 12 12M6 18 18 6',
  }
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>
}
