/**
 * AI Test Hub (/ai-test).
 * - Rasmiy AI Variantlar (Milliy Sertifikat & Attestatsiya) — UzBMB 646-qaror rasmiy standarti.
 * - AI Kunlik Testlar.
 */

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sparkles, Lock, CheckCircle2, Award, Clock } from 'lucide-react'
import { api, type AiTestTodayItem } from '../../shared/api'
import { useAppStore } from '../../shared/store/useAppStore'
import { useT } from '../../shared/i18n'
import { goBack } from '../../shared/lib/navigation'
import { PageHeader } from '../../shared/components/ui/page-header'
import { track } from '../../shared/lib/analytics'
import { AI_TEST_SUBJECT_ID, AI_TEST_MAX_COINS, AI_TEST_GRADED_TASKS } from '../../../shared/ai-daily-test'

interface AiVariantMeta {
  variantId: string
  subjectId: string
  examType: string
  variantNumber: number
  title: string
  totalQuestions: number
  durationMinutes: number
  specificationSource: string
}

export default function AiTestHub() {
  const navigate = useNavigate()
  const settings  = useAppStore((s) => s.settings)
  const isPremium = useAppStore((s) => s.tariff === 'premium')
  const tt = useT(settings.language)

  const [tests, setTests] = useState<AiTestTodayItem[] | null>(null)
  const [variants, setVariants] = useState<AiVariantMeta[] | null>(null)
  const [loadingVariant, setLoadingVariant] = useState<string | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    api.getTodayAiTests(AI_TEST_SUBJECT_ID)
      .then((r) => { if (!cancelled) setTests(r.tests) })
      .catch(() => { if (!cancelled) setError(true) })

    api.getAiVariants()
      .then((r) => { if (!cancelled) setVariants(r.variants) })
      .catch(() => {})

    return () => { cancelled = true }
  }, [])

  const open = (t: AiTestTodayItem) => {
    track('ai_test_open', { slot: t.slot, attempted: t.attempted })
    if (t.premiumRequired && !isPremium) {
      navigate('/premium')
      return
    }
    navigate(`/ai-test/${t.id}`)
  }

  const openVariant = async (variant: AiVariantMeta) => {
    track('ai_variant_open', { variantId: variant.variantId })
    setLoadingVariant(variant.variantId)
    try {
      const res = await api.getAiVariant(variant.variantId)
      const qList = res.variant.questions.map((q) => ({
        id: 950_000 + q.number,
        text: q.questionRu || q.questionUz,
        options: (q.optionsRu || q.optionsUz).map((o) => ({ id: o.id, text: o.text })),
        correctOptionId: q.correctAnswer,
        explanation: q.explanation,
        topicId: null,
        image: null,
      }))
      navigate('/test/1', {
        state: {
          mode: `ai-variant:${variant.examType}`,
          title: variant.title,
          customQuestions: qList,
        },
      })
    } catch (e) {
      console.error('Failed to open AI variant', e)
    } finally {
      setLoadingVariant(null)
    }
  }

  const hasVariants = variants && variants.length > 0

  return (
    <div className="px-4 pb-12">
      <PageHeader
        title="Test AI"
        size="lg"
        onBack={() => goBack(navigate)}
        backLabel={tt('backWord')}
        className="-mx-4 mb-4"
      />

      {/* ── 1. Rasmiy Imtihon AI Variantlari ── */}
      {hasVariants && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Award size={18} className="text-ppurple" />
            <h2 className="text-[15px] font-bold text-pfg">Rasmiy AI Variantlar</h2>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[rgb(var(--p-purple-rgb)/0.15)] text-ppurple">
              UzBMB Standart
            </span>
          </div>

          <div className="flex flex-col gap-3">
            {variants.map((v) => {
              const isLoading = loadingVariant === v.variantId
              return (
                <button
                  key={v.variantId}
                  disabled={isLoading}
                  onClick={() => openVariant(v)}
                  className="relative rounded-2xl bg-pcard w-full p-4 active:scale-[0.98] transition-all text-left shadow-xs hover:bg-psurface border border-[rgb(var(--p-purple-rgb)/0.2)]"
                >
                  <div className="flex items-start gap-3.5">
                    <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[rgb(var(--p-purple-rgb)/0.1)] text-ppurple mt-0.5">
                      <Sparkles size={22} strokeWidth={2} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-ppurple">
                          {v.examType === 'milliy-sertifikat' ? 'Milliy Sertifikat' : 'Attestatsiya'}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-psurface text-psubtle font-semibold">
                          {v.subjectId === 'rustili' ? 'Rus tili' : v.subjectId}
                        </span>
                        <span className="text-[10px] text-psubtle">· {v.variantNumber}-variant</span>
                      </div>
                      <p className="text-[15px] font-semibold text-pfg leading-snug mt-0.5">
                        {v.title}
                      </p>
                      <div className="flex items-center gap-3 mt-2 text-[12px] text-psubtle">
                        <span className="inline-flex items-center gap-1 font-medium">
                          {v.totalQuestions} ta savol
                        </span>
                        <span className="inline-flex items-center gap-1 font-medium">
                          <Clock size={12} />
                          {v.durationMinutes} daqiqa
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-pborder/40 flex items-center justify-between">
                    <span className="text-[11px] text-pmuted truncate max-w-[220px]">
                      {v.specificationSource}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[12px] font-bold text-ppurple">
                      {isLoading ? 'Yuklanmoqda...' : 'Sinovni boshlash →'}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* ── 2. AI Kunlik Testlar ── */}
      <div className="mb-2">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles size={18} className="text-ppurple" />
          <h2 className="text-[15px] font-bold text-pfg">{tt('aiTestTitle')}</h2>
        </div>

        {tests === null && !error && (
          <div className="grid place-items-center py-10">
            <div className="w-7 h-7 rounded-full border-2 border-ppurple border-t-transparent animate-spin" />
          </div>
        )}

        {(error || (tests !== null && tests.length === 0)) && !hasVariants && (
          <div className="rounded-2xl bg-pcard p-6 text-center shadow-xs">
            <Sparkles size={28} strokeWidth={1.75} className="mx-auto mb-2 text-ppurple" />
            <p className="text-[14px] text-pmuted">{tt('aiTestEmpty')}</p>
          </div>
        )}

        <div className="flex flex-col gap-3 lg:grid lg:grid-cols-2 lg:items-start">
          {tests?.map((t) => {
            const locked = t.premiumRequired && !isPremium
            return (
              <button
                key={t.id}
                onClick={() => open(t)}
                className="relative rounded-2xl bg-pcard w-full flex items-center gap-3.5 p-4 active:scale-[0.98] transition-all text-left shadow-xs hover:bg-psurface"
              >
                {!t.attempted && (
                  <span className="absolute -top-2 right-3 rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide text-ponprimary bg-ppurple animate-pulse">
                    {tt('aiTestNew')}
                  </span>
                )}
                <div className="flex size-11 shrink-0 items-center justify-center text-pmuted">
                  {locked
                    ? <Lock size={24} strokeWidth={1.75} />
                    : t.attempted
                      ? <CheckCircle2 size={24} strokeWidth={1.75} className="text-psuccess" />
                      : <Sparkles size={24} strokeWidth={1.75} className="text-ppurple" />}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-[16px] font-semibold text-pfg leading-tight truncate">{t.title}</p>
                  <p className="text-[11.5px] text-psubtle mt-0.5">
                    {t.taskCount} {tt('aiTestTaskWord')} · ≤{AI_TEST_MAX_COINS} {tt('aiTestCoinsEarned').toLowerCase()}
                  </p>
                  {t.attempted ? (
                    <span className="inline-flex items-center gap-1 mt-2 text-[11px] font-semibold text-psuccess">
                      <span className="size-2 rounded-full bg-psuccess" />
                      {tt('aiTestDone')} · {t.scoreCorrect}/{AI_TEST_GRADED_TASKS} {tt('aiTestCorrectWord').toLowerCase()}
                      {t.coinsAwarded != null && ` · +${t.coinsAwarded}🪙`}
                    </span>
                  ) : locked ? (
                    <span className="inline-flex items-center gap-1 mt-2 text-[11px] font-semibold text-ppurple">
                      <span className="size-2 rounded-full bg-ppurple" />
                      {tt('aiTestPremiumCta')}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 mt-2 text-[11px] font-semibold text-pwarning">
                      <span className="size-2 rounded-full bg-pwarning" />
                      {tt('aiTestStart')}
                    </span>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
