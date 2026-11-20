/**
 * Xatolarim — hal qilinmagan xato savollar bilan ishlash sahifasi.
 *
 * wrongByTicket = "hozir YECHILMAGAN xatolar" (to'g'ri javob bersa avtomatik
 * o'chadi — useAppStore.addResult). Sahifa FAQAT joriy fan savollarini
 * filtrlaydi (savol ID'lari fan bankalari orasida takrorlanishi mumkin).
 *
 * Mashq oqimi: umumiy TestPage engine'idagi `questionIds` mexanizmi —
 * to'g'ri javob berilgan savol ro'yxatdan tushib qoladi.
 */
import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { goBack } from '../../shared/lib/navigation'
import { PageHeader } from '../../shared/components/ui/page-header'
import { HeartCrack, Play, ChevronRight, Flame, Sparkles } from 'lucide-react'
import { config } from '../../shared/config'
import { api } from '../../shared/api'
import { useAppStore } from '../../shared/store/useAppStore'
import MathText from '../../shared/components/MathText'
import { useQuestionsStore } from '../../shared/store/useQuestionsStore'
import { useSubjectStore } from '../../shared/store/useSubjectStore'
import { questionKey } from '../../../shared/subjects'
import { useT } from '../../shared/i18n'
import { Button } from '../../shared/components/ui/button'
import { SubscriptionModal } from '../premium'
import { BrilliantEndstateRive } from '../../shared/components/BrilliantEndstateRive'
import { BrilliantExtrasRive } from '../../shared/components/BrilliantExtrasRive'
import { haptics } from '../../platform/haptics'

