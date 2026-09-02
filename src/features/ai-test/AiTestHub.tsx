/**
 * AI Kunlik Test — HUB sahifasi (/ai-test).
 * Bugungi 2 variant: slot 1 (free) + slot 2 (premium qulf bilan).
 * Yechilgan variant: ball + coin ko'rinadi, "Natija"ga o'tadi.
 * Ma'lumot: GET /api/ai-tests/today (server, no-store).
 */

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, Sparkles, Lock, CheckCircle2 } from 'lucide-react'
import { api, type AiTestTodayItem } from '../../shared/api'
import { useAppStore } from '../../shared/store/useAppStore'
import { useT } from '../../shared/i18n'
import { goBack } from '../../shared/lib/navigation'
import { track } from '../../shared/lib/analytics'
import { AI_TEST_SUBJECT_ID, AI_TEST_MAX_COINS, AI_TEST_GRADED_TASKS } from '../../../shared/ai-daily-test'

export default function AiTestHub() {
  const navigate = useNavigate()
  const settings  = useAppStore((s) => s.settings)
  const isPremium = useAppStore((s) => s.tariff === 'premium')
  const tt = useT(settings.language)

  const [tests, setTests] = useState<AiTestTodayItem[] | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    api.getTodayAiTests(AI_TEST_SUBJECT_ID)
      .then((r) => { if (!cancelled) setTests(r.tests) })
      .catch(() => { if (!cancelled) setError(true) })
    return () => { cancelled = true }
  }, [])

  const open = (t: AiTestTodayItem) => {
    track('ai_test_open', { slot: t.slot, attempted: t.attempted })
    if (t.premiumRequired && !isPremium) {
      navigate('/premium')
      return
    }
    navigate(`/ai-test/${t.id}`)
  }

  return (
    <div className="px-4 pb-4">
      <header className="sticky top-0 z-30 -mt-[var(--safe-top-body,0px)] pt-[var(--safe-top,0px)] -mx-4 px-4 py-2.5 bg-pcanvas border-b border-pline flex items-center gap-2 mb-4">
        <button onClick={() => goBack(navigate)} aria-label={tt('backWord')}
          className="grid size-10 place-items-center rounded-control text-pmuted transition-colors duration-[120ms] ease-out hover:bg-psurface hover:text-pfg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary">
          <ChevronLeft size={20} strokeWidth={1.75} />
        </button>
        <h1 className="text-xl font-semibold">{tt('aiTestTitle')}</h1>
      </header>

      {tests === null && !error && (
        <div className="grid place-items-center py-16">
          <div className="w-8 h-8 rounded-full border-2 border-ppurple border-t-transparent animate-spin" />
        </div>
      )}

      {(error || (tests !== null && tests.length === 0)) && (
        <div className="rounded-container border border-pline bg-pcard p-6 text-center">
          <Sparkles size={28} strokeWidth={1.75} className="mx-auto mb-2 text-ppurple" />
          <p className="text-[14px] text-pmuted">{tt('aiTestEmpty')}</p>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {tests?.map((t) => {
          const locked = t.premiumRequired && !isPremium
          return (
            <button
              key={t.id}
              onClick={() => open(t)}
              className="relative rounded-container border border-pline bg-pcard w-full flex items-center gap-3.5 p-4 active:scale-[0.98] transition-transform text-left"
            >
              {!t.attempted && (
                <span className="absolute -top-2 right-3 rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide text-ponprimary bg-ppurple animate-pulse">
                  {tt('aiTestNew')}
                </span>
              )}
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
                style={{
                  background: 'color-mix(in srgb, var(--p-purple) 12%, transparent)',
                }}>
                {locked
                  ? <Lock size={24} strokeWidth={2} style={{ color: 'var(--p-purple)' }} />
                  : t.attempted
                    ? <CheckCircle2 size={26} strokeWidth={2} className="text-psuccess" />
                    : <Sparkles size={26} strokeWidth={2} style={{ color: 'var(--p-purple)' }} />}
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-[16px] font-semibold text-pfg leading-tight truncate">{t.title}</p>
                <p className="text-[11.5px] text-psubtle mt-0.5">
                  {t.taskCount} {tt('aiTestTaskWord')} · ≤{AI_TEST_MAX_COINS} {tt('aiTestCoinsEarned').toLowerCase()}
                </p>
                {t.attempted ? (
                  <span className="inline-flex items-center gap-1 mt-2 text-[11px] font-semibold text-psuccess">
                    <span className="size-2 rounded-full bg-psuccess" />
                    {tt('aiTestDone')} · {t.scoreCorrect}/{AI_TEST_GRADED_TASKS} {tt('aiTestCorrectWord').toLowerCase()}
                    {t.coinsAwarded != null && ` · +${t.coinsAwarded}🪙`}
                  </span>
                ) : locked ? (
                  <span className="inline-flex items-center gap-1 mt-2 text-[11px] font-semibold" style={{ color: 'var(--p-purple)' }}>
                    <span className="size-2 rounded-full" style={{ background: 'var(--p-purple)' }} />
                    {tt('aiTestPremiumCta')}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 mt-2 text-[11px] font-semibold" style={{ color: 'var(--p-warning)' }}>
                    <span className="size-2 rounded-full" style={{ background: 'var(--p-warning)' }} />
                    {tt('aiTestStart')}
                  </span>
                )}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
