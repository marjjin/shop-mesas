import { useId } from 'react'

export default function LoginIllustration() {
  const gridId = useId()
  return <svg className="auth-illustration" viewBox="0 0 520 280" fill="none" aria-hidden="true">
    <defs><pattern id={gridId} width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".8" fill="#d4dfcd" fillOpacity=".16" /></pattern></defs>
    <rect x="1" y="1" width="518" height="278" rx="20" fill="#ffffff04" stroke="#ffffff12" />
    <rect x="12" y="12" width="496" height="256" rx="14" fill={`url(#${gridId})`} />
    <path d="M43 78V47a10 10 0 0 1 10-10h414a10 10 0 0 1 10 10v186a10 10 0 0 1-10 10H53a10 10 0 0 1-10-10V110" stroke="#9cb29b" strokeOpacity=".4" strokeWidth="1.5" />
    <path d="M43 110h32a32 32 0 0 0-32-32" stroke="#9cb29b" strokeOpacity=".35" strokeDasharray="3 4" />
    {[72, 167].map((y) => <g key={y}>
      <rect x="88" y={y - 7} width="25" height="8" rx="3" fill="#8ca289" fillOpacity=".55" />
      <rect x="88" y={y + 51} width="25" height="8" rx="3" fill="#8ca289" fillOpacity=".55" />
      <rect x="71" y={y} width="60" height="52" rx="9" fill="#bdc9b2" fillOpacity=".18" stroke="#a3b59c" strokeOpacity=".55" />
      <circle cx="101" cy={y + 26} r="9" stroke="#c4ceb8" strokeOpacity=".5" />
      <path d={`M98 ${y + 26}h6`} stroke="#c4ceb8" strokeOpacity=".5" />
    </g>)}
    {[184, 240, 296].map((x) => <g key={x}><rect x={x} y="87" width="27" height="9" rx="3" fill="#d5c9aa" fillOpacity=".65" /><rect x={x} y="183" width="27" height="9" rx="3" fill="#d5c9aa" fillOpacity=".65" /></g>)}
    <rect x="169" y="98" width="170" height="83" rx="13" fill="#eee5cc" stroke="#f6edd8" />
    <rect x="176" y="105" width="156" height="69" rx="9" stroke="#b7aa85" strokeOpacity=".4" />
    <circle cx="215" cy="139" r="14" stroke="#b2a27f" strokeOpacity=".65" /><circle cx="215" cy="139" r="9" stroke="#b2a27f" strokeOpacity=".65" />
    <circle cx="293" cy="139" r="14" stroke="#b2a27f" strokeOpacity=".65" /><circle cx="293" cy="139" r="9" stroke="#b2a27f" strokeOpacity=".65" />
    <path d="M251 131h7v10a4 4 0 0 1-7 0v-10Zm7 1h2a3 3 0 1 1 0 6h-2" stroke="#8b8f68" strokeWidth="1.5" />
    {[91, 192].map((y) => <g key={y}>
      <rect x="397" y={y - 36} width="24" height="8" rx="3" fill="#8ca289" fillOpacity=".55" /><rect x="397" y={y + 29} width="24" height="8" rx="3" fill="#8ca289" fillOpacity=".55" />
      <circle cx="409" cy={y} r="28" fill="#bdc9b2" fillOpacity=".13" stroke="#a3b59c" strokeOpacity=".65" />
      <circle cx="409" cy={y} r="20" stroke="#a3b59c" strokeOpacity=".3" />
      <circle cx="409" cy={y} r="4" fill="#bdc9b2" fillOpacity=".5" />
    </g>)}
    <circle cx="335" cy="102" r="15" fill="#e99b76" /><path d="m329 102 4 4 8-8" stroke="#fffaf0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M157 224h174" stroke="#b8c5ab" strokeOpacity=".25" strokeDasharray="3 5" />
  </svg>
}
