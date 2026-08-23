import { useCallback, useEffect, useRef } from 'react'

/**
 * Savolga javob berish vaqtini o'lchaydi (ms).
 *
 * `questionId` o'zgarganda hisoblagich qaytadan boshlanadi — ya'ni "savol
 * ekranda paydo bo'lgan payt" belgilanadi. Javob yuborilayotganda `elapsed()`
 * chaqiriladi.
 *
 * Nima uchun: savollarga qo'lda "oson/qiyin" bahosi qo'yilmaydi — buning
 * o'rniga javob vaqti yig'iladi va qiyinlik keyinchalik MA'LUMOTDAN chiqariladi
 * (bir savolga hamma uzoq o'ylasa — u qiyin). Hozircha hech qanday ball/XP'ga
 * ta'sir qilmaydi, faqat yoziladi.
 *
 * Ilova fonga o'tsa (boshqa tab/ilova) hisob davom etadi — shuning uchun server
 * 10 daqiqadan uzun qiymatlarni kesadi va bunday javoblar statistikada
 * "ishonchsiz" bo'lib qoladi.
 */
export function useAnswerTimer(questionId: number | null | undefined) {
  const startedAt = useRef<number>(Date.now())

  useEffect(() => {
    startedAt.current = Date.now()
  }, [questionId])

  // useCallback — chaqiruvchi joylarda useCallback/useEffect deps barqaror qolsin
  /** Savol ko'rsatilgandan hozirgacha ketgan vaqt (ms, butun son) */
  const elapsed = useCallback((): number => Math.max(0, Math.round(Date.now() - startedAt.current)), [])

  /** Qo'lda qayta boshlash (masalan javobdan keyin yana o'sha savol ochilsa) */
  const restart = useCallback((): void => { startedAt.current = Date.now() }, [])

  return { elapsed, restart }
}
