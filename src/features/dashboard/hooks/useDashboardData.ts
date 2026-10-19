import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { modules } from '../../../content/modules'
import { useAppStore } from '../../../shared/store/useAppStore'
import { useLessonsStore } from '../../../shared/store/useLessonsStore'
import { useQuestionsStore, cachedQuestionCount } from '../../../shared/store/useQuestionsStore'
import { config } from '../../../shared/config'
import { useDailyStore, todayStr } from '../../../shared/store/useDailyStore'
import { type useT } from '../../../shared/i18n'
import {
  api,
  type LearningSummary,
  type LearningSummaryAggregate,
} from '../../../shared/api'

/** Faqat joriy fan banki yoki shu fanning oxirgi ma’lum soni. */
export function useDashboardQuestionCount(subjectId: string): number {
  const count = useQuestionsStore((s) =>
    s.subjectId === subjectId && s.loaded ? s.questions.length : null
  )
  return count ?? cachedQuestionCount(subjectId)
}

/**
 * Joriy fan uchun server-authoritative tayyorgarlik xulosasi.
 * Tarmoq javobi kelguncha legacy/local ma'lumotdan konservativ fallback
 * ko'rsatiladi; eski fan javobi yangi fan kartasiga hech qachon qo'llanmaydi.
 */
export function useLearningSummary(input: {
  userId: string | undefined
  subjectId: string
  totalQuestions: number
  answered: number
  unresolvedMistakes: number
}): LearningSummary {
  const { userId, subjectId, totalQuestions, answered, unresolvedMistakes } = input
  const fallback = useMemo<LearningSummary>(() => {
    const safeAnswered = Math.max(0, answered)
    const safeMistakes = Math.min(safeAnswered, Math.max(0, unresolvedMistakes))
    const mastered = totalQuestions > 0
      ? Math.min(totalQuestions, Math.max(0, safeAnswered - safeMistakes))
      : 0
    return {
      subjectId,
      totalQuestions: Math.max(0, totalQuestions),
      answered: safeAnswered,
      mastered,
      unresolvedMistakes: safeMistakes,
      dueNow: 0,
      readinessPercent: totalQuestions > 0
        ? Math.min(100, Math.round((mastered / totalQuestions) * 100))
        : 0,
    }
  }, [subjectId, totalQuestions, answered, unresolvedMistakes])
  const [remote, setRemote] = useState<LearningSummaryAggregate | null>(null)

  useEffect(() => {
    if (!userId || userId === '0') return
    let cancelled = false
    api.getLearningSummary(subjectId)
      .then((summary) => {
        if (!cancelled && summary.subjectId === subjectId) setRemote(summary)
      })
      .catch(() => { /* offline: local fallback yuqorida qoladi */ })
    return () => { cancelled = true }
  }, [userId, subjectId])

  if (remote?.subjectId !== subjectId) return fallback
  const safeTotal = Math.max(0, totalQuestions)
  const safeMastered = safeTotal > 0 ? Math.min(safeTotal, Math.max(0, remote.mastered)) : 0
  return {
    ...remote,
    totalQuestions: safeTotal,
    mastered: safeMastered,
    readinessPercent: safeTotal > 0
      ? Math.min(100, Math.round((safeMastered / safeTotal) * 100))
      : 0,
  }
}

/** Serverdan bugungi holatni tortish + fan/til o'zgarganda savollarni qayta yuklash. */
export function useDashboardSync(userId: string | undefined, subjectId: string, lang: 'uz' | 'ru') {
  // Kun yoki fan o'zgarsa — bugungi holatni serverdan tortamiz
  useEffect(() => {
    if (userId) void useDailyStore.getState().sync(userId, todayStr(), subjectId)
  }, [userId, subjectId])

  // Fan almashtirilganda katalogni shu fanga qarab qayta yuklash (reload yo'q).
  // v2: faqat metadata (dashboard savol matnini ko'rsatmaydi).
  useEffect(() => {
    const st = useQuestionsStore.getState()
    if (config.testSessionsV2Enabled) {
      if (st.subjectId !== subjectId || st.topics.length === 0) {
        void st.loadTopics(subjectId).catch(() => {})
      }
      return
    }
    const { load, subjectId: loadedSubject } = st
    if (loadedSubject !== subjectId || !st.loaded) {
      void load(lang, subjectId)
    }
  }, [subjectId, lang])
}

// "Davom etish" — QAYSI darsda qolgan bo'lsa o'sha darslik ma'lumoti
// `lang` param'i olib tashlandi (2026-08-27 lint tozaligi): tt allaqachon
// joriy tilni o'z ichiga oladi — alohida param redundant edi.
export function useContinueInfo(userId: string | undefined, tt: ReturnType<typeof useT>) {
  const navigate = useNavigate()
  return useMemo(() => {
    const uid     = userId ?? '0'
    const doneMap = useLessonsStore.getState().byUser[uid] ?? {}
    for (const mod of modules) {
      const done = doneMap[mod.id] ?? []
      for (let i = 0; i < mod.lessonCount; i++) {
        if (!done.includes(i)) {
          return {
            mod,
            pct: Math.round((done.length / mod.lessonCount) * 100),
            lessonLabel: `${tt('lessonWord')} ${i + 1}/${mod.lessonCount}`,
            allDone: false,
            go: () => navigate('/darslik', { state: { moduleId: mod.id, lessonIdx: i } }),
          }
        }
      }
    }
    const last = modules[modules.length - 1]
    return {
      mod: last,
      pct: 100,
      lessonLabel: `${tt('lessonWord')} ${last.lessonCount}/${last.lessonCount}`,
      allDone: true,
      go: () => navigate('/darslik'),
    }
  }, [userId, navigate, tt])
}

/** Badge hisoblagichlar — faqat JORIY fanga oid (composite kalit: '<subjectId>:<qid>'). */
export function useSubjectBadges(subjectId: string) {
  const wrongByTicket  = useAppStore((s) => s.wrongByTicket)
  const savedQuestions = useAppStore((s) => s.savedQuestions)

  // "Xatolarni tuzatish" badge = hozir yechilmagan xato SAVOLLAR soni (joriy fan).
  // (wrongByTicket qiymati esa ketma-ket xato urinishlar soni — ro'yxat savollarni sanaydi,
  //  shuning uchun badge ro'yxat uzunligiga teng bo'lishi kerak: 4 savol = 4, urinishlar 8 emas)
  const mistakesCount = useMemo(
    () => Object.entries(wrongByTicket).filter(([k, n]) => n > 0 && k.startsWith(`${subjectId}:`)).length,
    [wrongByTicket, subjectId]
  )

  // Saved badge — faqat joriy fanga oid bookmarklar soni
  const savedCountForSubject = useMemo(
    () => savedQuestions.filter((k) => k.startsWith(`${subjectId}:`)).length,
    [savedQuestions, subjectId]
  )

  return { mistakesCount, savedCountForSubject }
}
