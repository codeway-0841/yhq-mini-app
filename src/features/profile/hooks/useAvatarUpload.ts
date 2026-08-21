import { useRef, useState } from 'react'
import { useAppStore } from '../../../shared/store/useAppStore'
import { t } from '../../../shared/i18n'
import { api } from '../../../shared/api'

/** Galereyadagi rasmni 256px kvadrat WebP data URL'ga siqadi (server limiti uchun yengil). */
function compressAvatar(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      const SIZE = 256
      const side = Math.min(img.width, img.height)
      if (!side) return reject(new Error('bad image'))
      const canvas = document.createElement('canvas')
      canvas.width = SIZE
      canvas.height = SIZE
      const ctx = canvas.getContext('2d')
      if (!ctx) return reject(new Error('no canvas'))
      // Markazdan kvadrat crop
      ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, SIZE, SIZE)
      try { resolve(canvas.toDataURL('image/webp', 0.82)) }
      catch { reject(new Error('encode failed')) }
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('load failed')) }
    img.src = url
  })
}

/** Server cheklovi bilan SINXRON (users.service AvatarUploadSchema max(100_000)). */
export const AVATAR_MAX_DATA_URL_LEN = 100_000

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
      const dataUrl = await compressAvatar(file)
      if (dataUrl.length > AVATAR_MAX_DATA_URL_LEN) throw new Error('too big')
      await api.uploadAvatar(userId, dataUrl)   // SERVER-FIRST — muvaffaqiyat = global
      setCustomAvatar(dataUrl)
      closeSheet()
      showToast(t(lang, 'avatarSavedToast'))
    } catch {
      showToast(t(lang, 'avatarUploadFailed'))
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
    } catch {
      showToast(t(lang, 'avatarUploadFailed'))
    } finally {
      setAvatarBusy(false)
    }
  }

  return { fileRef, avatarBusy, handleAvatarFile, removeAvatar }
}
