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
  it("ketma-ket load: keshsiz fanga o'tilsa ESKI fan ma'lumotlari qolmaydi", async () => {
    // 1-bosqich: 'yhq' oflayn paketdan yuklanadi
    getQuestions.mockRejectedValue(new TypeError('network error'))
    readOfflinePackage.mockResolvedValue(OFFLINE_ROWS)
    const { useQuestionsStore } = await fresh()
    await useQuestionsStore.getState().load('uz', 'yhq')
    expect(useQuestionsStore.getState().isOfflinePractice).toBe(true)

    // 2-bosqich: 'rustili' — na tarmoq, na oflayn paket
    readOfflinePackage.mockResolvedValue(null)
    await useQuestionsStore.getState().load('uz', 'rustili')

    const state = useQuestionsStore.getState()
    expect(state.error).toBeTruthy()
    expect(state.questions).toEqual([])          // 'yhq' savollari qolib ketmasin
    expect(state.offlineAnswers).toEqual({})     // 'yhq' javob kaliti qolib ketmasin
    expect(state.isOfflinePractice).toBe(false)
    expect(state.subjectId).toBe('rustili')      // qorovul keyinchalik noto'g'ri ishlamasin
    expect(state.loaded).toBe(false)
  })
})

describe('useQuestionsStore — oflayn rejimdan chiqish', () => {
  it("reload() muvaffaqiyatli bo'lsa oflayn rejim tozalanadi", async () => {
    getQuestions.mockRejectedValue(new TypeError('network error'))
    readOfflinePackage.mockResolvedValue(OFFLINE_ROWS)
    const { useQuestionsStore } = await fresh()
    await useQuestionsStore.getState().load('uz', 'yhq')
    expect(useQuestionsStore.getState().isOfflinePractice).toBe(true)

    // Internet qaytdi — App.tsx'dagi 'online' hodisasi shu yo'lni chaqiradi
    getQuestions.mockResolvedValue([{ id: 2, questionUz: 'S2', questionRu: 'В2', optionsUz: { a: '1' }, optionsRu: { a: '1' }, image: null, topicId: 1 }])
    getTopics.mockResolvedValue([])
    await useQuestionsStore.getState().reload()

    const state = useQuestionsStore.getState()
    expect(state.isOfflinePractice).toBe(false)
    expect(state.offlineAnswers).toEqual({})
    expect(state.questions[0]!.id).toBe(2)
  })

  it("reload() muvaffaqiyatsiz bo'lsa oflayn rejim SAQLANADI (xavfsiz yo'nalish)", async () => {
    getQuestions.mockRejectedValue(new TypeError('network error'))
    readOfflinePackage.mockResolvedValue(OFFLINE_ROWS)
    const { useQuestionsStore } = await fresh()
    await useQuestionsStore.getState().load('uz', 'yhq')

    await useQuestionsStore.getState().reload()   // tarmoq hali ham yo'q

    const state = useQuestionsStore.getState()
    expect(state.isOfflinePractice).toBe(true)
    expect(state.offlineAnswers).toEqual({ 1: 'a' })
  })
})

describe('useQuestionsStore.setLang — oflayn filial', () => {
  it('oflayn rejimda til almashsa TARMOQQA murojaat qilmaydi', async () => {
    getQuestions.mockRejectedValue(new TypeError('network error'))
    readOfflinePackage.mockResolvedValue(OFFLINE_ROWS)
    const { useQuestionsStore } = await fresh()
    await useQuestionsStore.getState().load('uz', 'yhq')
    expect(useQuestionsStore.getState().questions[0]!.text).toBe('S1')

    getQuestions.mockClear()
    useQuestionsStore.getState().setLang('ru')

    const state = useQuestionsStore.getState()
    expect(state.questions[0]!.text).toBe('В1')   // RU matnga qayta xaritalandi
    expect(state.isOfflinePractice).toBe(true)
    expect(getQuestions).not.toHaveBeenCalled()
  })
})
