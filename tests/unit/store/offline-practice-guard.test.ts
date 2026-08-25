/**
 * OFLAYN MASHQ CHOKE POINT — xavfsizlik regressiyasi.
 *
 * /api/offline-package javob kalitini (correctAnswer) qurilmaga yuboradi —
 * CLAUDE.md #8 qoidasidan ataylab qilingan YAGONA istisno. U faqat shu sababli
 * xavfsiz: oflayn javob serverga ham, outbox'ga ham yozilmaydi, ya'ni kalitni
 * bilish reyting/coin'ni aldashga yaramaydi.
 *
 * Qorovul ATAYLAB useAppStore.submitAnswer ichida — har ekranda alohida emas.
 * Avval u faqat TestPage'da edi, Speed Round va Kunlik mashq esa xuddi shu
 * savollar bilan ishlab, javoblarni outbox orqali serverga yetkazardi.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const postResult = vi.fn()
const enqueueOutbox = vi.fn()

vi.mock('../../../src/shared/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/shared/api')>()
  return { ...actual, api: { ...actual.api, postResult: (...args: unknown[]) => postResult(...args) } }
})
vi.mock('../../../src/shared/lib/outbox', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/shared/lib/outbox')>()
  return { ...actual, enqueueOutbox: (...args: unknown[]) => enqueueOutbox(...args) }
})

// zustand persist create() paytida localStorage'ga tegadi — importdan OLDIN stub
const store = new Map<string, string>()
vi.stubGlobal('localStorage', {
  getItem:    (k: string) => store.get(k) ?? null,
  setItem:    (k: string, v: string) => { store.set(k, String(v)) },
  removeItem: (k: string) => { store.delete(k) },
  clear:      () => store.clear(),
})

beforeEach(() => {
  vi.resetModules()
  postResult.mockReset()
  enqueueOutbox.mockReset()
  store.clear()
})

async function setup(offline: boolean) {
  const { useAppStore } = await import('../../../src/shared/store/useAppStore')
  const { useQuestionsStore } = await import('../../../src/shared/store/useQuestionsStore')
  useAppStore.setState({
    user: { id: 'u1', firstName: 'T', lastName: undefined, username: undefined, photoUrl: undefined, phone: undefined, tariff: 'free' },
    xp: 100, coins: 50, totalCorrect: 5, totalAnswered: 10,
  })
  useQuestionsStore.setState({
    isOfflinePractice: offline,
    offlineAnswers: offline ? { 42: 'b' } : {},
  })
  return { useAppStore, useQuestionsStore }
}

describe('oflayn mashq: javob serverga ham, outbox\'ga ham yozilmaydi', () => {
  it('to\'g\'ri javob lokal baholanadi, HECH QAYERGA yuborilmaydi', async () => {
    const { useAppStore } = await setup(true)

    const res = await useAppStore.getState().submitAnswer(42, 'b')

    expect(res).toEqual({ correct: true, correctAnswer: 'b', duplicate: false, coinsEarned: 0 })
    expect(postResult).not.toHaveBeenCalled()
    expect(enqueueOutbox).not.toHaveBeenCalled()
  })

  it('xato javob ham lokal baholanadi, HECH QAYERGA yuborilmaydi', async () => {
    const { useAppStore } = await setup(true)

    const res = await useAppStore.getState().submitAnswer(42, 'a')

    expect(res).toEqual({ correct: false, correctAnswer: 'b', duplicate: false, coinsEarned: 0 })
    expect(postResult).not.toHaveBeenCalled()
    expect(enqueueOutbox).not.toHaveBeenCalled()
  })

  it('hisob ko\'rsatkichlari (XP/coin/javoblar) TEGILMAYDI', async () => {
    const { useAppStore } = await setup(true)

    await useAppStore.getState().submitAnswer(42, 'b')

    const s = useAppStore.getState()
    expect(s.xp).toBe(100)
    expect(s.coins).toBe(50)
    expect(s.totalCorrect).toBe(5)
    expect(s.totalAnswered).toBe(10)
  })

  it('KONTROL: onlayn holatda javob HAQIQATAN serverga yuboriladi', async () => {
    // Bu test qorovul "hamma narsani bloklab" qo'ymaganini isbotlaydi —
    // usiz yuqoridagi uchtasi bo'sh-bo'shiga o'tib ketaverardi.
    postResult.mockResolvedValue({
      correct: true, correctAnswer: 'b', duplicate: false,
      dailyStreak: 1, xp: 110, coinsEarned: 1, coinBalance: 51,
    })
    const { useAppStore } = await setup(false)

    const res = await useAppStore.getState().submitAnswer(42, 'b')

    expect(postResult).toHaveBeenCalledTimes(1)
    expect(res).toMatchObject({ correct: true, correctAnswer: 'b' })
  })

  it('kalit yo\'q bo\'lsa null qaytaradi (javob "pending" qoladi), yuborilmaydi', async () => {
    const { useAppStore } = await setup(true)

    const res = await useAppStore.getState().submitAnswer(999, 'a')   // offlineAnswers'da yo'q

    expect(res).toBeNull()
    expect(postResult).not.toHaveBeenCalled()
    expect(enqueueOutbox).not.toHaveBeenCalled()
  })
})
