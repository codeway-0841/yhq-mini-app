import { useId } from 'react'

/** Decorative player portraits; these do not represent online users. */
export function ArenaArtwork() {
  const id = useId()
  return (
    <svg className="arena-artwork" viewBox="0 12 360 148" fill="none" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`${id}-blue`} x1="55" y1="28" x2="145" y2="145" gradientUnits="userSpaceOnUse"><stop stopColor="#F3F5FF" /><stop offset="1" stopColor="#CBD7FF" /></linearGradient>
        <linearGradient id={`${id}-peach`} x1="215" y1="28" x2="290" y2="145" gradientUnits="userSpaceOnUse"><stop stopColor="#FFF5E9" /><stop offset="1" stopColor="#EDD1BE" /></linearGradient>
        <linearGradient id={`${id}-skinA`} x1="80" y1="50" x2="130" y2="108" gradientUnits="userSpaceOnUse"><stop stopColor="#FFD8B4" /><stop offset="1" stopColor="#EBA785" /></linearGradient>
        <linearGradient id={`${id}-skinB`} x1="232" y1="50" x2="280" y2="109" gradientUnits="userSpaceOnUse"><stop stopColor="#F1BF96" /><stop offset="1" stopColor="#CC8E69" /></linearGradient>
        <linearGradient id={`${id}-shirt`} x1="65" y1="115" x2="133" y2="152" gradientUnits="userSpaceOnUse"><stop stopColor="#758AF0" /><stop offset="1" stopColor="#3E52B4" /></linearGradient>
        <clipPath id={`${id}-left`}><circle cx="105" cy="86" r="58" /></clipPath>
        <clipPath id={`${id}-right`}><circle cx="255" cy="86" r="58" /></clipPath>
      </defs>
      <circle cx="105" cy="86" r="66" stroke="#8193D4" strokeOpacity=".22" />
      <circle cx="255" cy="86" r="66" stroke="#D7A280" strokeOpacity=".25" />
      <circle cx="105" cy="89" r="60" fill="#536BB0" opacity=".07" />
      <circle cx="255" cy="89" r="60" fill="#A97858" opacity=".07" />
      <g clipPath={`url(#${id}-left)`}>
        <circle cx="105" cy="86" r="58" fill={`url(#${id}-blue)`} />
        <path d="M44 163c0-34 25-55 61-55s61 21 61 55" fill={`url(#${id}-shirt)`} />
        <path d="m90 108 15 21 16-21" fill="#F8FCFF" />
        <path d="M96 96h19v19c-5 7-14 7-19 0Z" fill="#DFA583" />
        <ellipse cx="105" cy="77" rx="28" ry="34" fill={`url(#${id}-skinA)`} />
        <path d="M77 77c-13-27 6-46 27-45 21-2 39 15 32 40l-10-18c-12 12-28 12-40 6l-5 21Z" fill="#303744" />
        <path d="M85 49c-6-10 0-19 6-21-1 10 6 11 14 8" fill="#303744" />
        <path d="m90 71 8-1m14 0 8 1" stroke="#54433F" strokeWidth="2.5" strokeLinecap="round" />
        <ellipse cx="94" cy="79" rx="4" ry="4.5" fill="#FFFAF4" /><ellipse cx="116" cy="79" rx="4" ry="4.5" fill="#FFFAF4" />
        <circle cx="95" cy="80" r="2.6" fill="#363443" /><circle cx="115" cy="80" r="2.6" fill="#363443" />
        <path d="m105 80-2 8h4" stroke="#CC8D70" strokeWidth="1.5" strokeLinecap="round" />
        <ellipse cx="87" cy="90" rx="5" ry="2.5" fill="#E99686" opacity=".4" /><ellipse cx="123" cy="90" rx="5" ry="2.5" fill="#E99686" opacity=".4" />
        <path d="M98 94q7 9 14 0Z" fill="#FFF8EE" />
      </g>
      <g clipPath={`url(#${id}-right)`}>
        <circle cx="255" cy="86" r="58" fill={`url(#${id}-peach)`} />
        <path d="M222 80c-4-27 11-47 33-47 26 0 38 20 33 48l6 42h-79Z" fill="#45352F" />
        <path d="M194 165c0-34 25-54 61-54s61 20 61 54" fill="#C87A55" />
        <path d="m240 112 15 16 16-16" fill="#FFF4E8" />
        <path d="M246 99h18v17c-5 6-13 6-18 0Z" fill="#BD805E" />
        <ellipse cx="255" cy="80" rx="27" ry="33" fill={`url(#${id}-skinB)`} />
        <path d="M227 75c-3-25 13-37 29-36 23 0 34 18 29 34-14-3-25-13-30-22-5 13-15 20-28 24Z" fill="#45352F" />
        <path d="m239 73 9-1m15 0 8 2" stroke="#654437" strokeWidth="2.5" strokeLinecap="round" />
        <ellipse cx="244" cy="81" rx="4" ry="4.5" fill="#FFF2E6" /><ellipse cx="267" cy="81" rx="4" ry="4.5" fill="#FFF2E6" />
        <circle cx="245" cy="82" r="2.7" fill="#3C3032" /><circle cx="266" cy="82" r="2.7" fill="#3C3032" />
        <path d="m255 83-2 7h4" stroke="#B77857" strokeWidth="1.5" strokeLinecap="round" />
        <ellipse cx="236" cy="92" rx="5" ry="2.5" fill="#C5705B" opacity=".35" /><ellipse cx="274" cy="92" rx="5" ry="2.5" fill="#C5705B" opacity=".35" />
        <path d="M248 96q7 9 14 0Z" fill="#FFF6E9" />
        <circle cx="228" cy="88" r="3" fill="#EAC67A" /><circle cx="282" cy="88" r="3" fill="#EAC67A" />
      </g>
      <path d="M174 85h12m-4-4 4 4-4 4" stroke="#8D98B3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="47" cy="25" r="3" fill="#B5C4F3" /><circle cx="308" cy="144" r="3" fill="#E5C1AA" />
    </svg>
  )
}
