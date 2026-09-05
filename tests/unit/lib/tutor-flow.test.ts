import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fetchStaticExplanation, explainQuestion } from '../../../src/shared/lib/tutor'
import * as sessionModule from '../../../src/shared/lib/session'
import * as telegramModule from '../../../src/platform/telegram'

describe('tutor.ts frontend unit tests (IDs 07, 08, 10)', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(sessionModule, 'getSessionToken').mockReturnValue(null)
    vi.spyOn(telegramModule, 'getInitData').mockReturnValue('')
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  describe('fetchStaticExplanation (ID 07)', () => {
    it('Bearer token va initData mavjud bo‘lganda auth headerlar bilan so‘rov yuboradi', async () => {
      vi.spyOn(sessionModule, 'getSessionToken').mockReturnValue('session_test_token')
      vi.spyOn(telegramModule, 'getInitData').mockReturnValue('user_init_data')

      const mockFetch = vi.fn(async (_url: string, _init?: RequestInit) => {
        return {
          status: 200,
          ok: true,
          json: async () => ({ text: 'Izoh matni' }),
        } as unknown as Response
      })
      globalThis.fetch = mockFetch as unknown as typeof fetch

      const result = await fetchStaticExplanation(42, 'uz')
      expect(result).toBe('Izoh matni')
      expect(mockFetch).toHaveBeenCalledTimes(1)

      const [calledUrl, calledInit] = mockFetch.mock.calls[0]
      expect(calledUrl).toContain('/questions/42/explanation?lang=uz')
      expect(calledInit?.headers).toEqual({
        Authorization: 'Bearer session_test_token',
        'x-telegram-init-data': 'user_init_data',
      })
    })

    it('404 bo‘lganda null qaytaradi', async () => {
      globalThis.fetch = vi.fn(async () => ({
        status: 404,
        ok: false,
      } as unknown as Response)) as unknown as typeof fetch

      const result = await fetchStaticExplanation(999, 'ru')
      expect(result).toBeNull()
    })
  })

  describe('explainQuestion (ID 08, ID 10)', () => {
    it('Bearer token mavjud bo‘lsa Authorization headerga qo‘shiladi (ID 08)', async () => {
      vi.spyOn(sessionModule, 'getSessionToken').mockReturnValue('active_bearer_token')
      vi.spyOn(telegramModule, 'getInitData').mockReturnValue('tg_init_data')

      const mockReader = {
        read: vi.fn()
          .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode('data: {"text":"Salom"}\n\n') })
          .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode('data: [DONE]\n\n') })
          .mockResolvedValueOnce({ done: true, value: undefined }),
        cancel: vi.fn().mockResolvedValue(undefined),
        releaseLock: vi.fn(),
      }

      globalThis.fetch = vi.fn(async (_url: string, init?: RequestInit) => {
        expect(init?.headers).toMatchObject({
          Authorization: 'Bearer active_bearer_token',
          'x-telegram-init-data': 'tg_init_data',
        })
        return {
          status: 200,
          ok: true,
          body: {
            getReader: () => mockReader,
          },
        } as unknown as Response
      }) as unknown as typeof fetch

      const chunks: string[] = []
      for await (const chunk of explainQuestion(10, 'uz', false)) {
        chunks.push(chunk)
      }

      expect(chunks).toEqual(['Salom'])
      expect(mockReader.releaseLock).toHaveBeenCalled()
    })

    it('AbortSignal aborted bo‘lganda generator to‘xtaydi va stream bekor qilinadi (ID 10)', async () => {
      const abortController = new AbortController()
      const mockReader = {
        read: vi.fn().mockImplementation(async () => {
          abortController.abort()
          return { done: false, value: new TextEncoder().encode('data: {"text":"Birinchi"}\n\n') }
        }),
        cancel: vi.fn().mockResolvedValue(undefined),
        releaseLock: vi.fn(),
      }

      globalThis.fetch = vi.fn(async () => ({
        status: 200,
        ok: true,
        body: {
          getReader: () => mockReader,
        },
      } as unknown as Response)) as unknown as typeof fetch

      const chunks: string[] = []
      for await (const chunk of explainQuestion(10, 'uz', false, abortController.signal)) {
        chunks.push(chunk)
      }

      expect(mockReader.cancel).toHaveBeenCalled()
      expect(mockReader.releaseLock).toHaveBeenCalled()
    })
  })
})
