import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ApiError } from '../../../src/shared/api'

const postResult = vi.fn()
const addSaved = vi.fn()

vi.mock('../../../src/shared/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/shared/api')>()
  return {
    ...actual,
    api: {
      postResult: (...args: unknown[]) => postResult(...args),
      addSaved: (...args: unknown[]) => addSaved(...args),
      removeSaved: vi.fn(),
      addDailyFix: vi.fn(),
      reviewCard: vi.fn(),
    },
  }
})

// Setup in-memory localStorage stub
const store = new Map<string, string>()
const localStorageMock = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => { store.set(k, String(v)) },
  removeItem: (k: string) => { store.delete(k) },
  clear: () => store.clear(),
}
vi.stubGlobal('localStorage', localStorageMock)

async function freshOutbox() {
  return import('../../../src/shared/lib/outbox')
}

describe('Outbox Queue Resilience & Fault Tolerance', () => {
  const USER_ID = 'u_test_99'

  beforeEach(() => {
    vi.resetModules()
    postResult.mockReset()
    addSaved.mockReset()
    store.clear()
    vi.stubGlobal('navigator', { onLine: true })
  })

  it('preserves strict FIFO execution order across multiple queued events', async () => {
    const { enqueueOutbox, flushOutbox, getOutboxEntries } = await freshOutbox()
    const callOrder: string[] = []

    postResult.mockImplementation(async (_u, payload) => {
      callOrder.push(`result_${payload.questionId}`)
      return { correct: true, dailyStreak: 1 }
    })
    addSaved.mockImplementation(async (_u, qId) => {
      callOrder.push(`saved_${qId}`)
      return {}
    })

    // Enqueue 3 items
    enqueueOutbox(USER_ID, 'result', { questionId: 101, subjectId: 'yhq', date: '2026-08-16' })
    enqueueOutbox(USER_ID, 'saved-add', { questionId: 102, subjectId: 'yhq' })
    enqueueOutbox(USER_ID, 'result', { questionId: 103, subjectId: 'yhq', date: '2026-08-16' })

    await flushOutbox(USER_ID)

    expect(callOrder).toEqual(['result_101', 'saved_102', 'result_103'])
    expect(getOutboxEntries(USER_ID)).toHaveLength(0)
  })

  it('discards unrecoverable 4xx client errors (poison pill defense)', async () => {
    const { enqueueOutbox, flushOutbox, getOutboxEntries } = await freshOutbox()

    // First request fails with 400 Bad Request (unrecoverable payload error)
    postResult.mockRejectedValueOnce(new ApiError(400, 'Invalid question schema'))
    // Second request succeeds
    addSaved.mockResolvedValueOnce({})

    enqueueOutbox(USER_ID, 'result', { questionId: 999, subjectId: 'yhq', date: '2026-08-16' })
    enqueueOutbox(USER_ID, 'saved-add', { questionId: 200, subjectId: 'yhq' })

    await flushOutbox(USER_ID)

    // The 400 entry should be removed without blocking the queue, and 2nd item processed
    expect(addSaved).toHaveBeenCalled()
    expect(getOutboxEntries(USER_ID)).toHaveLength(0)
  })

  it('increments attempts on retryable 5xx server errors without discarding', async () => {
    const { enqueueOutbox, flushOutbox, getOutboxEntries } = await freshOutbox()

    postResult.mockRejectedValue(new ApiError(503, 'Service Unavailable'))

    enqueueOutbox(USER_ID, 'result', { questionId: 301, subjectId: 'yhq', date: '2026-08-16' })

    await flushOutbox(USER_ID)

    const entries = getOutboxEntries(USER_ID)
    expect(entries).toHaveLength(1)
    expect(entries[0].attempts).toBe(1)
    expect(entries[0].lastError).toContain('Service Unavailable')
  })

  it('does NOT consume attempt budget on network/connectivity drops', async () => {
    const { enqueueOutbox, flushOutbox, getOutboxEntries } = await freshOutbox()

    // Network connection drop (TypeError)
    postResult.mockRejectedValue(new TypeError('Failed to fetch'))

    enqueueOutbox(USER_ID, 'result', { questionId: 401, subjectId: 'yhq', date: '2026-08-16' })

    // Simulate 5 periodic flush ticks during offline period
    for (let i = 0; i < 5; i++) {
      await flushOutbox(USER_ID)
    }

    const entries = getOutboxEntries(USER_ID)
    expect(entries).toHaveLength(1)
    // Attempts MUST remain 0 because it never reached the server
    expect(entries[0].attempts).toBe(0)
  })

  it('drops zombie entries when reaching MAX_ATTEMPTS threshold (25)', async () => {
    const { flushOutbox, getOutboxEntries } = await freshOutbox()

    postResult.mockRejectedValue(new ApiError(500, 'Internal Server Error'))

    // Pre-populate with 24 attempts
    store.set(
      `yhq-outbox:${USER_ID}`,
      JSON.stringify([
        {
          id: 'zombie-1',
          type: 'result',
          payload: { questionId: 501, subjectId: 'yhq', date: '2026-08-16' },
          attempts: 24,
          createdAt: Date.now(),
        },
      ])
    )

    await flushOutbox(USER_ID)

    // Reached 25th attempt -> dropped to protect queue
    expect(getOutboxEntries(USER_ID)).toHaveLength(0)
  })

  it('enforces concurrency lock preventing simultaneous duplicate flushes', async () => {
    const { enqueueOutbox, flushOutbox } = await freshOutbox()

    let activeExecutions = 0
    let maxConcurrency = 0

    postResult.mockImplementation(async () => {
      activeExecutions++
      maxConcurrency = Math.max(maxConcurrency, activeExecutions)
      await new Promise((r) => setTimeout(r, 20))
      activeExecutions--
      return { correct: true, dailyStreak: 1 }
    })

    enqueueOutbox(USER_ID, 'result', { questionId: 601, subjectId: 'yhq', date: '2026-08-16' })

    // Trigger two concurrent flushes
    await Promise.all([flushOutbox(USER_ID), flushOutbox(USER_ID)])

    // Concurrency must never exceed 1
    expect(maxConcurrency).toBe(1)
    expect(postResult).toHaveBeenCalledTimes(1)
  })
})
