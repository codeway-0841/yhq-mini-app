/**
 * Account-reset event bus (P1-6).
 *
 * Muammo: `resetAccountState` (shared/store/account.ts) localStorage'ni
 * tozalaydi, lekin user-scoped Zustand store'lar XOTIRADAGI holatni saqlab
 * qoladi — yangi akkaunt eski sessiyani ko'radi (math-board sessiyasi).
 *
 * Nega to'g'ridan import emas: account.ts shared qatlam — feature store'ni
 * import qilsa inverted dependency (qoida 1a, import-boundary testi).
 * Event yo'nalishi: shared (emit) → feature (subscribe). Feature store'lar
 * o'zlari obuna bo'ladi (modul yuklanganda bir marta).
 */

type Listener = () => void

const listeners = new Set<Listener>()

/** Account reset hodisasiga obuna (unsubscribe qaytaradi) */
export function onAccountReset(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Barcha obunachilarga reset signali (faqat account.ts chaqiradi) */
export function emitAccountReset(): void {
  for (const listener of [...listeners]) {
    try {
      listener()
    } catch {
      // Bitta listener xatosi boshqalarni to'xtatmasin
    }
  }
}
