import { create } from 'zustand'
import { api, dbToQuestion, DbQuestion, DbTopic, Question } from '../lib/api'

interface QuestionsState {
  questions: Question[]
  topics:    DbTopic[]
  loaded:    boolean
  loading:   boolean
  error:     string | null
  /** Language the currently mapped questions are in. */
  lang:      'uz' | 'ru'
  load:      (lang: 'uz' | 'ru') => Promise<void>
  /** Re-map already-fetched questions to another language — no network call. */
  setLang:   (lang: 'uz' | 'ru') => void
}

// Raw DB questions are kept here so language switches don't need a re-fetch.
let rawQuestions: DbQuestion[] = []

export const useQuestionsStore = create<QuestionsState>((set, get) => ({
  questions: [],
  topics:    [],
  loaded:    false,
  loading:   false,
  error:     null,
  lang:      'uz',

  async load(lang) {
    // Already loaded in this language — nothing to do
    if (get().loaded && get().lang === lang) return
    // Raw data present but language changed — just re-map, no network
    if (get().loaded && rawQuestions.length > 0) {
      set({ questions: rawQuestions.map((q) => dbToQuestion(q, lang)), lang })
      return
    }
    if (get().loading) return
    set({ loading: true, error: null })
    try {
      const [raw, topics] = await Promise.all([api.getQuestions(), api.getTopics()])
      rawQuestions = raw
      set({ questions: raw.map((q) => dbToQuestion(q, lang)), topics, loaded: true, lang })
    } catch (e) {
      set({ error: e instanceof Error ? e.message : 'Failed to load questions' })
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