export default function XatolarPage() {
  const navigate = useNavigate()
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false)
  // Selector'li obuna — whole-store EMAS
  const settings      = useAppStore((s) => s.settings)
  const wrongByTicket = useAppStore((s) => s.wrongByTicket)
  const tariff        = useAppStore((s) => s.tariff)
  const isPremium = tariff === 'premium'
  const tt = useT(settings.language)
  const { questions, topics } = useQuestionsStore()
  const subjectId = useSubjectStore((s) => s.subjectId)
  const lang = settings.language

  const isV2 = config.testSessionsV2Enabled

  // v2: Server overview
  const [serverOverview, setServerOverview] = useState<{
    total: number
    byTopic: Array<{ topicId: number; count: number }>
    top: Array<{ text: string; count: number; topicId: number | null; launchToken: string; expiresAt: string }>
  } | null>(null)

  useEffect(() => {
    if (!isV2) return
    let cancelled = false
    api.getTopMistakes(subjectId, lang)
      .then((res) => {
        if (!cancelled) setServerOverview(res)
      })
      .catch(() => {
        if (!cancelled) setServerOverview({ total: 0, byTopic: [], top: [] })
      })
    return () => {
      cancelled = true
    }
  }, [isV2, subjectId, lang])

  /** Joriy fan ichidagi hal qilinmagan xato savollar (composite kalit: '<fan>:<qid>') */
  const wrongQuestions = useMemo(
    () => questions.filter((q) => (wrongByTicket[questionKey(subjectId, q.id)] ?? 0) > 0),
    [questions, wrongByTicket, subjectId],
  )
  const total = isV2 ? (serverOverview?.total ?? 0) : wrongQuestions.length

  /** Mavzular kesimi (koproq xatosi bor mavzu yuqorida) */
  const byTopicV1 = useMemo(() => {
    const groups = new Map<number, number[]>()
    for (const q of wrongQuestions) {
      if (q.topicId == null) continue
      const arr = groups.get(q.topicId) ?? []
      arr.push(q.id)
      groups.set(q.topicId, arr)
    }
    return [...groups.entries()]
      .sort((a, b) => b[1].length - a[1].length)
      .map(([topicId, ids]) => {
        const topic = topics.find((t) => t.id === topicId)
        return {
          topicId,
          ids,
          count: ids.length,
          name: topic ? (lang === 'ru' ? topic.nameRu : topic.nameUz) : `#${topicId}`,
        }
      })
  }, [wrongQuestions, topics, lang])

  const byTopicV2 = useMemo(() => {
    if (!serverOverview?.byTopic) return []
    return serverOverview.byTopic.map((g) => {
      const topic = topics.find((t) => t.id === g.topicId)
      return {
        topicId: g.topicId,
        count: g.count,
        name: topic ? (lang === 'ru' ? topic.nameRu : topic.nameUz) : `#${g.topicId}`,
      }
    })
  }, [serverOverview, topics, lang])

  const startPracticeV1 = (ids: number[], title: string, serverSelector?: 'mistakes') => {
    if (ids.length === 0) return
    navigate('/test/1', {
      state: {
        questionIds: ids,
        title,
        ...(serverSelector ? { mode: serverSelector, serverSelector } : {}),
      },
    })
  }

  const startPracticeAllV2 = () => {
    haptics.impact('light')
    navigate('/test/1', {
      state: {
        mode: 'mistakes',
        serverSelector: 'mistakes',
      },
    })
  }

  const startPracticeTopicV2 = (topicId: number, title: string) => {
    haptics.impact('light')
    navigate('/test/1', {
      state: {
        mode: 'mistakes',
        serverSelector: { type: 'mistakes', topicId },
        title,
      },
    })
  }

  const startPracticeSingleV2 = (launchToken: string) => {
    haptics.impact('light')
    navigate('/test/1', {
      state: {
        mode: 'single',
        serverSelector: { type: 'single', launchToken },
      },
    })
  }

  /** Top-10 eng ko'p xato qilingan savollar (xato urinishlari soni badge) */
  const topHardV1 = useMemo(() =>
    wrongQuestions
      .map((q) => ({ q, count: wrongByTicket[questionKey(subjectId, q.id)] ?? 0 }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10),
    [wrongQuestions, wrongByTicket, subjectId],
  )

  const topHardV2 = serverOverview?.top ?? []
  const loadingV2 = isV2 && serverOverview === null
  const isRu = lang === 'ru'
  const activeTopics = isV2 ? byTopicV2 : byTopicV1
  const maxTopicCount = Math.max(1, ...activeTopics.map((g) => g.count))
  const estimatedMin = Math.max(2, Math.min(15, Math.ceil(total * 0.6)))

  return (
    <>
      <PageHeader title={tt('mistakesTitle')} size="lg" onBack={() => goBack(navigate)} backLabel={tt('backWord')} className="mb-3" />
      <div className="px-4 pb-6">

      {/* v2 yuklanish skeleton — bo'sh holat chaqnashini oldini oladi */}
      {loadingV2 && (
        <div className="space-y-3" aria-busy="true">
          <div className="h-[172px] rounded-[26px] border-2 border-pline bg-pcard animate-pulse" />
          <div className="h-[88px] rounded-[24px] border-2 border-pline bg-pcard animate-pulse" />
        </div>
      )}

      {/* Bo'sh holat */}
      {!loadingV2 && total === 0 && (
        <div className="rounded-[26px] border-2 border-pline bg-pcard p-8 flex flex-col items-center text-center shadow-[0_3px_0_var(--p-line)] dark:shadow-[0_3px_0_rgba(0,0,0,0.5)]">
          <div className="size-32 flex items-center justify-center mb-2">
            <BrilliantEndstateRive
              kind="review-complete"
              variant={0}
              dark={typeof document !== 'undefined' && document.body.dataset.theme === 'dark'}
              label="No Mistakes Review Complete"
              className="size-full"
              fallback={<HeartCrack size={26} className="text-pmuted" />}
            />
          </div>
          <p className="text-[19px] font-extrabold tracking-[-0.02em] text-pfg">{tt('mistakesEmptyTitle')}</p>
          <p className="text-[13px] font-medium text-pmuted mt-1.5 max-w-[260px] leading-relaxed">{tt('mistakesEmptyDesc')}</p>
        </div>
      )}

      {!loadingV2 && total > 0 && (
        <>
          {/* Umumiy holat + "Barchasini mashq qilish" (Brilliant 1:1 karta) */}
          <div className="rounded-[26px] border-2 border-pline bg-pcard p-5 mb-4 shadow-[0_3px_0_var(--p-line)] dark:shadow-[0_3px_0_rgba(0,0,0,0.5)]">
            <div className="flex items-center justify-between gap-2 mb-3">
              <span className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#e11d48] dark:text-[#fb7185]">
                {isRu ? 'Открытые ошибки' : 'Ochiq xatolar'}
              </span>
              <span className="text-[11.5px] font-bold tabular-nums text-pmuted">
                ~{estimatedMin} {isRu ? 'мин' : 'daq'}
              </span>
            </div>

            <div className="flex items-center gap-3.5 mb-4">
              <div className="size-16 flex items-center justify-center flex-shrink-0">
                <BrilliantEndstateRive
                  kind="review-mistakes"
                  totalNum={total}
                  correctNum={0}
                  variant={2}
                  dark={typeof document !== 'undefined' && document.body.dataset.theme === 'dark'}
                  label="Review Mistakes"
                  className="size-full"
                  fallback={<HeartCrack size={24} className="text-pmuted" />}
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-display text-[36px] font-extrabold tracking-[-0.03em] tabular-nums text-pfg leading-none">
                  {total}
                </p>
                <p className="text-[13px] font-semibold text-pmuted mt-1">{tt('unansweredWord')}</p>
              </div>
            </div>
            <Button block size="lg" variant="primary" onClick={() => isV2 ? startPracticeAllV2() : startPracticeV1(
              wrongQuestions.map((q) => q.id), tt('fixMistakes'), 'mistakes',
            )}>
              <Play size={16} strokeWidth={2.2} />
              {tt('practiceAll')}
            </Button>
          </div>

          {/* Mavzular kesimi + Top-10 tahlil — PREMIUM funksiya */}
          {!isPremium && (
            <div className="rounded-[24px] border-2 border-pline bg-pcard w-full p-4 mb-4 flex items-center gap-3 shadow-[0_3px_0_var(--p-line)] dark:shadow-[0_3px_0_rgba(0,0,0,0.5)]">
              <div className="size-14 flex items-center justify-center flex-shrink-0">
                <BrilliantExtrasRive
                  kind="practice-nudge"
                  dark={typeof document !== 'undefined' && document.body.dataset.theme === 'dark'}
                  label="Personalized Practice Nudge"
                  className="size-full"
                  fallback={<Sparkles size={22} className="text-pmuted" />}
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[14.5px] font-extrabold text-pfg leading-snug">{tt('premiumMistakesTitle')}</p>
                <p className="text-[12px] font-medium text-pmuted mt-0.5 leading-snug">{tt('premiumMistakesDesc')}</p>
              </div>
              <Button
                size="sm"
                variant="secondary"
                className="flex-shrink-0"
                onClick={() => {
                  haptics.impact('light')
                  setShowSubscriptionModal(true)
                }}
              >
                {tt('subscribe')}
              </Button>
            </div>
          )}
          {isPremium && activeTopics.length > 0 && (
            <>
              <p className="text-[11px] font-extrabold text-pmuted uppercase tracking-[0.08em] mb-2 px-0.5">{tt('byTopicsWord')}</p>
              <div className="rounded-[24px] border-2 border-pline bg-pcard overflow-hidden mb-5 shadow-[0_3px_0_var(--p-line)] dark:shadow-[0_3px_0_rgba(0,0,0,0.5)] divide-y divide-pline">
                {activeTopics.map((g) => {
                  const pct = Math.max(8, Math.round((g.count / maxTopicCount) * 100))
                  return (
                    <button
                      key={g.topicId}
                      onClick={() => {
                        haptics.impact('light')
                        if (isV2) startPracticeTopicV2(g.topicId, g.name)
                        else if ('ids' in g) startPracticeV1(g.ids, g.name)
                      }}
                      className="w-full px-4 py-3.5 text-left active:bg-psurface transition-colors cursor-pointer touch-manipulation"
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex-1 text-[14px] font-bold text-pfg truncate">{g.name}</span>
                        <span className="bg-[#fee2e2] dark:bg-[rgba(248,113,113,0.2)] text-[#dc2626] dark:text-[#fca5a5] text-[11.5px] font-extrabold px-2.5 py-0.5 rounded-full flex-shrink-0 tabular-nums">
                          {g.count}
                        </span>
                        <span className="text-[12px] font-bold text-pmuted flex-shrink-0">{tt('practiceWord')} ›</span>
                      </div>
                      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-psurface">
                        <div
                          className="h-full rounded-full bg-[#e11d48] dark:bg-[#fb7185]"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </button>
                  )
                })}
              </div>
            </>
          )}

          {/* Top-10 eng qiyin savollar */}
          {isPremium && (isV2 ? topHardV2.length > 0 : topHardV1.length > 0) && (
            <>
              <p className="text-[11px] font-extrabold text-pmuted uppercase tracking-[0.08em] mb-2 px-0.5 flex items-center gap-1.5">
                <Flame size={13} className="text-[#e11d48] dark:text-[#fb7185]" />
                {tt('topMistakes')}
              </p>
              <div className="flex flex-col gap-2.5 lg:grid lg:grid-cols-2 lg:items-start">
                {isV2 ? (
                  topHardV2.map((item, i) => (
                    <button
                      key={item.launchToken || i}
                      onClick={() => { haptics.impact('light'); startPracticeSingleV2(item.launchToken) }}
                      className="rounded-[20px] border-2 border-pline bg-pcard p-3.5 flex items-center gap-3 text-left shadow-[0_3px_0_var(--p-line)] dark:shadow-[0_3px_0_rgba(0,0,0,0.5)] active:translate-y-[2px] active:shadow-[0_1px_0_var(--p-line)] transition-[transform,box-shadow] cursor-pointer touch-manipulation"
                    >
                      <span className="flex size-7 items-center justify-center rounded-full bg-psurface text-[12px] font-extrabold text-pfg flex-shrink-0 tabular-nums">
                        {i + 1}
                      </span>
                      <span
                        className="flex-1 min-w-0 text-[13px] font-bold text-pfg leading-snug"
                        style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
                      >
                        <MathText text={item.text} />
                      </span>
                      <span className="bg-[rgb(var(--p-warning-rgb)/0.16)] text-pwarning text-[11px] font-extrabold px-2.5 py-0.5 rounded-full flex-shrink-0 tabular-nums">
                        {item.count} {tt('timesWord')}
                      </span>
                      <ChevronRight size={16} className="text-pmuted flex-shrink-0" />
                    </button>
                  ))
                ) : (
                  topHardV1.map(({ q, count }, i) => (
                    <button
                      key={q.id}
                      onClick={() => { haptics.impact('light'); startPracticeV1([q.id], tt('topMistakes')) }}
                      className="rounded-[20px] border-2 border-pline bg-pcard p-3.5 flex items-center gap-3 text-left shadow-[0_3px_0_var(--p-line)] dark:shadow-[0_3px_0_rgba(0,0,0,0.5)] active:translate-y-[2px] active:shadow-[0_1px_0_var(--p-line)] transition-[transform,box-shadow] cursor-pointer touch-manipulation"
                    >
                      <span className="flex size-7 items-center justify-center rounded-full bg-psurface text-[12px] font-extrabold text-pfg flex-shrink-0 tabular-nums">
                        {i + 1}
                      </span>
                      <span
                        className="flex-1 min-w-0 text-[13px] font-bold text-pfg leading-snug"
                        style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
                      >
                        <MathText text={q.text} />
                      </span>
                      <span className="bg-[rgb(var(--p-warning-rgb)/0.16)] text-pwarning text-[11px] font-extrabold px-2.5 py-0.5 rounded-full flex-shrink-0 tabular-nums">
                        {count} {tt('timesWord')}
                      </span>
                      <ChevronRight size={16} className="text-pmuted flex-shrink-0" />
                    </button>
                  ))
                )}
              </div>
            </>
          )}
        </>
      )}

      {showSubscriptionModal && (
        <SubscriptionModal
          onClose={() => setShowSubscriptionModal(false)}
        />
      )}
    </div>
    </>
  )
}
