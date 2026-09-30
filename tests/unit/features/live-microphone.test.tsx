import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useMediaRoom } from '../../../src/features/live/hooks/useVoiceRoom'

const sdk = vi.hoisted(() => {
  const publications = new Map<string, { audioTrack: object; isMuted: boolean }>()
  const events = new Map<string, Set<() => void>>()
  const room = {
    state: 'connected',
    on: vi.fn((event: string, handler: () => void) => {
      const listeners = events.get(event) ?? new Set<() => void>()
      listeners.add(handler)
      events.set(event, listeners)
    }),
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    startAudio: vi.fn().mockResolvedValue(undefined),
    remoteParticipants: new Map(),
    localParticipant: {
      audioTrackPublications: publications,
      getTrackPublication: vi.fn((source: string) => publications.get(source)),
      setMicrophoneEnabled: vi.fn(),
      audioLevel: 0,
    },
  }
  return { publications, events, room }
})

vi.mock('livekit-client', () => {
  function MockRoom() { return sdk.room }
  return {
    Room: MockRoom,
    RoomEvent: new Proxy({}, { get: (_target, key) => String(key) }),
    Track: { Source: { Microphone: 'microphone' } },
  }
})

const args = { mediaUrl: 'wss://example.test', livekitToken: 'token', canPublishVideo: false, enabled: true }

beforeEach(() => {
  vi.clearAllMocks()
  sdk.publications.clear()
  sdk.events.clear()
  sdk.room.localParticipant.setMicrophoneEnabled.mockReset()
})

describe('useMediaRoom microphone publication', () => {
  it('does not show an enabled mic when LiveKit resolves without publishing a track', async () => {
    sdk.room.localParticipant.setMicrophoneEnabled.mockResolvedValue(undefined)
    const { result } = renderHook(() => useMediaRoom({ ...args, canSpeak: true }))

    await waitFor(() => expect(result.current.micBlocked).toBe(true))
    expect(result.current.micOn).toBe(false)
    expect(result.current.micError).toBe('failed')
    expect(sdk.room.localParticipant.setMicrophoneEnabled).toHaveBeenCalledTimes(1)
  })

  it('publishes once on connect and keeps micOn tied to the actual publication', async () => {
    sdk.room.localParticipant.setMicrophoneEnabled.mockImplementation(async (enabled: boolean) => {
      if (!enabled) return undefined
      const publication = { audioTrack: {}, isMuted: false }
      sdk.publications.set('microphone', publication)
      return publication
    })
    const { result } = renderHook(() => useMediaRoom({ ...args, canSpeak: true }))

    await waitFor(() => expect(result.current.micOn).toBe(true))
    expect(result.current.micBlocked).toBe(false)
    expect(sdk.room.localParticipant.setMicrophoneEnabled).toHaveBeenCalledTimes(1)
  })

  it('lets the user retry after an empty publication', async () => {
    sdk.room.localParticipant.setMicrophoneEnabled
      .mockResolvedValueOnce(undefined)
      .mockImplementation(async () => {
        const publication = { audioTrack: {}, isMuted: false }
        sdk.publications.set('microphone', publication)
        return publication
      })
    const { result } = renderHook(() => useMediaRoom({ ...args, canSpeak: true }))

    await waitFor(() => expect(result.current.micBlocked).toBe(true))
    await act(async () => { await result.current.toggleMic() })
    expect(result.current.micOn).toBe(true)
    expect(result.current.micBlocked).toBe(false)
    expect(sdk.room.localParticipant.setMicrophoneEnabled).toHaveBeenCalledTimes(2)
  })

  it('shows a denied permission instead of a falsely enabled mic', async () => {
    sdk.room.localParticipant.setMicrophoneEnabled.mockRejectedValue({ name: 'NotAllowedError' })
    const { result } = renderHook(() => useMediaRoom({ ...args, canSpeak: true }))

    await waitFor(() => expect(result.current.micBlocked).toBe(true))
    expect(result.current.micError).toBe('denied')
    expect(result.current.micOn).toBe(false)
  })

  it('mutes a pending publication when speaking permission is revoked', async () => {
    let finishPublish: ((publication: { audioTrack: object; isMuted: boolean }) => void) | undefined
    sdk.room.localParticipant.setMicrophoneEnabled.mockImplementation((enabled: boolean) => {
      if (enabled) return new Promise((resolve) => { finishPublish = resolve })
      const publication = sdk.publications.get('microphone')!
      publication.isMuted = true
      return Promise.resolve(publication)
    })
    const { result, rerender } = renderHook(
      ({ canSpeak }) => useMediaRoom({ ...args, canSpeak }),
      { initialProps: { canSpeak: true } },
    )
    await waitFor(() => expect(sdk.room.localParticipant.setMicrophoneEnabled).toHaveBeenCalledTimes(1))
    rerender({ canSpeak: false })
    const publication = { audioTrack: {}, isMuted: false }
    sdk.publications.set('microphone', publication)
    await act(async () => { finishPublish?.(publication) })

    await waitFor(() => expect(sdk.room.localParticipant.setMicrophoneEnabled).toHaveBeenCalledTimes(2))
    expect(sdk.room.localParticipant.setMicrophoneEnabled).toHaveBeenNthCalledWith(2, false)
    expect(result.current.micOn).toBe(false)
    expect(publication.isMuted).toBe(true)
  })

  it('turns the mic indicator off if a published track is removed later', async () => {
    sdk.room.localParticipant.setMicrophoneEnabled.mockImplementation(async () => {
      const publication = { audioTrack: {}, isMuted: false }
      sdk.publications.set('microphone', publication)
      return publication
    })
    const { result } = renderHook(() => useMediaRoom({ ...args, canSpeak: true }))
    await waitFor(() => expect(result.current.micOn).toBe(true))

    sdk.publications.clear()
    act(() => { for (const listener of sdk.events.get('LocalTrackUnpublished') ?? []) listener() })
    expect(result.current.micOn).toBe(false)
    expect(result.current.localPub).toBe('none')
  })
})
