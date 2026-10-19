import type { ReactNode } from 'react'
import ModalShell from './ModalShell'
import { SpecCard } from './ui/spec'
import { Button } from './ui/button'
import { useT } from '../i18n'
import { useAppStore } from '../store/useAppStore'

type InfoSection =
  | { kind: 'paragraph'; text: string }
  | { kind: 'list'; items: string[] }

function parseInfoBody(body: string): InfoSection[] {
  const sections: InfoSection[] = []

  for (const rawLine of body.split('\n')) {
    const line = rawLine.trim()
    if (!line) continue

    if (line.startsWith('•')) {
      const item = line.slice(1).trim()
      const last = sections[sections.length - 1]
      if (last?.kind === 'list') last.items.push(item)
      else sections.push({ kind: 'list', items: [item] })
    } else {
      sections.push({ kind: 'paragraph', text: line })
    }
  }

  return sections
}

/** Level/XP/Coin/Liga statistikalari uchun bosilganda ochiladigan tushuntirish sheet. */
export default function StatInfoSheet({ icon, title, body, extra, onClose }: {
  icon?:   ReactNode
  title:  string
  body:   string
  extra?: ReactNode
  onClose: () => void
}) {
  const lang = useAppStore((s) => s.settings.language)
  const tt = useT(lang)
  const sections = parseInfoBody(body)

  return (
    <ModalShell
      title={title}
      onClose={onClose}
      labelId="stat-info-title"
      closeLabel={tt('close') || 'Yopish'}
      zIndex={60}
      backdropClassName="bg-black/60"
    >
        <SpecCard className="p-5">
          {icon && (
            <div className="mb-4 flex size-10 items-center justify-center rounded-xl bg-[rgb(var(--p-primary-rgb)/0.14)] text-pprimary" aria-hidden="true">
              {icon}
            </div>
          )}

          <div className="space-y-4 text-[15px] leading-6 text-pfg">
            {sections.map((section, sectionIndex) => section.kind === 'list' ? (
              <ul key={`list-${sectionIndex}`} className="space-y-3">
                {section.items.map((item, itemIndex) => (
                  <li key={`${sectionIndex}-${itemIndex}`} className="grid grid-cols-[8px_minmax(0,1fr)] items-start gap-3">
                    <span aria-hidden="true" className="mt-[9px] size-1.5 rounded-full bg-pprimary" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p key={`paragraph-${sectionIndex}`} className="text-pmuted">
                {section.text}
              </p>
            ))}
          </div>

          {extra && (
            <div className="mt-4 border-t border-pline pt-4 text-sm font-semibold text-pfg">
              {extra}
            </div>
          )}
        </SpecCard>

        <div className="relative z-10 mt-4">
          <Button block onClick={onClose}>
            {tt('gotItBtn')}
          </Button>
        </div>
    </ModalShell>
  )
}
