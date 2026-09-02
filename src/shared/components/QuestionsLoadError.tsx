/**
 * Savollar yuklanmaganda ko'rsatiladigan holat.
 *
 * Nima uchun alohida komponent: sahifalar (TestPage, Biletlar) ilgari xatoda
 * ham cheksiz spinner ko'rsatardi — `loaded` va `loading` ikkalasi ham false
 * qolgani uchun effekt qayta-qayta `load()` chaqirardi. Server butun savol
 * bankini bir IP dan kuniga 20 marta beradi (questions.router.ts
 * FULL_BANK_DAILY_CAP), shuning uchun sikl limitni bir necha soniyada yeb,
 * 429 + 24 soatlik blokga olib kelardi. Endi qayta urinish QO'LDA.
 */
import { AlertTriangle, RotateCw } from 'lucide-react'
import { useQuestionsStore } from '../store/useQuestionsStore'
import { useT } from '../i18n'

export default function QuestionsLoadError({ error, lang }: { error: string; lang: 'uz' | 'ru' }) {
  const tt = useT(lang)
  const retry = useQuestionsStore((s) => s.retry)
  const loading = useQuestionsStore((s) => s.loading)

  // 429 — limitga urildik: "qayta urinish" darhol yordam bermaydi, shuning
  // uchun sababni ochiq aytamiz (jim spinnerdan ko'ra foydaliroq).
  const rateLimited = /429|too_many_requests/i.test(error)

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-8 text-center">
      <AlertTriangle size={40} strokeWidth={1.5} className="text-pwarning opacity-80" />
      <p className="font-display text-[17px] font-semibold text-pfg">{tt('qLoadFailed')}</p>
      <p className="max-w-[34ch] text-[13.5px] leading-relaxed text-pmuted">
        {rateLimited ? tt('qLoadRateLimited') : error}
      </p>
      <button
        type="button"
        onClick={() => void retry()}
        disabled={loading}
        className="mt-1 inline-flex h-11 items-center gap-2 rounded-2xl bg-pprimary px-5 text-[15px] font-semibold text-ponprimary transition-transform active:scale-[0.97] disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary focus-visible:ring-offset-2 focus-visible:ring-offset-pcanvas shadow-xs"
      >
        <RotateCw size={16} strokeWidth={2} className={loading ? 'animate-spin' : undefined} />
        {tt('qLoadRetry')}
      </button>
    </div>
  )
}
