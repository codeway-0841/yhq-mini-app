export type WebPictureInPictureResult = 'entered' | 'exited' | 'unsupported' | 'no-video' | 'failed'

/**
 * Telegram Mini App / brauzer uchun user-gesture bilan ishlaydigan Web PiP.
 * Native Android PiP alohida native.ts bridge orqali boshqariladi.
 */
export async function toggleWebPictureInPicture(container: ParentNode | null): Promise<WebPictureInPictureResult> {
  if (typeof document === 'undefined' || !container || !document.pictureInPictureEnabled) {
    return 'unsupported'
  }

  try {
    if (document.pictureInPictureElement) {
      await document.exitPictureInPicture()
      return 'exited'
    }

    const videos = Array.from(container.querySelectorAll<HTMLVideoElement>('video[data-live-pip-priority]'))
      .sort((a, b) => Number(a.dataset.livePipPriority) - Number(b.dataset.livePipPriority))
    const video = videos.find((candidate) => candidate.readyState !== HTMLMediaElement.HAVE_NOTHING)
      ?? videos[0]

    if (!video) return 'no-video'
    if (typeof video.requestPictureInPicture !== 'function') return 'unsupported'

    await video.requestPictureInPicture()
    return 'entered'
  } catch (error) {
    const name = (error as { name?: string })?.name
    if (name === 'InvalidStateError') return 'no-video'
    if (name === 'NotSupportedError' || name === 'SecurityError' || name === 'NotAllowedError') return 'unsupported'
    return 'failed'
  }
}
