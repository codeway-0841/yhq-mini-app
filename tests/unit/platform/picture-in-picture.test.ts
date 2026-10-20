import { beforeEach, describe, expect, it, vi } from 'vitest'
import { toggleWebPictureInPicture } from '../../../src/platform/picture-in-picture'

function setDocumentPipState(enabled: boolean, element: Element | null = null) {
  Object.defineProperty(document, 'pictureInPictureEnabled', { configurable: true, value: enabled })
  Object.defineProperty(document, 'pictureInPictureElement', { configurable: true, value: element })
}

describe('Telegram Web Picture-in-Picture', () => {
  beforeEach(() => {
    setDocumentPipState(false)
    Object.defineProperty(document, 'exitPictureInPicture', {
      configurable: true,
      value: vi.fn().mockResolvedValue(undefined),
    })
  })

  it('platforma Web PiP bermasa unsupported qaytaradi', async () => {
    const container = document.createElement('div')
    await expect(toggleWebPictureInPicture(container)).resolves.toBe('unsupported')
  })

  it('screen-share videosini kameradan oldin tanlaydi', async () => {
    setDocumentPipState(true)
    const container = document.createElement('div')
    const camera = document.createElement('video')
    const screen = document.createElement('video')
    camera.dataset.livePipPriority = '2'
    screen.dataset.livePipPriority = '1'
    const cameraRequest = vi.fn().mockResolvedValue({})
    const screenRequest = vi.fn().mockResolvedValue({})
    Object.defineProperty(camera, 'requestPictureInPicture', { configurable: true, value: cameraRequest })
    Object.defineProperty(screen, 'requestPictureInPicture', { configurable: true, value: screenRequest })
    container.append(camera, screen)

    await expect(toggleWebPictureInPicture(container)).resolves.toBe('entered')
    expect(screenRequest).toHaveBeenCalledOnce()
    expect(cameraRequest).not.toHaveBeenCalled()
  })

  it('faol mini oynani qayta bosganda yopadi', async () => {
    const activeVideo = document.createElement('video')
    setDocumentPipState(true, activeVideo)
    const container = document.createElement('div')

    await expect(toggleWebPictureInPicture(container)).resolves.toBe('exited')
    expect(document.exitPictureInPicture).toHaveBeenCalledOnce()
  })

  it('video yo‘q bo‘lsa no-video qaytaradi', async () => {
    setDocumentPipState(true)
    const container = document.createElement('div')
    await expect(toggleWebPictureInPicture(container)).resolves.toBe('no-video')
  })
})
