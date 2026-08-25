import { create } from 'zustand'
import { api, dbToQuestion, DbQuestion, DbTopic, Question } from '../api'
import { useSubjectStore } from './useSubjectStore'
import { readOfflinePackage, type OfflineQuestionRow } from '../lib/offlinePackage'

interface QuestionsState {
  questions: Question[]
  topics:    DbTopic[]
  loaded:    boolean
  loading:   boolean
  error:     string | null
  /** Language the currently mapped questions are in. */
  lang:      'uz' | 'ru'
  /** Qaysi fan uchun yuklangan (subject almashganda qayta yuklanadi). */
  subjectId: string
  /** true — `questions` onlayn server'dan EMAS, yuklab olingan oflayn paketdan kelgan. */
  isOfflinePractice: boolean
  /** questionId → correctAnswer — FAQAT isOfflinePractice===true bo'lganda to'ldiriladi, lokal scoring uchun. */
  offlineAnswers: Record<number, string>
  load:      (lang: 'uz' | 'ru', subjectId?: string) => Promise<void>
  /** Admin CRUD'dan keyin cache'dan qat'iatan qayta yuklash (force) */
  reload:    () => Promise<void>
  /** Re-map already-fetched questions to another language — no network call. */
  setLang:   (lang: 'uz' | 'ru') => void
}

// Raw (til-mapping'siz) PUBLIC savollar — language switch'da re-fetch'siz
// qayta map qilish uchun. correctAnswer bu yerda YO'Q (server strip qiladi),
// FAQAT isOfflinePractice===false bo'lganda mazmunli.
let rawQuestions: DbQuestion[] = []
// Xuddi shu maqsad — FAQAT isOfflinePractice===true bo'lganda to'ldiriladi,
// setLang() til almashtirishda tarmoqqa qayta murojaat qilmasdan (bu urinish
// baribir muvaffaqiyatsiz bo'lardi — offline) to'g'ridan-to'g'ri qayta xaritalaydi.
let rawOfflineQuestions: OfflineQuestionRow[] = []
let loadVersion = 0

export const useQuestionsStore = create<QuestionsState>((set, get) => ({
  questions: [],
  topics:    [],
  loaded:    false,
  loading:   false,
  error:     null,
  lang:      'uz',
  subjectId: useSubjectStore.getState().subjectId || 'yhq',
  isOfflinePractice: false,
  offlineAnswers: {},

  async load(lang, subjectId) {
    const sid = subjectId ?? useSubjectStore.getState().subjectId ?? get().subjectId
    // Shu til + shu fan allaqachon yuklangan
    if (get().loaded && get().lang === lang && get().subjectId === sid) return
    const version = ++loadVersion
    set({ loading: true, error: null })
    try {
      const [raw, topics] = await Promise.all([api.getQuestions(sid), api.getTopics(sid)])
      if (version !== loadVersion) return
      rawQuestions = raw
      set({
        questions: raw.map((q) => dbToQuestion(q, lang)), topics, loaded: true, lang, subjectId: sid,
        isOfflinePractice: false, offlineAnswers: {},
      })
    } catch (e) {
      if (version !== loadVersion) return
      // OFLAYN MASHQ: online urinish muvaffaqiyatsiz — shu fan uchun oldindan
      // yuklab olingan paket bormi tekshiramiz (src/shared/lib/offlinePackage.ts).
      const offlineRows = await readOfflinePackage(sid).catch(() => null)
      if (version !== loadVersion) return
      if (offlineRows && offlineRows.length > 0) {
        rawOfflineQuestions = offlineRows
        const offlineAnswers: Record<number, string> = {}
        for (const row of offlineRows) offlineAnswers[row.id] = row.correctAnswer
        set({
          questions: offlineRows.map((q) => dbToQuestion(q, lang)),
          topics: [], loaded: true, lang, subjectId: sid,
          isOfflinePractice: true, offlineAnswers,
        })
        return
      }
      // Yuklab bo'lmadi va oflayn paket ham yo'q: ESKI fanning ma'lumotlari
      // ekranda qolib ketmasin (xato xabari yangi fan haqida bo'lsa-da).
      // subjectId shu yerda ham yangilanadi — aks holda keyinchalik eski fanga
      // qaytilganda load()ning `loaded` qorovuli noto'g'ri ishlab ketardi.
      set({
        error: e instanceof Error ? e.message : 'Failed to load questions',
        subjectId: sid, questions: [], topics: [], loaded: false,
        isOfflinePractice: false, offlineAnswers: {},
      })
    } finally {
      if (version === loadVersion) set({ loading: false })
    }
  },

  async reload() {
    const { lang, subjectId } = get()
    // load() dan FARQLI: cache-bust bilan — admin CRUD'dan keyingi stale
    // CDN/browser javobini chetlab o'tish uchun
    set({ loading: true, error: null })
    try {
      const [raw, topics] = await Promise.all([
        api.getQuestions(subjectId, true),
        api.getTopics(subjectId, true),
      ])
      rawQuestions = raw
      set({ questions: raw.map((q) => dbToQuestion(q, lang)), topics, loaded: true, lang, subjectId, isOfflinePractice: false, offlineAnswers: {} })
    } catch (e) {
      set({ error: e instanceof Error ? e.message : 'Failed to reload questions' })
    } finally {
      set({ loading: false })
    }
  },

  setLang(lang) {
    if (get().lang === lang) return
    if (get().isOfflinePractice) {
      // Oflayn paketda ham rawOfflineQuestions bor (yuqoridagi load() to'ldiradi,
      // isOfflinePractice FAQAT offlineRows.length>0 bo'lganda true bo'ladi —
      // shuning uchun bu yerda bo'sh bo'lish holati yo'q) — tarmoqqa qayta
      // murojaat qilish shart emas, to'g'ridan-to'g'ri qayta xaritalanadi.
      set({ questions: rawOfflineQuestions.map((q) => dbToQuestion(q, lang)), lang, loaded: true })
      return
    }
    if (rawQuestions.length === 0) { void get().load(lang); return }
    set({ questions: rawQuestions.map((q) => dbToQuestion(q, lang)), lang, loaded: true })
  },
}))
