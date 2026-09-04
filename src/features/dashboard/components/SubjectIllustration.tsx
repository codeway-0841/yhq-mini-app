import { memo } from 'react'
import type { SubjectConfig } from '../../../shared/config/subjects'

/** Original subject scenes, animated with CSS; no image downloads or runtime timers. */
export const SubjectIllustration = memo(function SubjectIllustration({ subject }: { subject: SubjectConfig }) {
  const Icon = subject.icon
  const language = subject.id === 'rustili' || subject.id === 'ingliz'
  const science = ['fizika', 'kimyo', 'biologiya'].includes(subject.id)
  return (
    <svg viewBox="0 0 360 280" aria-hidden="true" focusable="false" className="home-learning-art">
      <ellipse cx="180" cy="251" rx="100" ry="10" fill="var(--p-fg)" opacity=".05" />
      <g className="home-learning-art-main">
        {language ? <g transform="rotate(-12 150 140)">
          <rect x="54" y="67" width="156" height="162" rx="24" fill={subject.colorDark} />
          <rect x="54" y="55" width="156" height="162" rx="24" fill={subject.color} />
          <path d="M77 55h110q23 0 23 24v89z" fill="white" opacity=".13" />
          <text x="132" y="166" textAnchor="middle" fontFamily="Georgia, serif" fontWeight="bold" fontSize="94" fill="white">{subject.id === 'rustili' ? 'Я' : 'A'}</text>
          <path d="M85 190h45" stroke="white" strokeWidth="5" strokeLinecap="round" opacity=".4" />
        </g> : science ? <g>
          <ellipse cx="175" cy="140" rx="119" ry="45" transform="rotate(-40 175 140)" fill="none" stroke={subject.color} strokeWidth="12" />
          <ellipse cx="175" cy="140" rx="119" ry="45" transform="rotate(40 175 140)" fill="none" stroke={subject.color} strokeWidth="12" opacity=".6" />
          <circle cx="175" cy="145" r="51" fill={subject.colorDark} />
          <circle cx="175" cy="136" r="51" fill={subject.color} />
          <g transform="translate(145 105)" color="white"><Icon size={60} strokeWidth={2} /></g>
          <circle cx="79" cy="83" r="16" fill="#f3c64f" /><circle cx="273" cy="191" r="13" fill="#f3c64f" />
        </g> : subject.id === 'matematika' ? <g>
          <path d="M62 206 141 55 220 206v12H62z" fill={subject.colorDark} />
          <path d="M62 206 141 55 220 206z" fill={subject.color} />
          <path d="m141 55 79 151h-79z" fill="white" opacity=".16" />
          <rect x="174" y="132" width="101" height="98" rx="15" fill="#cc9b30" />
          <rect x="174" y="122" width="101" height="98" rx="15" fill="#f3c64f" />
          <circle cx="225" cy="171" r="25" fill="#fff3cb" />
        </g> : <g transform="rotate(-8 180 145)">
          <rect x="87" y="51" width="169" height="184" rx="26" fill={subject.colorDark} />
          <rect x="87" y="41" width="169" height="184" rx="26" fill={subject.color} />
          <path d="M111 43v180" stroke="white" strokeOpacity=".25" strokeWidth="5" />
          <g transform="translate(137 78)" color="white"><Icon size={82} strokeWidth={1.7} /></g>
          <path d="M141 187h69" stroke="white" strokeOpacity=".5" strokeWidth="6" strokeLinecap="round" />
        </g>}
      </g>
      <g className="home-learning-art-satellite">
        {language ? <g transform="rotate(12 255 180)">
          <rect x="192" y="128" width="110" height="109" rx="22" fill="#c99930" />
          <rect x="192" y="117" width="110" height="109" rx="22" fill="#f3c64f" />
          <text x="247" y="190" textAnchor="middle" fontFamily="Georgia, serif" fontWeight="bold" fontSize="61" fill="#584015">{subject.id === 'rustili' ? 'Б' : 'b'}</text>
        </g> : <path d="M271 42v28m-14-14h28" stroke="#f3c64f" strokeWidth="8" strokeLinecap="round" />}
        <circle cx="281" cy="65" r="10" fill={subject.color} opacity=".3" />
        <path d="M39 164v16m-8-8h16" stroke={subject.color} strokeWidth="4" strokeLinecap="round" opacity=".45" />
        <circle cx="311" cy="211" r="5" fill="#f3c64f" />
      </g>
    </svg>
  )
})
