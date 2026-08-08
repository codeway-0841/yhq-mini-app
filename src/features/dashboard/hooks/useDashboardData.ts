import { useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { modules } from '../../../content/modules'
import { useAppStore } from '../../../shared/store/useAppStore'
import { useLessonsStore } from '../../../shared/store/useLessonsStore'
import { useQuestionsStore } from '../../../shared/store/useQuestionsStore'
import { useDailyStore, todayStr } from '../../../shared/store/useDailyStore'
import { type useT } from '../../../shared/i18n'

/** Serverdan bugungi holatni tortish + fan/til o'zgarganda savollarni qayta yuklash. */
export function useDashboardSync(userId: string | undefined, subjectId: string, lang: 'uz' | 'ru') {
  // Kun yoki fan o'zgarsa — bugungi holatni serverdan tortamiz
  useEffect(() => {
    if (userId) void useDailyStore.getState().sync(userId, todayStr(), subjectId)
  }, [userId, subjectId])

  // Fan almashtirilganda savollarni shu fanga qarab qayta yuklash (reload yo'q)
  useEffect(() => {
    const { load, subjectId: loadedSubject } = useQuestionsStore.getState()
    if (loadedSubject !== subjectId || !useQuestionsStore.getState().loaded) {
      void load(lang, subjectId)
    }
  }, [subjectId, lang])
}

// "Davom etish" — QAYSI darsda qolgan bo'lsa o'sha darslik ma'lumoti
export function useContinueInfo(userId: string | undefined, lang: 'uz' | 'ru', tt: ReturnType<typeof useT>) {
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
  }, [userId, lang, navigate, tt])
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
