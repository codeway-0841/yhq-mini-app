import { describe, expect, it, vi, afterEach } from 'vitest'
import { captureVideoFrame, isVideoFrameReady } from '../../../src/shared/lib/camera-capture'

function makeVideo(width: number, height: number, readyState = HTMLMediaElement.HAVE_CURRENT_DATA) {
  const video = document.createElement('video')
  Object.defineProperties(video, {
    readyState: { value: readyState, configurable: true },
    videoWidth: { value: width, configurable: true },
    videoHeight: { value: height, configurable: true },
  })
  return video
}

describe('camera-capture helpers', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('rejects camera frames before the video element has real dimensions', () => {
    expect(isVideoFrameReady(makeVideo(0, 720))).toBe(false)
    expect(isVideoFrameReady(makeVideo(1280, 0))).toBe(false)
    expect(captureVideoFrame(makeVideo(0, 0))).toBeNull()
  })

  it('captures a ready video frame as jpeg data url', () => {
    const drawImage = vi.fn()
    const toDataURL = vi.fn(() => 'data:image/jpeg;base64,frame')
    const originalCreateElement = document.createElement.bind(document)

    vi.spyOn(document, 'createElement').mockImplementation((tagName, options) => {
      if (tagName === 'canvas') {
        return {
          width: 0,
          height: 0,
          getContext: () => ({ drawImage }),
          toDataURL,
        } as unknown as HTMLCanvasElement
      }
      return originalCreateElement(tagName, options)
    })

    const frame = captureVideoFrame(makeVideo(640, 480), 0.75)

    expect(frame).toEqual({
      dataUrl: 'data:image/jpeg;base64,frame',
      mimeType: 'image/jpeg',
      width: 640,
      height: 480,
    })
    expect(drawImage).toHaveBeenCalledOnce()
    expect(toDataURL).toHaveBeenCalledWith('image/jpeg', 0.75)
  })
})
