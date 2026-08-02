/**
 * Joriy tanlangan fan — global state (localStorage persist).
 * Dashboard, Onboarding, Switcher shu store orqali sinxron ishlaydi.
 * Fan almashganda sahifa reload bo'lmaydi — faqat store o'zgaradi.
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { DEFAULT_SUBJECT_ID, getSubject, type SubjectConfig } from '../config/subjects'

interface SubjectState {
  subjectId: string
  subject: SubjectConfig
  setSubject: (id: string) => void
}

export const useSubjectStore = create<SubjectState>()(
  persist(
    (set) => ({
      subjectId: DEFAULT_SUBJECT_ID,
      subject:   getSubject(DEFAULT_SUBJECT_ID),
      setSubject: (id) => set({ subjectId: id, subject: getSubject(id) }),
    }),
    {
      name: 'yhq-subject',
      // Eski versiya state'dan faqat id'ni o'qiymiz; subject doim config'dan olinadi
      merge: (persisted, current) => {
        const id = (persisted as { subjectId?: string } | undefined)?.subjectId
        return id ? { ...current, subjectId: id, subject: getSubject(id) } : current
      },
      partialize: (s) => ({ subjectId: s.subjectId }) as SubjectState,
    },
  ),
)
