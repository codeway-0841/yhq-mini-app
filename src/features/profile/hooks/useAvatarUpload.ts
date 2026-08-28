import { useRef, useState } from 'react'
import { useAppStore } from '../../../shared/store/useAppStore'
import { t, type Keys } from '../../../shared/i18n'
import { api, ApiError } from '../../../shared/api'
import { Sentry } from '../../../shared/lib/sentry'

/** Server cheklovi bilan SINXRON (users.service AvatarUploadSchema max(100_000)). */
export const AVATAR_MAX_DATA_URL_LEN = 100_000

/** Adaptiv siqish bosqichlari — limitga SIG'GUNCHA tushib boramiz
 *  (client hech qachon "rasm katta" deb ovora bo'lmasligi uchun). */
const MIME_STEPS = ['image/webp', 'image/jpeg'] as const // WebP kichikroq; JPEG — eski WebView fallback
const SIZE_STEPS = [256, 192, 128] as const
const QUALITY_STEPS = [0.82, 0.7, 0.55] as const

/** Markazdan kvadrat crop → size×size canvas. */
function cropToCanvas(img: HTMLImageElement, size: number): HTMLCanvasElement | null {
  const side = Math.min(img.width, img.height)
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size)
  return canvas
}

/** Codec tekshiruvi bilan encode: eski brauzer WebP so'ralsa JIMGINA PNG
 *  qaytaradi — buni "codec yo'q" deb hisoblaymiz (null). */
function tryEncode(canvas: HTMLCanvasElement, mime: string, quality: number): string | null {
  try {
    const url = canvas.toDataURL(mime, quality)
    return url.startsWith(`data:${mime}`) ? url : null
  } catch {
    return null
  }
}

function loadImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      if (!Math.min(img.width, img.height)) return reject(new Error('bad image'))
      resolve(img)
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('load failed')) }
    img.src = url
  })
}

/** WebView decode qila oladigan rasmni qaytaradi. Android Chrome WebView
 *  HEIC/HEIF'ni (iPhone kamera formati, Samsung "High efficiency" rejimi)
 *  OCHOLMAYDI — bunday holda client O'ZI JPEG'ga o'giradi: heic2any sof JS
 *  (WASM yo'q — CSP xavfsiz) va LAZY chunk — faqat shu holatda yuklanadi,
 *  oddiy JPG/PNG userlar hech qachon to'lamaydi. */
async function loadDecodableImage(file: File): Promise<HTMLImageElement> {
  try {
    return await loadImage(file)
  } catch (originalErr) {
    try {
      const { default: heic2any } = await import('heic2any')
      const converted = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.9 })
      return await loadImage(Array.isArray(converted) ? converted[0] : converted)
    } catch {
      throw originalErr // HEIC ham emas — haqiqiy "format qo'llab-quvvatlanmaydi"
    }
  }
}

/** Galereyadagi rasmni server limitiga SIG'DIRIB kvadrat data URL'ga siqadi:
 *  WebP → JPEG, har birida sifat/o'lcham bosqichma-bosqich tushadi. */
async function compressAvatar(file: File): Promise<string> {
  const img = await loadDecodableImage(file)
  for (const mime of MIME_STEPS) {
    for (const size of SIZE_STEPS) {
      const canvas = cropToCanvas(img, size)
      if (!canvas) throw new Error('no canvas')
      for (const quality of QUALITY_STEPS) {
        const dataUrl = tryEncode(canvas, mime, quality)
        if (!dataUrl) break // bu brauzerda codec yo'q — keyingi mime'ga o'tamiz
        if (dataUrl.length <= AVATAR_MAX_DATA_URL_LEN) return dataUrl
      }
    }
  }
  throw new Error('too big')
}

/** Xato SABABINI i18n kalitiga xaritalash — ilgari barchasi umumiy
 *  "Boshqa rasm tanlang" toast'iga yutilib, diagnostika imkonsiz edi. */
