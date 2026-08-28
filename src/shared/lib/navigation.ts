import type { NavigateFunction } from 'react-router-dom'

export interface ModalEntry {
  id: symbol
  onClose: () => void
}

const modalStack: ModalEntry[] = []
type ModalListener = (count: number) => void
const modalListeners = new Set<ModalListener>()

function notifyModalListeners(): void {
  const count = modalStack.length
  modalListeners.forEach((listener) => {
    try {
      listener(count)
    } catch {
      // no-op
    }
  })
}

/**
 * Modal stack sonini kuzatish (App.tsx BackButton boshqaruvi uchun).
 */
export function subscribeModalStack(listener: ModalListener): () => void {
  modalListeners.add(listener)
  listener(modalStack.length)
  return () => {
    modalListeners.delete(listener)
  }
}

/**
 * Modal/Dialog ro'yxatdan o'tkazish.
 * Android sensor/hardware gesture yoki BackButton bosilganda
 * botdan chiqib ketmasdan, eng oxirgi modalni yopish uchun.
 */
export function registerModal(id: symbol, onClose: () => void): () => void {
  modalStack.push({ id, onClose })
  notifyModalListeners()

  return () => {
    const idx = modalStack.findIndex((m) => m.id === id)
    if (idx >= 0) {
      modalStack.splice(idx, 1)
      notifyModalListeners()
    }
  }
}

/**
 * Hozir biror modal yoki sheet ochiqmi?
 */
export function hasOpenModal(): boolean {
  return modalStack.length > 0
}

/**
 * Eng yuqoridagi modalni yopadi.
 * @returns true agar modal yopilgan bo'lsa, false agar modal bo'lmasa.
 */
export function closeTopModal(): boolean {
  const top = modalStack.pop()
  if (top) {
    notifyModalListeners()
    try {
      top.onClose()
    } catch {
      // no-op
    }
    return true
  }
  return false
}

/**
 * Xavfsiz "Orqaga":
 *  1) Agar biror modal/sheet ochiq bo'lsa — eng oxirgisini yopadi (botdan chiqib ketmaydi).
 *  2) Modal bo'lmasa — browser/router history bo'yicha bitta qadam orqaga (`navigate(-1)`).
 *  3) Agar history bo'lmasa (reload holati) — bosh sahifaga (`/`) qaytaradi.
 */
export function goBack(navigate?: NavigateFunction): void {
  if (closeTopModal()) {
    return
  }
  if (navigate) {
    const idx = (window.history.state as { idx?: number } | null)?.idx
    if (typeof idx === 'number' && idx > 0) {
      navigate(-1)
    } else {
      navigate('/', { replace: true })
    }
  } else if (typeof window !== 'undefined' && window.history) {
    window.history.back()
  }
}

