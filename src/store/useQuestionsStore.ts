import { create } from 'zustand'
import { api, dbToQuestion, DbTopic, Question } from '../lib/api'

interface QuestionsState {
  questions: Question[]
  topics:    DbTopic[]
  loaded:    boolean
  loading:   boolean
  error:     string | null
  load:      (lang: 'uz' | 'ru') => Promise<void>
}

export const useQuestionsStore = create<QuestionsState>((set, get) => ({
  questions: [],
  topics:    [],
  loaded:    false,
  loading:   false,
  error:     null,

  async load(lang) {
    if (get().loaded || get().loading) return
    set({ loading: true, error: null })
    try {
      const [raw, topics] = await Promise.all([api.getQuestions(), api.getTopics()])
      set({ questions: raw.map((q) => dbToQuestion(q, lang)), topics, loaded: true })
    } catch (e) {
      set({ error: e instanceof Error ? e.message : 'Failed to load questions' })
    } finally {
      set({ loading: false })
    }
  },
}))
