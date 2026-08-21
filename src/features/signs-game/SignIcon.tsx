/**
 * SignIcon — GameSign'ni SVG'da sxematik chizish (SOLE renderer).
 * Shakl (triangle/circle/octagon/square/diamond) + fon + ramka + ichki belgi
 * (emoji/text/bar/cross/slash) birlashtiriladi — asset'siz, retina-toza.
 */
import type { GameSign } from '../../content/signs-game'

const NS = 'http://www.w3.org/2000/svg'

function Shape({ sign }: { sign: GameSign }) {
  const rim = sign.rim ?? 'none'
  const sw = sign.rim ? 8 : 0
  switch (sign.shape) {
    case 'triangle':
      return <path d="M50 10 L94 88 L6 88 Z" fill={sign.bg} stroke={rim} strokeWidth={sw} strokeLinejoin="round" />
    case 'triangle-down':
      return <path d="M50 90 L6 12 L94 12 Z" fill={sign.bg} stroke={rim} strokeWidth={sw} strokeLinejoin="round" />
    case 'octagon': {
      // Doimiy sakkizburchak (markaz 50,50; r=44)
      const pts = Array.from({ length: 8 }, (_, i) => {
        const a = (Math.PI / 4) * i + Math.PI / 8
        return `${(50 + 44 * Math.cos(a)).toFixed(2)},${(50 + 44 * Math.sin(a)).toFixed(2)}`
      }).join(' ')
      return <polygon points={pts} fill={sign.bg} stroke={rim} strokeWidth={sign.rim ? 4 : 0} strokeLinejoin="round" />
    }
    case 'diamond':
      return <rect x="22" y="22" width="56" height="56" transform="rotate(45 50 50)" fill={sign.bg} stroke={rim} strokeWidth={sw} strokeLinejoin="round" />
    case 'square':
      return <rect x="10" y="10" width="80" height="80" rx="10" fill={sign.bg} stroke={rim} strokeWidth={sign.rim ? 5 : 0} />
    case 'circle':
    default:
      return <circle cx="50" cy="50" r="42" fill={sign.bg} stroke={rim} strokeWidth={sw} />
  }
}

function Content({ sign }: { sign: GameSign }) {
  const c = sign.content
  // Uchburchak/diamond'da vizual markaz pastroqda
  const cy = sign.shape === 'triangle' ? 68 : sign.shape === 'triangle-down' ? 38 : 50
  switch (c.kind) {
    case 'emoji':
      return <text x="50" y={cy} textAnchor="middle" dominantBaseline="central" fontSize="30">{c.value}</text>
    case 'text': {
      const big = (c.value?.length ?? 0) <= 2
      return (
        <text x="50" y={cy} textAnchor="middle" dominantBaseline="central"
          fontSize={big ? 30 : 17} fontWeight="900" fill={c.color ?? '#111827'}>
          {c.value}
        </text>
      )
    }
    case 'bar':   // 3.1 — oq gorizontal panelka
      return <rect x="26" y="43" width="48" height="14" rx="4" fill="#ffffff" />
    case 'cross': // 3.27 — qizil ikki diagonal
      return (
        <g stroke={sign.rim ?? '#dc2626'} strokeWidth="7" strokeLinecap="round">
          <line x1="26" y1="26" x2="74" y2="74" />
          <line x1="74" y1="26" x2="26" y2="74" />
        </g>
      )
    case 'slash': // 3.28 — bitta qizil diagonal
      return <line x1="28" y1="72" x2="72" y2="28" stroke={sign.rim ?? '#dc2626'} strokeWidth="7" strokeLinecap="round" />
    case 'none':
    default:
      return null
  }
}

export default function SignIcon({ sign, size = 88 }: { sign: GameSign; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" xmlns={NS}
      role="img" aria-label={sign.name.uz} className="flex-none" style={{ display: 'block' }}>
      <Shape sign={sign} />
      <Content sign={sign} />
    </svg>
  )
}
