import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const apiMock = vi.hoisted(() => ({ listLiveMessages: vi.fn(), postLiveMessage: vi.fn() }))
vi.mock('../../../src/shared/api', () => ({ api: apiMock }))

import { useLiveMessages } from '../../../src/features/live/hooks/useLiveMessages'

const message = (id: number) => ({
  id, roomId: 5, userId: 'student', userName: 'Student', role: 'student' as const,
  body: `message ${id}`, createdAt: '2026-10-14T00:00:00Z',
})

beforeEach(() => vi.clearAllMocks())

describe('live chat cursor', () => {
  it('does not skip intervening messages after sending; deduplicates own message', async () => {
    apiMock.listLiveMessages
      .mockResolvedValueOnce({ messages: [message(1)] })
      .mockResolvedValueOnce({ messages: [message(2), message(3)] })
    apiMock.postLiveMessage.mockResolvedValue({ message: message(3) })
    const { result } = renderHook(() => useLiveMessages(5, true, false))
    await waitFor(() => expect(result.current.messages.map((m) => m.id)).toEqual([1]))

    await act(async () => { await result.current.send('message 3') })
    await act(async () => { await result.current.reload() })

    expect(apiMock.listLiveMessages).toHaveBeenNthCalledWith(2, 5, 1, 50)
    expect(result.current.messages.map((m) => m.id)).toEqual([1, 2, 3])
  })

  it('does not start overlapping polling requests', async () => {
    let resolve!: (value: { messages: ReturnType<typeof message>[] }) => void
    apiMock.listLiveMessages.mockReturnValue(new Promise((done) => { resolve = done }))
    const { result } = renderHook(() => useLiveMessages(5, true, false))
    expect(apiMock.listLiveMessages).toHaveBeenCalledTimes(1)
    await act(async () => { await result.current.reload() })
    expect(apiMock.listLiveMessages).toHaveBeenCalledTimes(1)
    await act(async () => { resolve({ messages: [] }) })
  })

  it('refreshes immediately on a server signal without resetting the chat cursor', async () => {
    apiMock.listLiveMessages
      .mockResolvedValueOnce({ messages: [message(1)] })
      .mockResolvedValueOnce({ messages: [message(2)] })
    const { result, rerender } = renderHook(
      ({ signal }) => useLiveMessages(5, true, false, signal, true),
      { initialProps: { signal: 0 } },
    )
    await waitFor(() => expect(result.current.messages.map((m) => m.id)).toEqual([1]))
    rerender({ signal: 1 })
    await waitFor(() => expect(result.current.messages.map((m) => m.id)).toEqual([1, 2]))
    expect(apiMock.listLiveMessages).toHaveBeenNthCalledWith(2, 5, 1, 50)
  })
})
