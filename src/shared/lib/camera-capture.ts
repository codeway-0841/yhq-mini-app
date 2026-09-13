export const CAMERA_START_GRACE_MS = 12_000

export type CapturedVideoFrame = {
  dataUrl: string
  mimeType: 'image/jpeg'
  width: number
  height: number
}

export function isVideoFrameReady(video: HTMLVideoElement): boolean {
  return (
    video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
    video.videoWidth > 1 &&
    video.videoHeight > 1
  )
}

export function captureVideoFrame(video: HTMLVideoElement, quality = 0.88): CapturedVideoFrame | null {
  if (!isVideoFrameReady(video)) return null

  const canvas = document.createElement('canvas')
  canvas.width = video.videoWidth
  canvas.height = video.videoHeight

  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

  return {
    dataUrl: canvas.toDataURL('image/jpeg', quality),
    mimeType: 'image/jpeg',
    width: canvas.width,
    height: canvas.height,
  }
}
