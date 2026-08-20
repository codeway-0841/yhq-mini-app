import { useRef, useState } from 'react'
import { useAppStore } from '../../../shared/store/useAppStore'
import { t } from '../../../shared/i18n'

/** Galereyadagi rasmni 256px kvadrat WebP data URL'ga siqadi (localStorage uchun yengil). */
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

/**
 * Avatar yuklash oqimi — fayl tanlash → siqish → lokal store.
 * Server yuborilmaydi — Telegram WebView'da maxsus avatar endpoint'i yo'q;
 * data URL localStorage'da saqlanadi.
 */
export function useAvatarUpload({ showToast, closeSheet }: {
  showToast: (msg: string) => void
  closeSheet: () => void
}) {
  const lang = useAppStore((s) => s.settings.language)
  const setCustomAvatar = useAppStore((s) => s.setCustomAvatar)
  const [avatarBusy, setAvatarBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleAvatarFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // bir xil faylni qayta tanlash ham ishlashi uchun
    if (!file) return
    setAvatarBusy(true)
    try {
      const dataUrl = await compressAvatar(file)
      if (dataUrl.length > 500_000) throw new Error('too big')
      setCustomAvatar(dataUrl)
      closeSheet()
      showToast(t(lang, 'avatarSavedToast'))
    } catch {
      showToast(t(lang, 'avatarUploadFailed'))
    } finally {
      setAvatarBusy(false)
    }
  }

  return { fileRef, avatarBusy, handleAvatarFile }
}
