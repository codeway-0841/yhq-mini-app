/**
 * Kontekstli "sharh so'rash" prompti — holat + qoidalar (SSOT).
 *
 * NEGA ALOHIDA STORE: prompt asosiy ekranda DOIMIY joy egallamaydi
 * (qator'dagi 2 doira boshqa vazifalarga band). O'rniga u faqat
 * "yutuq momenti"da — test yakunlanganda yoki level-up yopilganda —
 * ko'rsatiladi va takrorlanmaydi.
 *
 * Qoidalar (hammasi `canPromptForReview` da, testda qulflangan):
 *   1. Foydalanuvchi allaqachon sharh yozgan bo'lsa — boshqa so'ramaymiz.
 *   2. 14 kunlik cooldown — bir marta so'ralgandan keyin jim turamiz.
 *   3. 2 marta "keyinroq" deyilsa — butunlay to'xtaymiz (bezovta qilmaymiz).
 *
 * `yhq-review-prompt` ACCOUNT_STORAGE_KEYS'da: "sharh yozdim" — aynan shu
 * akkauntning holati, shared qurilmada keyingi akkauntga o'tmasligi kerak.
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/** Prompt qaysi "yutuq"dan keyin so'ralayotgani (analitika uchun) */
export type ReviewPromptKind = 'test-result' | 'level-up'

/** Bir marta so'ralgandan keyin jim turadigan muddat */
export const REVIEW_COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000
/** Shu martadan keyin umuman so'ramaymiz */
export const REVIEW_MAX_DISMISSALS = 2

export interface ReviewPromptState {
  /** idle — so'rash mumkin · written — sharh yozilgan · opted-out — bezovta qilmaymiz */
  status: 'idle' | 'written' | 'opted-out'
  /** Necha marta ko'rsatilgani (cooldown hisobi uchun) */
  shownCount: number
  /** Oxirgi ko'rsatilgan vaqt (ms) */
  lastAskedAt: number | null
  /** Ko'rsatilishi kerak bo'lgan kontekst — TRANSIENT (persist qilinmaydi) */
  pending: ReviewPromptKind | null

  /** Yutuq momenti: qoidalar bo'yicha ruxsat bo'lsa promptni navbatga qo'yadi */
  request: (kind: ReviewPromptKind) => void
  /** "Keyinroq" — cooldown; limitga yetganda butunlay to'xtaydi */
  dismiss: () => void
  /** "Sharh qoldirish" bosildi — qayta so'ramaymiz, lekin "yozildi" deb belgilamaymiz */
  markAsked: () => void
  /** Sharh serverda qabul qilindi — boshqa hech qachon so'ramaymiz */
  markWritten: () => void
  /** Tashqi navigatsiya (masalan, boshqa sahifaga o'tildi) — navbatni tozalash */
  clearPending: () => void
}

/** Sof qoida — `now` uzatiladi, shuning uchun testda deterministik */
export function canPromptForReview(
  state: Pick<ReviewPromptState, 'status' | 'shownCount' | 'lastAskedAt'>,
  now: number = Date.now(),
): boolean {
  if (state.status !== 'idle') return false
  if (state.shownCount >= REVIEW_MAX_DISMISSALS) return false
  if (state.lastAskedAt !== null && now - state.lastAskedAt < REVIEW_COOLDOWN_MS) return false
  return true
}

export const useReviewPromptStore = create<ReviewPromptState>()(
  persist(
    (set, get) => ({
      status: 'idle',
      shownCount: 0,
      lastAskedAt: null,
      pending: null,

      request: (kind) => {
        if (get().pending) return
        if (!canPromptForReview(get())) return
        set({ pending: kind })
      },

      dismiss: () =>
        set((s) => {
          const shownCount = s.shownCount + 1
          return {
            pending: null,
            shownCount,
            lastAskedAt: Date.now(),
            status: shownCount >= REVIEW_MAX_DISMISSALS ? 'opted-out' : 'idle',
          }
        }),

      markAsked: () =>
        set((s) => ({ pending: null, shownCount: s.shownCount + 1, lastAskedAt: Date.now() })),

      markWritten: () => set({ pending: null, status: 'written', lastAskedAt: Date.now() }),

      clearPending: () => set({ pending: null }),
    }),
    {
      name: 'yhq-review-prompt',
      version: 1,
      partialize: (s) => ({ status: s.status, shownCount: s.shownCount, lastAskedAt: s.lastAskedAt }) as ReviewPromptState,
    },
  ),
)
