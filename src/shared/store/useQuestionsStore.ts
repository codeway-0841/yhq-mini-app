import { create } from 'zustand'
import { api, dbToQuestion, DbQuestion, DbTopic, Question } from '../api'
import { useSubjectStore } from './useSubjectStore'

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
  load:      (lang: 'uz' | 'ru', subjectId?: string) => Promise<void>
  /** Admin CRUD'dan keyin cache'dan qat'iatan qayta yuklash (force) */
  reload:    () => Promise<void>
  /** Re-map already-fetched questions to another language — no network call. */
  setLang:   (lang: 'uz' | 'ru') => void
}

// Raw (til-mapping'siz) PUBLIC savollar — language switch'da re-fetch'siz
// qayta map qilish uchun. correctAnswer bu yerda YO'Q (server strip qiladi).
let rawQuestions: DbQuestion[] = []
let loadVersion = 0

export const useQuestionsStore = create<QuestionsState>((set, get) => ({
  questions: [],
  topics:    [],
  loaded:    false,
  loading:   false,
  error:     null,
  lang:      'uz',
  subjectId: useSubjectStore.getState().subjectId || 'yhq',

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
      set({ questions: raw.map((q) => dbToQuestion(q, lang)), topics, loaded: true, lang, subjectId: sid })
    } catch (e) {
      if (version === loadVersion) {
        set({ error: e instanceof Error ? e.message : 'Failed to load questions' })
      }
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
      set({ questions: raw.map((q) => dbToQuestion(q, lang)), topics, loaded: true, lang, subjectId })
    } catch (e) {
      set({ error: e instanceof Error ? e.message : 'Failed to reload questions' })
    } finally {
      set({ loading: false })
    }
  },

  setLang(lang) {
    if (get().lang === lang) return
    if (rawQuestions.length === 0) { void get().load(lang); return }
    set({ questions: rawQuestions.map((q) => dbToQuestion(q, lang)), lang, loaded: true })
  },
}))
