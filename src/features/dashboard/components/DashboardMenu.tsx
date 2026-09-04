import { useEffect, useId, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { BarChart3, LayoutGrid, Palette, ShoppingBag, Trophy, X } from 'lucide-react'
import DialogOverlay from '../../../shared/components/DialogOverlay'
import SettingsModal from '../../../shared/components/SettingsModal'
import { useAppStore } from '../../../shared/store/useAppStore'
import { useT } from '../../../shared/i18n'
import { type AchievementStats } from '../../../shared/api'
import { fetchAchievements, getAchievementsCache } from '../../../shared/lib/achievements-cache'
import { AchievementsScreen } from '../../profile'
import { subscribeModalStack } from '../../../shared/lib/navigation'

function DashboardAchievements({ onClose }: { onClose: () => void }) {
  const userId = useAppStore((s) => s.user?.id)
  const lang = useAppStore((s) => s.settings.language)
  const tt = useT(lang)
  const titleId = useId()
  const [stats, setStats] = useState<AchievementStats | null>(() => userId ? getAchievementsCache(userId).peek() : null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true
    if (!userId) return
    fetchAchievements(userId).then((result) => {
      if (active) setStats(result)
    }).catch(() => { if (active) setFailed(true) })
    return () => { active = false }
  }, [userId, lang, attempt])

  if (stats) return <AchievementsScreen stats={stats} tt={tt} onClose={onClose} />
  return <DialogOverlay onClose={onClose} labelId={titleId} position="center">
    <div className="relative w-full max-w-sm rounded-3xl bg-pcard p-6 text-pfg shadow-xl">
      <h2 id={titleId} className="mb-4 text-lg font-semibold">{tt('achTitle')}</h2>
      <p role="status" className="text-sm text-pmuted">{failed || !userId
        ? (lang === 'ru' ? 'Не удалось загрузить достижения' : "Yutuqlarni yuklab bo‘lmadi")
        : tt('loadingDots')}</p>
      <div className="mt-5 flex justify-end gap-3">
        {failed && <button type="button" className="min-h-11 rounded-xl px-4 text-pprimary" onClick={() => { setFailed(false); setAttempt((n) => n + 1) }}>{tt('retry')}</button>}
        <button type="button" className="min-h-11 rounded-xl bg-psurface px-4" onClick={onClose}>{tt('close')}</button>
      </div>
    </div>
  </DialogOverlay>
}

export default function DashboardMenu() {
  const [modalCount, setModalCount] = useState(0)
  useEffect(() => subscribeModalStack(setModalCount), [])
  const [panel, setPanel] = useState<'menu' | 'themes' | 'achievements' | null>(null)
  const lang = useAppStore((s) => s.settings.language)
  const userId = useAppStore((s) => s.user?.id)
  // Start before the user opens the menu; shared inflight request prevents duplicates.
  useEffect(() => {
    if (userId) void fetchAchievements(userId).catch(() => {})
  }, [userId])
  const tt = useT(lang)
  const navigate = useNavigate()
  const titleId = useId()
  const menuLabel = lang === 'ru' ? 'Меню' : 'Menyu'
  const close = () => setPanel(null)
  const actions = [
    { label: tt('statsTitle'), Icon: BarChart3, run: () => { close(); navigate('/statistika') } },
    { label: tt('achTitle'), Icon: Trophy, run: () => setPanel('achievements') },
    { label: tt('shopThemesTitle'), Icon: Palette, run: () => setPanel('themes') },
    { label: tt('shopMenuItem'), Icon: ShoppingBag, run: () => { close(); navigate('/shop') } },
  ]

  // Portal keeps the fixed controls outside route transitions and their transforms.
  return createPortal(<>
    <div style={{ visibility: panel || modalCount > 0 ? 'hidden' : undefined }} className="dashboard-menu-anchor pointer-events-none fixed inset-x-0 z-40 mx-auto flex max-w-2xl justify-end px-4">
      <button type="button" aria-label={menuLabel} title={menuLabel} aria-haspopup="dialog" aria-expanded={panel === 'menu'}
        onClick={() => setPanel('menu')}
        className="pointer-events-auto grid size-14 place-items-center rounded-full bg-pprimary text-ponprimary shadow-lg transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary focus-visible:ring-offset-4 focus-visible:ring-offset-pcanvas">
        <LayoutGrid size={22} aria-hidden="true" />
      </button>
    </div>
    {panel === 'menu' && <DialogOverlay onClose={close} labelId={titleId} backdropClassName="bg-black/50">
      <div className="dashboard-menu-anchor pointer-events-none absolute inset-x-0 mx-auto flex max-w-2xl flex-col items-end gap-3 px-4">
        <h2 id={titleId} className="sr-only">{menuLabel}</h2>
        <div className="flex max-h-[calc(100dvh-12rem-var(--safe-top,0px))] flex-col gap-3 overflow-y-auto p-1">
          {actions.map(({ label, Icon, run }, index) => <button key={label} type="button" onClick={run}
            style={{ animationDelay: `${index * 45}ms` }}
            className="dashboard-menu-action pointer-events-auto flex min-h-14 shrink-0 items-center justify-end gap-4 rounded-full pl-4 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
            <span className="text-[15px] font-semibold drop-shadow-md">{label}</span>
            <span className="grid size-14 shrink-0 place-items-center rounded-full bg-pcard text-pfg shadow-lg"><Icon size={23} strokeWidth={1.75} aria-hidden="true" /></span>
          </button>)}
        </div>
        <button type="button" aria-label={tt('close')} onClick={close}
          className="pointer-events-auto grid size-14 place-items-center rounded-full bg-pprimary text-ponprimary shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
          <X size={24} aria-hidden="true" />
        </button>
      </div>
    </DialogOverlay>}
    {panel === 'themes' && <SettingsModal initialPicker="accent" onClose={close} />}
    {panel === 'achievements' && <DashboardAchievements key={userId} onClose={close} />}
  </>, document.body)
}
