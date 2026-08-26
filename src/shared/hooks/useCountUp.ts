import { useEffect, useRef, useState } from 'react'

/**
 * Count-up animatsiya (eski qiymat → target, easeOutCubic).
 *
 * MOUNT'DA ANIMATSIYA YO'Q. Ilgari hook har mount'da 0 dan boshlardi, ya'ni
 * Dashboard har ochilganda foiz qaytadan "sanalardi" — refresh'da bezovta
 * qiladigan, ma'nosiz effekt (qiymat o'zgarmagan bo'lsa ham). Bundan tashqari
 * savollar soni asinxron kelgani uchun target avval 0, keyin haqiqiy qiymat
 * bo'lardi va sanoq kech, ikkinchi marta ishga tushardi.
 *
 * Endi birinchi MA'NOLI qiymat (target > 0) darhol ko'rsatiladi, animatsiya
 * esa faqat SESSIYA ICHIDA qiymat o'zgarganda ishlaydi (masalan, savol
 * yechilgach foiz o'sganda) — aynan animatsiya foydali bo'lgan payt.
 */
export function useCountUp(target: number, durationMs = 800): number {
  const [value, setValue] = useState(target)
  // Birinchi ma'noli qiymat hali kelmadimi? Kelguncha animatsiya qilinmaydi.
  const primed = useRef(target > 0)
  const from = useRef(target)

  useEffect(() => {
    const reduce = document.body.dataset.noAnimation === 'true'
      || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

    // Hali "primed" emas (target 0 dan kelmoqda, ya'ni ma'lumot yuklanyapti)
    // yoki animatsiya o'chirilgan — sakrash, sanoqsiz.
    if (!primed.current || reduce) {
      if (target > 0) primed.current = true
      from.current = target
      setValue(target)
      return
    }
    if (from.current === target) return

    const start = from.current
    const delta = target - start
    let raf = 0
    // t0 BIRINCHI kadrdan olinadi, performance.now() dan emas: rAF timestamp'i
    // boshqa vaqt bazasida bo'lishi mumkin va ayirma manfiy chiqib, qiymat
    // butunlay buzilardi (jsdom'da aynan shunday). p ham [0,1] ga qisiladi.
    let t0 = 0
    const tick = (now: number) => {
      if (t0 === 0) t0 = now
      const p = Math.min(1, Math.max(0, (now - t0) / durationMs))
      setValue(Math.round(start + delta * (1 - Math.pow(1 - p, 3))))
      if (p < 1) raf = requestAnimationFrame(tick)
      else from.current = target
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, durationMs])

  return value
}
