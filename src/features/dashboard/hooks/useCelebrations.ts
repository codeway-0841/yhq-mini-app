import { useEffect, useState } from 'react'
import { MILESTONES, milestoneSeen, milestoneMark } from '../components/Celebrations'

/**
 * Nishonlash sahnalari (Level-Up + Streak milestone) — localStorage'da
 * "ko'rilgan"lar belgilanadi, bir marta yoki yangi rekordda ochiladi.
 */
export function useCelebrations(level: number, dailyStreak: number, subjectId: string) {
  const [milestone, setMilestone] = useState<number | null>(null)
  const [levelUp, setLevelUp]     = useState<number | null>(null)

  // ⬆️ Level-Up — yangi darajaga YETGANDA (oldin mavjud level'dan yuqori) nishonlash
  useEffect(() => {
    try {
      const raw = localStorage.getItem('yhq-level-seen')
      if (raw === null) {
        // Birinchi ishga tushirish — mavjud foydalanuvchiga "tasodifiy" sahna chiqarmaslik
        localStorage.setItem('yhq-level-seen', String(level))
        return
      }
      const seen = Number(raw)
      // Level endi SERVER XP'sidan hisoblanadi (avval totalCorrect/50 edi va
      // sun'iy baland chiqardi). Eski yozuv joriy leveldan YUQORI bo'lsa —
      // uni pasaytiramiz, aks holda foydalanuvchi eski "shishgan" levelga
      // qaytib chiqmaguncha level-up sahnasi umuman ko'rinmay qolardi.
      if (!Number.isFinite(seen) || seen > level) {
        localStorage.setItem('yhq-level-seen', String(level))
        return
      }
      if (level > seen) {
        localStorage.setItem('yhq-level-seen', String(level))
        const t = setTimeout(() => setLevelUp(level), 700)
        return () => clearTimeout(t)
      }
    } catch { /* jim */ }
  }, [level])

  // Streak MILESTONE — birinchi marta yetganda to'liq ekranli nishonlash
  useEffect(() => {
    const hit = MILESTONES.find((m) => m === dailyStreak)
    if (hit && !milestoneSeen(subjectId).includes(hit)) {
      milestoneMark(subjectId, hit)
      // sahifa to'liq ochilgach ko'rsatamiz (premium kirish hissi)
      const t = setTimeout(() => setMilestone(hit), 600)
      return () => clearTimeout(t)
    }
  }, [dailyStreak, subjectId])

  return {
    milestone, levelUp,
    closeMilestone: () => setMilestone(null),
    closeLevelUp: () => setLevelUp(null),
    /** Long-press demo: 7-kun sahna PREVIEW (production'da yashirin funksiya) */
    previewMilestone: setMilestone,
  }
}
