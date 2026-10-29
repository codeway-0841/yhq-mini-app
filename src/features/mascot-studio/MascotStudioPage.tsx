import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '../../shared/components/ui/page-header'
import { useAppStore } from '../../shared/store/useAppStore'
import { useT } from '../../shared/i18n'
import { goBack } from '../../shared/lib/navigation'
import { MASCOT_ANIMATIONS, type MascotAnimation } from './animations'
import { RiveCanvas } from './RiveCanvas'
import './mascot-studio.css'

function AnimationCard({ item }: { item: MascotAnimation }) {
  const language = useAppStore((s) => s.settings.language)
  const tt = useT(language)
  const [active, setActive] = useState(item.animations[0])
  const title = tt(item.titleKey)

  return (
    <article className="mascot-card rounded-2xl bg-pcard shadow-xs">
      <RiveCanvas file={item.file} animation={active} poster={item.poster} label={title} />
      <div className="mascot-card-copy">
        <h2>{title}</h2>
        <p>{tt(item.descriptionKey)}</p>
      </div>
      <div className="mascot-actions" role="group" aria-label={`${title}: ${tt('mascotActions')}`}>
        {item.animations.map((name) => (
          <button
            key={name}
            type="button"
            aria-pressed={active === name}
            onClick={() => setActive(name)}
            className="mascot-action rounded-xl shadow-2xs"
          >
            {name.trim()}
          </button>
        ))}
      </div>
    </article>
  )
}

export default function MascotStudioPage() {
  const navigate = useNavigate()
  const language = useAppStore((s) => s.settings.language)
  const tt = useT(language)

  return (
    <main className="mascot-studio px-4 pb-8">
      <PageHeader title={tt('mascotStudioTitle')} size="md" onBack={() => goBack(navigate)} className="-mx-4" />
      <p className="mascot-studio-intro">{tt('mascotStudioIntro')}</p>
      <div className="mascot-grid">
        {MASCOT_ANIMATIONS.map((item) => <AnimationCard key={item.id} item={item} />)}
      </div>
    </main>
  )
}
