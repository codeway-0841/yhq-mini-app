import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { useFaceDetection } from '../../../src/features/camai/useFaceDetection'

const vision = vi.hoisted(() => ({ resolve: vi.fn(), createDetector: vi.fn() }))
vi.mock('@mediapipe/tasks-vision', () => ({
  FilesetResolver: { forVisionTasks: vision.resolve },
  FaceDetector: { createFromOptions: vision.createDetector },
}))

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

function makeDetector() {
  return { close: vi.fn(), detectForVideo: vi.fn(() => ({ detections: [] })) }
}

function makeStream() {
  const tracks = [{ stop: vi.fn() }, { stop: vi.fn() }]
  const stream = { getTracks: () => tracks } as unknown as MediaStream
  return { stream, tracks }
}

describe('CamAi async resource lifecycle (audit F4)', () => {
  const mediaDescriptor = Object.getOwnPropertyDescriptor(navigator, 'mediaDevices')
  let getUserMedia: ReturnType<typeof vi.fn>
  let detector: ReturnType<typeof makeDetector>
  let video: HTMLVideoElement
  let videoRef: { current: HTMLVideoElement }

  beforeEach(() => {
    detector = makeDetector()
    vision.resolve.mockReset().mockResolvedValue({})
    vision.createDetector.mockReset().mockResolvedValue(detector)
    getUserMedia = vi.fn()
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia },
    })
    video = document.createElement('video')
    vi.spyOn(video, 'play').mockResolvedValue(undefined)
    videoRef = { current: video }
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1))
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    if (mediaDescriptor) Object.defineProperty(navigator, 'mediaDevices', mediaDescriptor)
    else Reflect.deleteProperty(navigator, 'mediaDevices')
  })

  it('does not start resources when inactive', () => {
    renderHook(() => useFaceDetection(videoRef, false))
    expect(vision.resolve).not.toHaveBeenCalled()
    expect(getUserMedia).not.toHaveBeenCalled()
  })

  it('does not create a detector after unmount while WASM resolves', async () => {
    const pending = deferred<object>()
    vision.resolve.mockReturnValueOnce(pending.promise)
    const { unmount } = renderHook(() => useFaceDetection(videoRef, true))
    await waitFor(() => expect(vision.resolve).toHaveBeenCalledOnce())
    unmount()
    await act(async () => { pending.resolve({}) })
    expect(vision.createDetector).not.toHaveBeenCalled()
    expect(getUserMedia).not.toHaveBeenCalled()
  })

  it('closes a detector that finishes creation after unmount', async () => {
    const pending = deferred<ReturnType<typeof makeDetector>>()
    vision.createDetector.mockReturnValueOnce(pending.promise)
    const { unmount } = renderHook(() => useFaceDetection(videoRef, true))
    await waitFor(() => expect(vision.createDetector).toHaveBeenCalledOnce())
    unmount()
    expect(detector.close).not.toHaveBeenCalled()
    await act(async () => { pending.resolve(detector) })
    expect(detector.close).toHaveBeenCalledOnce()
    expect(getUserMedia).not.toHaveBeenCalled()
  })

  it.each([
    { fallback: false, cancel: 'unmount' },
    { fallback: true, cancel: 'unmount' },
    { fallback: false, cancel: 'deactivate' },
    { fallback: true, cancel: 'deactivate' },
  ])('stops late camera tracks: fallback=$fallback, cancel=$cancel', async ({ fallback, cancel }) => {
    const pending = deferred<MediaStream>()
    const { stream, tracks } = makeStream()
    if (fallback) getUserMedia.mockRejectedValueOnce(new Error('No rear camera'))
    getUserMedia.mockReturnValueOnce(pending.promise)
    const { unmount, rerender } = renderHook(({ active }) => useFaceDetection(videoRef, active), {
      initialProps: { active: true },
    })
    await waitFor(() => expect(getUserMedia).toHaveBeenCalledTimes(fallback ? 2 : 1))
    if (cancel === 'unmount') unmount()
    else rerender({ active: false })
    expect(detector.close).toHaveBeenCalledOnce()
    await act(async () => { pending.resolve(stream) })
    for (const track of tracks) expect(track.stop).toHaveBeenCalledOnce()
    expect(detector.close).toHaveBeenCalledOnce()
    expect(video.play).not.toHaveBeenCalled()
    expect(video.srcObject).not.toBe(stream)
    expect(requestAnimationFrame).not.toHaveBeenCalled()
  })

  it('does not request the fallback camera after cancellation', async () => {
    const pending = deferred<MediaStream>()
    getUserMedia.mockReturnValueOnce(pending.promise)
    const { unmount } = renderHook(() => useFaceDetection(videoRef, true))
    await waitFor(() => expect(getUserMedia).toHaveBeenCalledOnce())
    unmount()
    await act(async () => { pending.reject(new Error('Rear camera failed late')) })
    expect(getUserMedia).toHaveBeenCalledOnce()
  })

  it('preserves normal fallback playback and cleanup', async () => {
    const { stream, tracks } = makeStream()
    getUserMedia.mockRejectedValueOnce(new Error('No rear camera')).mockResolvedValueOnce(stream)
    const { result, unmount } = renderHook(() => useFaceDetection(videoRef, true))
    await waitFor(() => expect(result.current.status).toBe('running'))
    expect(getUserMedia).toHaveBeenLastCalledWith({ video: true, audio: false })
    expect(video.srcObject).toBe(stream)
    expect(video.play).toHaveBeenCalledOnce()
    unmount()
    for (const track of tracks) expect(track.stop).toHaveBeenCalledOnce()
    expect(detector.close).toHaveBeenCalledOnce()
    expect(video.srcObject).toBeNull()
    expect(cancelAnimationFrame).toHaveBeenCalledWith(1)
  })

  it('disposes an old late stream without stopping a new active session', async () => {
    const pending = deferred<MediaStream>()
    const oldCamera = makeStream()
    const newCamera = makeStream()
    const newDetector = makeDetector()
    vision.createDetector.mockResolvedValueOnce(detector).mockResolvedValueOnce(newDetector)
    getUserMedia.mockReturnValueOnce(pending.promise).mockResolvedValueOnce(newCamera.stream)
    const { result, rerender, unmount } = renderHook(({ active }) => useFaceDetection(videoRef, active), {
      initialProps: { active: true },
    })
    await waitFor(() => expect(getUserMedia).toHaveBeenCalledOnce())
    rerender({ active: false })
    rerender({ active: true })
    await waitFor(() => expect(result.current.status).toBe('running'))
    await act(async () => { pending.resolve(oldCamera.stream) })
    for (const track of oldCamera.tracks) expect(track.stop).toHaveBeenCalledOnce()
    for (const track of newCamera.tracks) expect(track.stop).not.toHaveBeenCalled()
    expect(newDetector.close).not.toHaveBeenCalled()
    expect(video.srcObject).toBe(newCamera.stream)
    unmount()
    for (const track of newCamera.tracks) expect(track.stop).toHaveBeenCalledOnce()
    expect(newDetector.close).toHaveBeenCalledOnce()
  })
})
