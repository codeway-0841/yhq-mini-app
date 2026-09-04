import { useId } from 'react'
import { Check } from 'lucide-react'
import './learning-path.css'

export function PathMascot() {
  return <span className="learning-mascot" aria-hidden="true">
    <span className="learning-mascot-face"><span className="learning-mascot-eye" /><span className="learning-mascot-smile" /></span>
  </span>
}

export default function LessonToken({ done, current, check = false }: {
  done: boolean; current: boolean; check?: boolean
}) {
  const id = useId()
  const octagon = '38,54 82,54 113,72 113,99 82,117 38,117 7,99 7,72'
  return <span className="learning-tile" data-state={current ? 'current' : done ? 'done' : 'unread'} data-check={check}>
    <svg aria-hidden="true" viewBox="0 0 120 130" width="120" height="130">
      <defs>
        <linearGradient id={id + '-top'} x2=".8" y2="1">
          <stop stopColor="var(--tile-light)" /><stop offset="1" stopColor="var(--tile-color)" />
        </linearGradient>
        <linearGradient id={id + '-beam'} x2="0" y2="1">
          <stop stopColor="var(--tile-light)" stopOpacity="0" /><stop offset="1" stopColor="var(--tile-light)" stopOpacity=".4" />
        </linearGradient>
      </defs>
      <ellipse cx="60" cy="113" rx="48" ry="13" fill="var(--tile-edge)" opacity=".16" />
      {check ? <>
        <polygon points={octagon} fill="none" stroke="var(--p-primary)" strokeWidth="2" opacity=".12" />
        <polygon points="39,67 81,67 105,81 105,97 81,111 39,111 15,97 15,81" fill="var(--tile-side)" />
        <polygon points="39,60 81,60 105,74 105,90 81,104 39,104 15,90 15,74" fill={'url(#' + id + '-top)'} />
        <polygon points="41,65 79,65 98,77 98,87 79,99 41,99 22,87 22,77" fill="none" stroke="var(--tile-light)" strokeWidth="3" />
      </> : <>
        <path d="M14 87v5a46 22 0 0 0 92 0V87Z" fill="var(--tile-side)" />
        <ellipse cx="60" cy="87" rx="46" ry="22" fill={'url(#' + id + '-top)'} />
      </>}
      <ellipse cx="60" cy={check ? 82 : 87} rx={check ? 35 : 32} ry={check ? 18 : 15} fill="none" stroke="var(--tile-light)" strokeWidth={check ? 6 : 4} />
      <path d={check ? 'M60 61v8m0 26v8' : 'M60 70v6m0 22v6'} stroke="var(--tile-color)" strokeWidth="4" />
      {current && <>
        <path className="learning-beam" d="M31 35h58l8 50a37 19 0 0 1-74 0Z" fill={'url(#' + id + '-beam)'} />
        <ellipse cx="60" cy="87" rx="28" ry="13" fill="white" />
      </>}
      {check
        ? <polygon className="learning-orbit" points={octagon} pathLength="100" fill="none" stroke="var(--p-primary)" strokeWidth="3" strokeLinecap="round" />
        : <ellipse className="learning-orbit" cx="60" cy="89" rx="57" ry="33" pathLength="100" fill="none" stroke="var(--p-primary)" strokeWidth="3" strokeLinecap="round" />}
    </svg>
    {current ? <PathMascot /> : done && !check ? <Check aria-hidden="true" className="learning-tile-icon" size={22} strokeWidth={3.5} /> : null}
  </span>
}
