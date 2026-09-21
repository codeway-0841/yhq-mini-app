/**
 * Persist-kesh (IndexedDB) integratsiyasi — EGRESS "A" bosqich (2026-09-21).
 *
 * useQuestionsStore.load() endi bankni har launch'da QAYTA TORTMAYDI:
 * server versiyasi (GET /questions/version) keshdagi bilan bir xil bo'lsa
 * IndexedDB'dan o'qiydi. Bu testlar 4 holatni qoplaydi:
 *   HIT (versiya bir xil) / MISS (boshqa) / offline+kesh / offline+keshsiz.
 * IndexedDB moduli mock'langan — jsdom'da indexedDB yo'q.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const getQuestions = vi.fn()
const getTopics = vi.fn()
const getQuestionsVersion = vi.fn()
const readBankCache = vi.fn()
const writeBankCache = vi.fn()

vi.mock('../../../src/shared/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/shared/api')>()
  return {
    ...actual,
    api: {
      getQuestions: (...args: unknown[]) => getQuestions(...args),
      getTopics: (...args: unknown[]) => getTopics(...args),
      getQuestionsVersion: (...args: unknown[]) => getQuestionsVersion(...args),
    },
  }
})

vi.mock('../../../src/shared/lib/question-bank-cache', () => ({
  readBankCache: (...args: unknown[]) => readBankCache(...args),
  writeBankCache: (...args: unknown[]) => writeBankCache(...args),
  BANK_CACHE_FORMAT: 1,
}))

const lsStore = new Map<string, string>()
vi.stubGlobal('localStorage', {
  get length() { return lsStore.size },
  key: (i: number) => [...lsStore.keys()][i] ?? null,
  getItem: (k: string) => lsStore.get(k) ?? null,
  setItem: (k: string, v: string) => { lsStore.set(k, String(v)) },
  removeItem: (k: string) => { lsStore.delete(k) },
  clear: () => lsStore.clear(),
})

const { useQuestionsStore } = await import('../../../src/shared/store/useQuestionsStore')

const q = (id: number) => ({
  id,
  questionUz: `savol ${id}`, questionRu: `вопрос ${id}`,
  optionsUz: { a: 'A', b: 'B' }, optionsRu: { a: 'А', b: 'Б' },
  topicId: 1, image: null,
})
const topic = { id: 1, nameUz: 'Mavzu', nameRu: 'Тема', slug: 'mavzu', questionCount: 2 }

function resetStore() {
  useQuestionsStore.setState({ questions: [], topics: [], loaded: false, loading: false, error: null, failedKey: null, subjectId: 'yhq', lang: 'uz' })
}

beforeEach(() => {
  lsStore.clear()
  getQuestions.mockReset()
  getTopics.mockReset()
  getQuestionsVersion.mockReset()
  readBankCache.mockReset()
  writeBankCache.mockReset()
  writeBankCache.mockResolvedValue(undefined)
  resetStore()
})

describe('persist-kesh: HIT — versiya bir xil', () => {
  it('bank QAYTA TORTILMAYDI — keshdan yuklanadi', async () => {
    readBankCache.mockResolvedValue({ subjectId: 'yhq', v: 'v1', raw: [q(1), q(2)], topics: [topic], savedAt: 1, format: 1 })
    getQuestionsVersion.mockResolvedValue({ v: 'v1' })

    await useQuestionsStore.getState().load('uz', 'yhq')

    expect(getQuestions).not.toHaveBeenCalled()
    expect(getTopics).not.toHaveBeenCalled()
    expect(writeBankCache).not.toHaveBeenCalled()
    const st = useQuestionsStore.getState()
    expect(st.loaded).toBe(true)
    expect(st.questions).toHaveLength(2)
    expect(st.topics).toEqual([topic])
    expect(st.error).toBeNull()
  })

  it('keshdan yuklangan bank til almashtirishda ham network talab qilmaydi', async () => {
    readBankCache.mockResolvedValue({ subjectId: 'yhq', v: 'v1', raw: [q(1)], topics: [], savedAt: 1, format: 1 })
    getQuestionsVersion.mockResolvedValue({ v: 'v1' })

    await useQuestionsStore.getState().load('uz', 'yhq')
    await useQuestionsStore.getState().load('ru', 'yhq')   // lokal remap

    expect(getQuestions).not.toHaveBeenCalled()
    expect(useQuestionsStore.getState().lang).toBe('ru')
  })
})

describe('persist-kesh: MISS — versiya o\'zgargan', () => {
  it('yangi versiya bilan bank qayta tortiladi va kesh yangilanadi', async () => {
    readBankCache.mockResolvedValue({ subjectId: 'yhq', v: 'v1', raw: [q(1)], topics: [], savedAt: 1, format: 1 })
    getQuestionsVersion.mockResolvedValue({ v: 'v2' })
    getQuestions.mockResolvedValue([q(1), q(2), q(3)])
    getTopics.mockResolvedValue([topic])

    await useQuestionsStore.getState().load('uz', 'yhq')

    expect(getQuestions).toHaveBeenCalledTimes(1)
    expect(writeBankCache).toHaveBeenCalledWith({
      subjectId: 'yhq', v: 'v2', raw: [q(1), q(2), q(3)], topics: [topic],
    })
    expect(useQuestionsStore.getState().questions).toHaveLength(3)
  })
})

describe('persist-kesh: offline holatlar', () => {
  it('versiya so\'rovi yiqilsa + kesh bor — eskirgan kesh bilan yashaydi', async () => {
    readBankCache.mockResolvedValue({ subjectId: 'yhq', v: 'v1', raw: [q(1), q(2)], topics: [topic], savedAt: 1, format: 1 })
    getQuestionsVersion.mockRejectedValue(new Error('network down'))

    await useQuestionsStore.getState().load('uz', 'yhq')

    expect(getQuestions).not.toHaveBeenCalled()
    const st = useQuestionsStore.getState()
    expect(st.loaded).toBe(true)
    expect(st.questions).toHaveLength(2)
    expect(st.error).toBeNull()
  })

  it('versiya yiqilsa + kesh YO\'Q — avvalgi yo\'lga tushadi (to\'liq fetch), keshga yozmaydi', async () => {
    readBankCache.mockResolvedValue(null)
    getQuestionsVersion.mockRejectedValue(new Error('network down'))
    getQuestions.mockResolvedValue([q(1)])
    getTopics.mockResolvedValue([])

    await useQuestionsStore.getState().load('uz', 'yhq')

    expect(getQuestions).toHaveBeenCalledTimes(1)
    // Versiya noma'lum — noma'lum versiyali kesh keyingi launch'da
    // "o'zgargan" deb ortiqcha refetch keltirardi
    expect(writeBankCache).not.toHaveBeenCalled()
    expect(useQuestionsStore.getState().loaded).toBe(true)
  })
})

describe('persist-kesh: birinchi launch (kesh bo\'sh)', () => {
  it('fetch + keshga yozish', async () => {
    readBankCache.mockResolvedValue(null)
    getQuestionsVersion.mockResolvedValue({ v: 'v9' })
    getQuestions.mockResolvedValue([q(1)])
    getTopics.mockResolvedValue([topic])

    await useQuestionsStore.getState().load('uz', 'yhq')

    expect(getQuestions).toHaveBeenCalledTimes(1)
    expect(writeBankCache).toHaveBeenCalledWith({
      subjectId: 'yhq', v: 'v9', raw: [q(1)], topics: [topic],
    })
  })

  it('kesh o\'qishda xato (IDB buzilgan) — ilova yiqilmaydi, fetch ishlaydi', async () => {
    readBankCache.mockRejectedValue(new Error('idb broken'))
    getQuestionsVersion.mockResolvedValue({ v: 'v9' })
    getQuestions.mockResolvedValue([q(1)])
    getTopics.mockResolvedValue([])

    await useQuestionsStore.getState().load('uz', 'yhq')

    expect(getQuestions).toHaveBeenCalledTimes(1)
    expect(useQuestionsStore.getState().loaded).toBe(true)
    expect(useQuestionsStore.getState().error).toBeNull()
  })
})
