/**
 * Resumable test sessiyasi — persist (localStorage).
 *
 * Bitta AKTIV sessiya saqlanadi (joriy UX bir vaqtda bitta testga mos).
 * TestPage har javob/pagination'da snapshot'ni yangilaydi; reload yoki
 * Telegram WebView restart'dan keyin session descriptori bo'yicha davom
 * ettiriladi. Akkaunt almashganda App.tsx `clear()` chaqiradi.
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { TestSessionSnapshot } from '../lib/test-session'

interface TestSessionState {
  session: TestSessionSnapshot | null
  save:    (s: TestSessionSnapshot) => void
  clear:   () => void
}

export const useTestSessionStore = create<TestSessionState>()(
  persist(
    (set) => ({
      session: null,
      save:    (session) => set({ session }),
      clear:   () => set({ session: null }),
    }),
    { name: 'yhq-test-session', version: 1 },
  ),
)