function avatarErrorKey(err: unknown): Keys {
  const msg = err instanceof Error ? err.message : ''
  // Rasm decode bo'lmadi — HEIC (iPhone) yoki buzilgan/noma'lum format
  if (msg === 'load failed' || msg === 'bad image') return 'avatarUploadBadFormat'
  // Barcha adaptiv bosqichlar (128px JPEG q0.55 gacha) sig'madi — amalda imkonsizga yaqin
  if (msg === 'too big') return 'avatarUploadTooBig'
  if (err instanceof ApiError) {
    if (err.status === 400) return 'avatarUploadBadFormat'  // schema: WebP/JPEG emas
    if (err.status === 413) return 'avatarUploadTooBig'
    if (err.status === 429) return 'avatarUploadRateLimit'
    if (err.status <= 0 || err.status === 408 || err.status >= 500) return 'avatarUploadNetwork'
  }
  return 'avatarUploadFailed'
}

/** Diagnostika hinti — decode xatosida faylning ANIQLANGAN formatini ko'rsatadi.
 *  User ".jpg" deb o'ylagan fayl aslida HEIC/AVIF chiqishi ko'p uchraydi:
 *  kengaytma ≠ ichki format, file.type (OS picker) + kengaytma haqiqatni aytdi. */
export function describePickedFile(file: File): string {
  const type = file.type || `(noma'lum) .${file.name.split('.').pop()?.toLowerCase() ?? '?'}`
  return `${type} · ${(file.size / 1024 / 1024).toFixed(1)}MB`
}

/** Haqiqiy sabab konsol + Sentry'da qoladi — toast foydalanuvchiga qisqa.
 *  Fayl meta (type/kengaytma/hajm) diagnostika uchun SHART: WebView decode
 *  xatolarida (HEIC/AVIF/...) rasmning HAqiqiy formatini ko'rsatadi. */
function reportAvatarError(err: unknown, file?: File) {
  const meta = file ? { type: file.type || '(bo\'sh)', name: file.name, sizeKB: Math.round(file.size / 1024) } : undefined
  console.warn('[avatar] yuklash xatosi:', err, meta ?? '')
  Sentry.captureException(err instanceof Error ? err : new Error(String(err)), {
    tags: { area: 'avatar-upload' },
    extra: meta,
  })
}

/**
 * Avatar yuklash oqimi — fayl tanlash → siqish → SERVER'ga yuborish → lokal store.
 * Server-first: PUT muvaffaqiyatli bo'lmasa lokal YOZILMAYDI — avatar global
 * (leaderboard/duel) ko'rinishi uchun users.avatar_webp yagona manba bo'lishi shart.
 */
export function useAvatarUpload({ showToast, closeSheet }: {
  showToast: (msg: string) => void
  closeSheet: () => void
}) {
  const lang = useAppStore((s) => s.settings.language)
  const setCustomAvatar = useAppStore((s) => s.setCustomAvatar)
  const userId = useAppStore((s) => s.user?.id)
  const [avatarBusy, setAvatarBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleAvatarFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // bir xil faylni qayta tanlash ham ishlashi uchun
    if (!file || !userId) return
    setAvatarBusy(true)
    try {
      // compressAvatar limitga SIG'DIRIB qaytaradi (yoki reject) — qo'shimcha tekshiruv shart emas
      const dataUrl = await compressAvatar(file)
      await api.uploadAvatar(userId, dataUrl)   // SERVER-FIRST — muvaffaqiyat = global
      setCustomAvatar(dataUrl)
      closeSheet()
      showToast(t(lang, 'avatarSavedToast'))
    } catch (err) {
      reportAvatarError(err, file)
      const key = avatarErrorKey(err)
      // Format/decode xatosida aniqlangan HAQIQIY formatni ham ko'rsatamiz —
      // user "lekin bu jpg-ku!" holatini bir qarashda tushunadi
      const hint = key === 'avatarUploadBadFormat' ? ` [${describePickedFile(file)}]` : ''
      showToast(t(lang, key) + hint)
    } finally {
      setAvatarBusy(false)
    }
  }

  /** O'chirish ham server-first: DELETE o'tsa lokal tozalanadi. */
  const removeAvatar = async () => {
    if (!userId || avatarBusy) return
    setAvatarBusy(true)
    try {
      await api.removeAvatar(userId)
      setCustomAvatar(null)
      closeSheet()
      showToast(t(lang, 'avatarRemovedToast'))
    } catch (err) {
      reportAvatarError(err)
      showToast(t(lang, avatarErrorKey(err)))
    } finally {
      setAvatarBusy(false)
    }
  }

  return { fileRef, avatarBusy, handleAvatarFile, removeAvatar }
}
