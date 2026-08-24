import { describe, it, expect, vi, beforeEach } from 'vitest'

const getQuestions = vi.fn()
const getTopics = vi.fn()
vi.mock('../../../src/shared/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/shared/api')>()
  return { ...actual, api: { ...actual.api, getQuestions, getTopics } }
})

const readOfflinePackage = vi.fn()
vi.mock('../../../src/shared/lib/offlinePackage', () => ({ readOfflinePackage }))

async function fresh() {
  vi.resetModules()
  return import('../../../src/shared/store/useQuestionsStore')
}

const OFFLINE_ROWS = [
  { id: 1, questionUz: 'S1', questionRu: 'В1', optionsUz: { a: '1' }, optionsRu: { a: '1' }, correctAnswer: 'a', image: null, topicId: 1 },
]

beforeEach(() => {
  getQuestions.mockReset()
  getTopics.mockReset()
  readOfflinePackage.mockReset()
})

describe('useQuestionsStore.load — offline fallback', () => {
  it('online muvaffaqiyatli bo\'lsa isOfflinePractice=false, offlineAnswers bo\'sh', async () => {
    getQuestions.mockResolvedValue([{ id: 1, questionUz: 'S1', questionRu: 'В1', optionsUz: { a: '1' }, optionsRu: { a: '1' }, image: null, topicId: 1 }])
    getTopics.mockResolvedValue([])
    const { useQuestionsStore } = await fresh()

    await useQuestionsStore.getState().load('uz', 'yhq')

    expect(useQuestionsStore.getState().isOfflinePractice).toBe(false)
    expect(useQuestionsStore.getState().offlineAnswers).toEqual({})
    expect(readOfflinePackage).not.toHaveBeenCalled()
  })

  it('online muvaffaqiyatsiz + oflayn paket bor bo\'lsa — undan yuklaydi, isOfflinePractice=true', async () => {
    getQuestions.mockRejectedValue(new TypeError('network error'))
    readOfflinePackage.mockResolvedValue(OFFLINE_ROWS)
    const { useQuestionsStore } = await fresh()

    await useQuestionsStore.getState().load('uz', 'yhq')

    const state = useQuestionsStore.getState()
    expect(state.isOfflinePractice).toBe(true)
    expect(state.loaded).toBe(true)
    expect(state.offlineAnswers).toEqual({ 1: 'a' })
    expect(state.questions).toHaveLength(1)
    expect(state.questions[0]!.id).toBe(1)
  })

  it('online muvaffaqiyatsiz + oflayn paket ham yo\'q bo\'lsa — error state', async () => {
    getQuestions.mockRejectedValue(new TypeError('network error'))
    readOfflinePackage.mockResolvedValue(null)
    const { useQuestionsStore } = await fresh()

    await useQuestionsStore.getState().load('uz', 'yhq')

    const state = useQuestionsStore.getState()
    expect(state.isOfflinePractice).toBe(false)
    expect(state.error).toBeTruthy()
  })
})
