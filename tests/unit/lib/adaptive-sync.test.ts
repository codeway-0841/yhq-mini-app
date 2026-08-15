import { describe, it, expect, vi, beforeEach } from 'vitest'

const getCardsMock = vi.fn()
const reviewCardMock = vi.fn()

vi.mock('../../../src/shared/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/shared/api')>()
  return {
    ...actual,
    api: {
      ...actual.api,
      getCards: (...args: unknown[]) => getCardsMock(...args),
      reviewCard: (...args: unknown[]) => reviewCardMock(...args),
    },
  }
})

const store = new Map<string, string>()
const localStorageMock = {
  getItem:    (k: string) => store.get(k) ?? null,
  setItem:    (k: string, v: string) => { store.set(k, String(v)) },
  removeItem: (k: string) => { store.delete(k) },
  clear:      () => store.clear(),
}
vi.stubGlobal('localStorage', localStorageMock)

describe('Spaced Repetition / Adaptive Store Cloud Sync', () => {
  beforeEach(() => {
    vi.resetModules()
    getCardsMock.mockReset()
    reviewCardMock.mockReset()
    store.clear()
    vi.stubGlobal('navigator', { onLine: true })
  })

  it('syncCardsFromServer merges cloud cards into local state', async () => {
    getCardsMock.mockResolvedValue({
      ok: true,
      cards: {
        10: { questionId: 10, ef: 2.3, interval: 6, reps: 2, dueAt: 1700000000000 },
        15: { questionId: 15, ef: 1.8, interval: 1, reps: 0, dueAt: 1700000060000 },
      },
    })

    const { useAdaptiveStore } = await import('../../../src/shared/store/useAdaptiveStore')
    await useAdaptiveStore.getState().syncCardsFromServer('user-1', 'yhq')

    const cards = useAdaptiveStore.getState().cardsBySubject['yhq']
    expect(cards).toBeDefined()
    expect(cards[10].reps).toBe(2)
    expect(cards[10].ef).toBe(2.3)
    expect(cards[15].reps).toBe(0)
  })

  it('recordAnswer queues card-review mutation into Outbox', async () => {
    vi.stubGlobal('navigator', { onLine: false })
    reviewCardMock.mockResolvedValue({ ok: true })
    const { useAdaptiveStore } = await import('../../../src/shared/store/useAdaptiveStore')
    const { getOutboxEntries, flushOutbox } = await import('../../../src/shared/lib/outbox')

    useAdaptiveStore.getState().recordAnswer(42, 1, 'user-1')

    await flushOutbox('user-1') // offline — lockni kutadi, lekin yubormaydi

    const outbox = getOutboxEntries('user-1')
    expect(outbox.length).toBeGreaterThanOrEqual(1)
    const cardEntry = outbox.find((e) => e.type === 'card-review')
    expect(cardEntry).toBeDefined()
    expect(cardEntry?.payload.questionId).toBe(42)
    expect(cardEntry?.payload.reps).toBe(1)

    // Online qaytganda yuboriladi va navbatdan o'chiriladi
    vi.stubGlobal('navigator', { onLine: true })
    await flushOutbox('user-1')
    expect(reviewCardMock).toHaveBeenCalledWith('user-1', expect.objectContaining({
      questionId: 42,
      reps: 1,
    }))
    expect(getOutboxEntries('user-1')).toHaveLength(0)
  })
})
