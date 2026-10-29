const eye = 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Zm13 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z'
const paths = {
  coffee: 'M4 9h12v8a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V9Zm12 0h2a3 3 0 1 1 0 6h-2M7 3v3m5-3v3',
  tables: 'M4 4h6v6H4V4Zm10 0h6v6h-6V4ZM4 14h6v6H4v-6Zm10 0h6v6h-6v-6Z',
  receipt: 'M5 3h14v18l-3-2-4 2-4-2-3 2V3Zm4 5h6m-6 4h6m-6 4h3',
  door: 'M9 3H4v18h5M9 12h12m-5-5 5 5-5 5',
  user: 'M20 21v-2a6 6 0 0 0-6-6h-4a6 6 0 0 0-6 6v2M16 5a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
  lock: 'M7 10V7a5 5 0 0 1 10 0v3M5 10h14v11H5V10Zm7 4v3',
  eye,
  eyeOff: `${eye}M3 3l18 18`,
  caps: 'm12 3 7 8h-4v5H9v-5H5l7-8ZM9 20h6',
  alert: 'M12 8v5m0 3v.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  arrow: 'M5 12h14m-5-5 5 5-5 5',
}

export default function LoginIcon({ name }) {
  return <svg className="auth-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>
}
