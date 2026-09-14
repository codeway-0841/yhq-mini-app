export const CAMERA_START_GRACE_MS = 12_000
export const CAMERA_AUTO_START_KEY = 'kivvi_snap_camera_auto_start'

export type CameraPermissionState = PermissionState | 'unknown'

export type CapturedVideoFrame = {
  dataUrl: string
  mimeType: 'image/jpeg'
  width: number
  height: number
}

export function hasRememberedCameraAccess(storage: Storage | undefined = safeLocalStorage()): boolean {
  if (!storage) return false
  try {
    return storage.getItem(CAMERA_AUTO_START_KEY) === '1'
  } catch {
    return false
  }
}

export function rememberCameraAccess(enabled: boolean, storage: Storage | undefined = safeLocalStorage()) {
  if (!storage) return
  try {
    if (enabled) storage.setItem(CAMERA_AUTO_START_KEY, '1')
    else storage.removeItem(CAMERA_AUTO_START_KEY)
  } catch {
    // Storage can be unavailable in privacy-restricted WebViews.
  }
}

export async function queryCameraPermission(
  permissions: Pick<Permissions, 'query'> | undefined =
    typeof navigator === 'undefined' ? undefined : navigator.permissions,
): Promise<CameraPermissionState> {
  if (!permissions) return 'unknown'

  try {
    const status = await permissions.query({ name: 'camera' as PermissionName })
    return status.state
  } catch {
    // Some WebViews do not expose camera through Permissions API.
    return 'unknown'
  }
}

export function isCameraPermissionError(error: unknown): boolean {
  if (!error || typeof error !== 'object' || !('name' in error)) return false
  const name = String((error as { name?: unknown }).name || '')
  return name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError'
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

function safeLocalStorage(): Storage | undefined {
  if (typeof window === 'undefined') return undefined
  return window.localStorage
}
