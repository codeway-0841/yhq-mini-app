/**
 * Boot perf regression — useQuestionsStore.load() AYNI (lang, subject) uchun
 * ikkinchi tarmoq so'rovini yubormasligi kerak.
 *
 * App.tsx boot'da load() ni IKKI marta chaqiradi: keshdagi til bilan erta
 * (api.init() bilan parallel) va profil kelgach tasdiq uchun. `loaded` flag
 * birinchi so'rov tugagunicha false bo'lgani sababli, in-flight guard bo'lmasa
 * ikkala chaqiruv ham /questions + /topics ni tortardi.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const getQuestions = vi.fn()
const getTopics    = vi.fn()

vi.mock('../../../src/shared/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/shared/api')>()
  return {
    ...actual,
    api: {
      getQuestions: (...args: unknown[]) => getQuestions(...args),
      getTopics:    (...args: unknown[]) => getTopics(...args),
    },
  }
})

const { useQuestionsStore } = await import('../../../src/shared/store/useQuestionsStore')

/** Qo'lda yechiladigan promise — so'rovni "uchib ketgan" holatda ushlab turish */
function deferred<T>() {
  let resolve!: (v: T) => void
  const promise = new Promise<T>((r) => { resolve = r })
  return { promise, resolve }
}

beforeEach(() => {
  getQuestions.mockReset()
  getTopics.mockReset()
  useQuestionsStore.setState({ questions: [], topics: [], loaded: false, loading: false, error: null })
})

describe('useQuestionsStore.load() in-flight dedupe', () => {
  it('bir vaqtda ikkita bir xil load() — FAQAT bitta fetch', async () => {
    const q = deferred<unknown[]>()
    getQuestions.mockReturnValue(q.promise)
    getTopics.mockResolvedValue([])

    const a = useQuestionsStore.getState().load('uz', 'yhq')
    const b = useQuestionsStore.getState().load('uz', 'yhq')   // hali uchmoqda

    expect(getQuestions).toHaveBeenCalledTimes(1)
    expect(getTopics).toHaveBeenCalledTimes(1)

    q.resolve([])
    await Promise.all([a, b])

    expect(useQuestionsStore.getState().loaded).toBe(true)
    expect(getQuestions).toHaveBeenCalledTimes(1)
  })

  it('yuklangandan keyin ayni (lang, subject) — fetch YO\'Q', async () => {
    getQuestions.mockResolvedValue([])
    getTopics.mockResolvedValue([])

    await useQuestionsStore.getState().load('uz', 'yhq')
    expect(getQuestions).toHaveBeenCalledTimes(1)

    await useQuestionsStore.getState().load('uz', 'yhq')
    expect(getQuestions).toHaveBeenCalledTimes(1)
  })

  it('boshqa til — in-flight guard BLOKLAMAYDI (qayta yuklanadi)', async () => {
    getQuestions.mockResolvedValue([])
    getTopics.mockResolvedValue([])

    await useQuestionsStore.getState().load('uz', 'yhq')
    await useQuestionsStore.getState().load('ru', 'yhq')

    expect(getQuestions).toHaveBeenCalledTimes(2)
  })
})
