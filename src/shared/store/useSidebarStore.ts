/**
 * Desktop sidebar collapse holati — DEVICE-scoped UI preference.
 *
 * - `useAppStore` dan ALOHIDA persist (`yhq-sidebar`): serverga sync
 *   YO'Q, account switch'da tozalanmaydi (ACCOUNT_STORAGE_KEYS'da yo'q).
 * - FAQAT desktop shell (DesktopSidebar) ishlatadi — shared qatlami,
 *   features/'ga import yo'q (import-boundaries).
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface SidebarState {
  collapsed: boolean
  toggle: () => void
  setCollapsed: (v: boolean) => void
}

export const useSidebarStore = create<SidebarState>()(
  persist(
    (set) => ({
      collapsed: false,
      toggle: () => set((s) => ({ collapsed: !s.collapsed })),
      setCollapsed: (collapsed) => set({ collapsed }),
    }),
    {
      name: 'yhq-sidebar',
      version: 1,
      partialize: (s) => ({ collapsed: s.collapsed }) as SidebarState,
    },
  ),
)
