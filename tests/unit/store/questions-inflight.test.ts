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

// Savol soni localStorage'ga yoziladi — importdan OLDIN stub kerak
const lsStore = new Map<string, string>()
vi.stubGlobal('localStorage', {
  get length() { return lsStore.size },
  key:        (i: number) => [...lsStore.keys()][i] ?? null,
  getItem:    (k: string) => lsStore.get(k) ?? null,
  setItem:    (k: string, v: string) => { lsStore.set(k, String(v)) },
  removeItem: (k: string) => { lsStore.delete(k) },
  clear:      () => lsStore.clear(),
})

const { useQuestionsStore, cachedQuestionCount } =
  await import('../../../src/shared/store/useQuestionsStore')

/** dbToQuestion() optionsUz/optionsRu ni Object.entries bilan o'qiydi —
 *  stub'lar shu shaklga mos bo'lishi kerak, aks holda map paytida yiqiladi. */
const q = (id: number) => ({
  id,
  questionUz: `savol ${id}`, questionRu: `вопрос ${id}`,
  optionsUz: { a: 'A', b: 'B' }, optionsRu: { a: 'А', b: 'Б' },
  topicId: 1, image: null,
})

/** Qo'lda yechiladigan promise — so'rovni "uchib ketgan" holatda ushlab turish */
function deferred<T>() {
  let resolve!: (v: T) => void
  const promise = new Promise<T>((r) => { resolve = r })
  return { promise, resolve }
}

beforeEach(() => {
  lsStore.clear()
  getQuestions.mockReset()
  getTopics.mockReset()
  useQuestionsStore.setState({ questions: [], topics: [], loaded: false, loading: false, error: null, failedKey: null })
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

describe('cachedQuestionCount', () => {
  it("yuklangandan keyin son diskda qoladi — birinchi kadrda 0% ko'rsatmaydi", async () => {
    getQuestions.mockResolvedValue([q(1), q(2), q(3)])
    getTopics.mockResolvedValue([])

    expect(cachedQuestionCount('yhq')).toBe(0)
    await useQuestionsStore.getState().load('uz', 'yhq')
    expect(cachedQuestionCount('yhq')).toBe(3)
  })

  it('fanlar bir-birining sonini bosmaydi', async () => {
    getTopics.mockResolvedValue([])
    getQuestions.mockResolvedValue([q(1), q(2)])
    await useQuestionsStore.getState().load('uz', 'yhq')
    getQuestions.mockResolvedValue([q(1)])
    await useQuestionsStore.getState().load('uz', 'fizika')

    expect(cachedQuestionCount('yhq')).toBe(2)
    expect(cachedQuestionCount('fizika')).toBe(1)
  })

  it("bo'sh javob eski sonni O'CHIRMAYDI", async () => {
    getTopics.mockResolvedValue([])
    getQuestions.mockResolvedValue([q(1), q(2)])
    await useQuestionsStore.getState().load('uz', 'yhq')

    useQuestionsStore.setState({ loaded: false })
    getQuestions.mockResolvedValue([])
    await useQuestionsStore.getState().load('ru', 'yhq')

    expect(cachedQuestionCount('yhq')).toBe(2)
  })
})

describe("xato holati — cheksiz qayta urinish YO'Q", () => {
  it('yiqilgandan keyin load() AVTOMATIK takrorlamaydi', async () => {
    getTopics.mockResolvedValue([])
    getQuestions.mockRejectedValue(new Error('429: too_many_requests'))

    await useQuestionsStore.getState().load('uz', 'yhq')
    expect(getQuestions).toHaveBeenCalledTimes(1)
    expect(useQuestionsStore.getState().error).toBeTruthy()
    expect(useQuestionsStore.getState().loaded).toBe(false)
    expect(useQuestionsStore.getState().loading).toBe(false)

    // Sahifa effekti aynan shu shartda qayta chaqiradi — endi to'xtashi kerak
    await useQuestionsStore.getState().load('uz', 'yhq')
    await useQuestionsStore.getState().load('uz', 'yhq')
    expect(getQuestions).toHaveBeenCalledTimes(1)
  })

  it("retry() guardni ATAYLAB chetlab otadi", async () => {
    getTopics.mockResolvedValue([])
    getQuestions.mockRejectedValue(new Error('boom'))
    await useQuestionsStore.getState().load('uz', 'yhq')
    expect(getQuestions).toHaveBeenCalledTimes(1)

    getQuestions.mockResolvedValue([q(1)])
    await useQuestionsStore.getState().retry()

    expect(getQuestions).toHaveBeenCalledTimes(2)
    expect(useQuestionsStore.getState().loaded).toBe(true)
    expect(useQuestionsStore.getState().failedKey).toBeNull()
  })

  it('til almashsa butun bank QAYTA TORTILMAYDI — lokal remap', async () => {
    getTopics.mockResolvedValue([])
    getQuestions.mockResolvedValue([q(1), q(2)])

    await useQuestionsStore.getState().load('uz', 'yhq')
    expect(getQuestions).toHaveBeenCalledTimes(1)

    await useQuestionsStore.getState().load('ru', 'yhq')
    expect(getQuestions).toHaveBeenCalledTimes(1)
    expect(useQuestionsStore.getState().lang).toBe('ru')
    expect(useQuestionsStore.getState().questions).toHaveLength(2)
  })
})
