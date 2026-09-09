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
import { HeartCrack, Play, ChevronRight, Flame, ChevronLeft, Sparkles } from 'lucide-react'
import { config } from '../../shared/config'
import { api } from '../../shared/api'
import { useAppStore } from '../../shared/store/useAppStore'
import { useQuestionsStore } from '../../shared/store/useQuestionsStore'
import { useSubjectStore } from '../../shared/store/useSubjectStore'
import { questionKey } from '../../../shared/subjects'
import { useT } from '../../shared/i18n'
import { Button } from '../../shared/components/ui/button'
import { SubscriptionModal } from '../premium'
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

  return (
    <div className="px-4 pb-4">
      <header className="sticky top-0 z-30 -mt-[var(--safe-top-body,0px)] pt-[var(--safe-top,0px)] -mx-4 px-4 py-2.5 bg-pcanvas border-b border-pline flex items-center gap-2 mb-4">
        <button onClick={() => goBack(navigate)} aria-label={tt('backWord')}
          className="grid size-10 place-items-center rounded-xl text-pmuted transition-colors duration-150 ease-out hover:bg-psurface hover:text-pfg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary">
          <ChevronLeft size={20} strokeWidth={1.75} />
        </button>
        <h1 className="text-xl font-semibold">{tt('mistakesTitle')}</h1>
      </header>

      {/* Bo'sh holat */}
      {total === 0 && (
        <div className="rounded-2xl bg-pcard p-8 flex flex-col items-center text-center shadow-xs">
          <div className="size-12 flex items-center justify-center mb-4">
            <HeartCrack size={26} className="text-pmuted" />
          </div>
          <p className="text-[17px] font-semibold text-pfg">{tt('mistakesEmptyTitle')}</p>
          <p className="text-[12px] text-psubtle mt-1.5">{tt('mistakesEmptyDesc')}</p>
        </div>
      )}

      {total > 0 && (
        <>
          {/* Umumiy holat + "Barchasini mashq qilish" */}
          <div className="rounded-2xl bg-pcard p-4 mb-4 shadow-xs">
            <div className="flex items-center gap-3 mb-3.5">
              <div className="size-11 flex items-center justify-center flex-shrink-0">
                <HeartCrack size={22} className="text-pmuted" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[24px] font-semibold text-pfg leading-none">{total}</p>
                <p className="text-[11px] text-psubtle mt-1">{total} {tt('unansweredWord')}</p>
              </div>
            </div>
            <button onClick={() => isV2 ? startPracticeAllV2() : startPracticeV1(
              wrongQuestions.map((q) => q.id), tt('fixMistakes'), 'mistakes',
            )}
              className="bg-pprimary text-ponprimary font-semibold hover:brightness-[1.06] active:scale-[0.98] transition-[transform,background-color,filter] duration-150 w-full py-3.5 rounded-xl text-[14px] flex items-center justify-center gap-2 shadow-xs">
              <Play size={16} strokeWidth={1.75} />
              {tt('practiceAll')}
            </button>
          </div>

          {/* Mavzular kesimi + Top-10 tahlil — PREMIUM funksiya */}
          {!isPremium && (
            <div className="rounded-2xl bg-pcard w-full p-4 mb-4 flex items-center gap-3 shadow-xs">
              <div className="size-11 flex items-center justify-center flex-shrink-0">
                <Sparkles size={22} className="text-pmuted" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-semibold text-pfg">{tt('premiumMistakesTitle')}</p>
                <p className="text-[11px] text-psubtle mt-1 leading-snug">{tt('premiumMistakesDesc')}</p>
              </div>
              <Button
                size="sm"
                className="flex-shrink-0 font-bold tracking-tight text-[12.5px] px-3.5 py-1.5 shadow-sm active:scale-95 transition-transform cursor-pointer"
                onClick={() => {
                  haptics.impact('light')
                  setShowSubscriptionModal(true)
                }}
              >
                {tt('subscribe')}
              </Button>
            </div>
          )}
          {isPremium && (isV2 ? byTopicV2.length > 0 : byTopicV1.length > 0) && (
            <>
              <p className="text-[10px] font-semibold text-psubtle uppercase tracking-[0.12em] mb-1.5">{tt('byTopicsWord')}</p>
              <div className="rounded-2xl bg-pcard overflow-hidden mb-4 shadow-xs divide-y divide-pline">
                {(isV2 ? byTopicV2 : byTopicV1).map((g) => (
                  <button
                    key={g.topicId}
                    onClick={() => isV2 ? startPracticeTopicV2(g.topicId, g.name) : startPracticeV1((g as any).ids, g.name)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-psurface transition-colors"
                  >
                    <span className="flex-1 text-[13px] font-semibold text-pfg truncate">{g.name}</span>
                    <span className="bg-pdanger/15 text-pdanger text-[11px] font-semibold px-2.5 py-0.5 rounded-full flex-shrink-0">
                      {g.count}
                    </span>
                    <span className="text-[11px] font-semibold text-psubtle flex-shrink-0">{tt('practiceWord')} ›</span>
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Top-10 eng qiyin savollar */}
          {isPremium && (isV2 ? topHardV2.length > 0 : topHardV1.length > 0) && (
            <>
              <p className="text-[10px] font-semibold text-psubtle uppercase tracking-[0.12em] mb-1.5 flex items-center gap-1.5">
                <Flame size={12} className="text-pmuted" />
                {tt('topMistakes')}
              </p>
              <div className="flex flex-col gap-2">
                {isV2 ? (
                  topHardV2.map((item, i) => (
                    <button
                      key={item.launchToken || i}
                      onClick={() => startPracticeSingleV2(item.launchToken)}
                      className="rounded-2xl bg-pcard p-3.5 flex items-center gap-3 text-left active:scale-[0.99] transition-transform shadow-xs hover:bg-psurface"
                    >
                      <span className="w-6 text-center text-[12px] font-semibold text-psubtle flex-shrink-0 tabular-nums">
                        {i + 1}
                      </span>
                      <span
                        className="flex-1 min-w-0 text-[12px] font-semibold text-pfg leading-snug"
                        style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
                      >
                        {item.text}
                      </span>
                      <span className="bg-pwarning/15 text-pwarning text-[11px] font-semibold px-2.5 py-0.5 rounded-full flex-shrink-0">
                        {item.count} {tt('timesWord')}
                      </span>
                      <ChevronRight size={15} className="text-psubtle flex-shrink-0" />
                    </button>
                  ))
                ) : (
                  topHardV1.map(({ q, count }, i) => (
                    <button
                      key={q.id}
                      onClick={() => startPracticeV1([q.id], tt('topMistakes'))}
                      className="rounded-2xl bg-pcard p-3.5 flex items-center gap-3 text-left active:scale-[0.99] transition-transform shadow-xs hover:bg-psurface"
                    >
                      <span className="w-6 text-center text-[12px] font-semibold text-psubtle flex-shrink-0 tabular-nums">
                        {i + 1}
                      </span>
                      <span
                        className="flex-1 min-w-0 text-[12px] font-semibold text-pfg leading-snug"
                        style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
                      >
                        {q.text}
                      </span>
                      <span className="bg-pwarning/15 text-pwarning text-[11px] font-semibold px-2.5 py-0.5 rounded-full flex-shrink-0">
                        {count} {tt('timesWord')}
                      </span>
                      <ChevronRight size={15} className="text-psubtle flex-shrink-0" />
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
  )
}
