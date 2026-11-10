import { useEffect, useState } from 'react'
import { RotateCcw, Share2, X, BookOpen, Award, ImageDown, Check, Minus, Sparkles, Landmark } from 'lucide-react'
import { BrilliantStreakIcon } from '../../shared/components/BrilliantStreakIcon'
import { useAppStore } from '../../shared/store/useAppStore'
import { useSubjectStore } from '../../shared/store/useSubjectStore'
import { useT } from '../../shared/i18n'
import { api } from '../../shared/api'
import { shareUrl } from '../../platform/telegram'
import { config } from '../../shared/config'
import { haptics } from '../../platform/haptics'
import { playSound } from '../../shared/lib/sounds'
import { SUBJECT_BASES } from '../../../shared/subjects'
import Confetti from '../../shared/components/Confetti'
import { CoinIcon } from '../../shared/components/CoinIcon'
import ModalShell from '../../shared/components/ModalShell'
import { Button } from '../../shared/components/ui/button'
import { SpecCard, SpecRow, SpecList } from '../../shared/components/ui/spec'
import DonutChart from './DonutChart'
import CertificateModal from './CertificateModal'
import { BrilliantEndstateRive } from '../../shared/components/BrilliantEndstateRive'
import { BrilliantStreakModal } from '../../shared/components/BrilliantStreakModal'
import { drawResultCard, buildResultShareText } from './result-canvas'
import { fetchAchievements, invalidateAchievementsCache } from '../../shared/lib/achievements-cache'
import { checkAndCelebrateAchievements, getCelebratedBadgeIds, markBadgesCelebrated } from '../../shared/lib/achievement-detector'
import { ACHIEVEMENTS } from '../../shared/config/achievements'
import { useAchievementCelebrationStore } from '../../shared/store/useAchievementCelebrationStore'
import { useReviewPromptStore } from '../../shared/store/useReviewPromptStore'
import type { TopicBreakdownItem } from './topic-diagnosis'
import { calculateRashScore, calculateDtmBenefit } from '../../../shared/milliy-sertifikat'

export type QuestionResult = { questionId: number; status: 'correct' | 'incorrect' | 'unanswered' | 'pending' }

export default function ResultsModal({
  results,
  onRetry,
  onFinish,
  onGoToQuestion,
  onOpenReview,
  threshold = 90,
  hideVerdict = false,
  topicBreakdown,
  disqualifiedByCheat = false,
  earnedXp,
  earnedCoins,
  examPresetId,
}: {
  results: QuestionResult[]
  onRetry: () => void
  onFinish: () => void
  onGoToQuestion: (i: number) => void
  onOpenReview?: () => void
  /** o'tish foizi — exam rejimida 90 (haqiqiy imtihon), qolganida 80 */
  threshold?: number
  /** Rasmiy preset (milliy-sertifikat/attestatsiya): o'tdi/o'tmadi mezonsiz — faqat natija */
  hideVerdict?: boolean
  /** Yakunda mavzular kesimida diagnostika (rasmiy imtihon presetlarida) */
  topicBreakdown?: TopicBreakdownItem[]
  /** Anti-Cheat qoidabuzarlik tufayli to'xtatilganmi */
  disqualifiedByCheat?: boolean
  /** Olingan authoritative XP (serverdan) */
  earnedXp?: number
  /** Olingan authoritative tangalar (serverdan) */
  earnedCoins?: number
  /** Rasmiy imtihon preset identifikatori (masalan: 'milliy-sertifikat') */
  examPresetId?: string | null
}) {
  const [showCertificate, setShowCertificate] = useState(false)
  const [showStreakModal, setShowStreakModal] = useState(false)
  const [sharingImage, setSharingImage] = useState(false)
  const [imageSentToBot, setImageSentToBot] = useState(false)
  const streak     = useAppStore((s) => s.streak)
  const lang       = useAppStore((s) => s.settings.language)
  const isRu       = lang === 'ru'
  const tt         = useT(lang)
  const total      = results.length
  const correct    = results.filter((r) => r.status === 'correct').length
  const wrong      = results.filter((r) => r.status === 'incorrect').length
  const pending    = results.filter((r) => r.status === 'pending').length
  const unanswered = results.filter((r) => r.status === 'unanswered' || r.status === 'pending').length
  const percent    = total > 0 ? Math.round((correct / total) * 100) : 0

  const isMilliySertifikat = examPresetId === 'milliy-sertifikat'
  const rashScore = isMilliySertifikat ? calculateRashScore(correct, total) : 0
  const dtmBenefit = isMilliySertifikat ? calculateDtmBenefit(rashScore) : null
  const passed = isMilliySertifikat
    ? (dtmBenefit?.isPassed ?? false) && !disqualifiedByCheat
    : percent >= threshold && !disqualifiedByCheat

  /**
   * Kontekstli sharh so'rovi — FAQAT yutuq momentida.
   * Shart: diskvalifikatsiya yo'q, yetarli savol (≥5) va yaxshi natija (≥70%).
   * Bu yerda faqat NAVBATGA qo'yiladi; sheet natija modal YOPILGANDAN keyin
   * chiqadi (ReviewPromptSheet `useModalCount()` ni kutadi) — natija ekranini
   * to'sib qo'ymaydi. Takrorlanmaslik/cooldown `useReviewPromptStore` da.
   */
  useEffect(() => {
    if (disqualifiedByCheat) return
    if (total < 5 || percent < 70) return
    useReviewPromptStore.getState().request('test-result')
  }, [disqualifiedByCheat, total, percent])

  /** #48 — natijani RASM qilib ulashish. Muhimlilik tartibi:
   *  1) Web Share (files) — brauzer/tashqi WebView'da ishlaydi
   *  2) BOT orqali chatga — Telegram WebView'da navigator.share YO'Q va
   *     `<a download>` blob jimgina ishlamaydi → bu YAGONA kafolatli yo'l
   *  3) shareUrl (matn) — oxirgi fallback */
  const handleShareImage = async () => {
    if (sharingImage) return
    haptics.selection()
    setSharingImage(true)
    try {
      const state = useAppStore.getState()
      const lang = state.settings.language
      const uid = state.user?.id ?? '0'
      const fullName = [state.user?.firstName, state.user?.lastName].filter(Boolean).join(' ')
      const subjectId = useSubjectStore.getState().subjectId
      const subject = SUBJECT_BASES.find((s) => s.id === subjectId)
      const subjectName = lang === 'ru' ? (subject?.nameRu ?? 'ПДД') : (subject?.name ?? 'YHQ')
      const shareText = buildResultShareText({ correct, total, percent, passed, streak: state.streak, lang })
      const link = `https://t.me/${config.botUsername}?start=ref_${uid}`

      const canvas = document.createElement('canvas')
      drawResultCard(canvas, {
        userName: fullName,
        subjectName,
        correct, wrong, unanswered, total, percent, passed,
        streak: state.streak,
        date: new Intl.DateTimeFormat(lang === 'ru' ? 'ru-RU' : 'uz-UZ', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date()),
        lang,
      })

      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
      const file = blob ? new File([blob], `kivvi-result-${percent}pct.png`, { type: 'image/png' }) : null

      // 1) Haqiqiy Web Share (brauzer va ba'zi WebView'larda)
      if (file && navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: 'KIVVI', text: `${shareText}\n${link}` })
          return
        } catch (err) {
          if ((err as Error).name === 'AbortError') return // user bekor qildi
          // boshqa xato — keyingi yo'lga tushamiz
        }
      }

      // 2) Bot orqali shaxsiy chatga (Telegram WebView'da kafolatli)
      try {
        const res = await api.sendShareImage({
          imageBase64: canvas.toDataURL('image/png'),
          caption:     `${shareText}\n${link}`,
          fileName:    `kivvi-result-${percent}pct.png`,
        })
        if (res.sentToTelegram) {
          playSound('win')
          haptics.success()
          setImageSentToBot(true)
          return
        }
      } catch (err) {
        console.warn('[share-image bot send]', err)
      }

      // 3) Oxirgi fallback — matn-share
      shareUrl(link, shareText)
    } catch (err) {
      console.warn('[share-image]', err)
    } finally {
      setSharingImage(false)
    }
  }

  // Konfetti darajalari (Senior UX Tiers): <80% yo'q, 80-94% 20 dona, 95-99% 35 dona, 100% 50 dona
  const confettiCount = percent === 100 ? 50 : percent >= 95 ? 35 : percent >= 80 ? 20 : 0

  // Natija ochildi — g'alaba fanfarasi + tangalar yomg'iri yoki xato tovush
  useEffect(() => {
    if (disqualifiedByCheat) {
      playSound('error')
      haptics.error()
    } else if (percent === 100) {
      playSound('win')
      haptics.achievement()
    } else if (passed) {
      playSound('win')
      haptics.success()
    } else {
      playSound('click')
      haptics.complete()
    }
  }, [disqualifiedByCheat, passed, percent])

  // Test yakunlanganda yangi erishilgan yutuqlarni tekshirib, tantana oynasini ochish
  useEffect(() => {
    if (disqualifiedByCheat) return
    const uid = useAppStore.getState().user?.id

    // Mehmon yoki lokal testda: agar 100% bo'lsa, 'perfectRun' nishoni tantanasini ko'rsatish
    if (!uid || uid === '0') {
      if (percent === 100 && total >= 1) {
        const timer = setTimeout(() => {
          const perfect = ACHIEVEMENTS.find((b) => b.id === 'perfectRun')
          if (perfect) {
            useAchievementCelebrationStore.getState().triggerCelebration(perfect)
          }
        }, 900)
        return () => clearTimeout(timer)
      }
      return
    }

    const timer = setTimeout(() => {
      invalidateAchievementsCache()
      fetchAchievements(uid)
        .then((stats) => {
          if (stats) {
            if (percent === 100) {
              const perfect = ACHIEVEMENTS.find((b) => b.id === 'perfectRun')
              if (perfect && !getCelebratedBadgeIds().has(perfect.id)) {
                useAchievementCelebrationStore.getState().triggerCelebration(perfect)
                markBadgesCelebrated([perfect.id])
              }
            }
            checkAndCelebrateAchievements(stats)
          }
        })
        .catch(() => {
          if (percent === 100) {
            const perfectBadge = ACHIEVEMENTS.find((b) => b.id === 'perfectRun')
            if (perfectBadge) {
              useAchievementCelebrationStore.getState().triggerCelebration(perfectBadge)
            }
          }
        })
    }, 850)
    return () => clearTimeout(timer)
  }, [disqualifiedByCheat, percent, total])

  return (
    <>
      {confettiCount > 0 && !hideVerdict && !disqualifiedByCheat && <Confetti count={confettiCount} />}
      <ModalShell
        title={tt('results')}
        onClose={onFinish}
        labelId="results-title"
        closeLabel={tt('closeResults')}
      >
        {disqualifiedByCheat && (
          <div className="mb-3 bg-pcard rounded-2xl p-3.5 text-center shadow-2xs relative z-10 ring-1 ring-[rgb(var(--p-danger-rgb)/0.4)]">
            <p className="text-sm font-semibold text-pdanger mb-1">
              {tt('antiCheatDisqualifiedTitle')}
            </p>
            <p className="text-xs text-psubtle">
              {tt('antiCheatDisqualifiedDesc')}
            </p>
          </div>
        )}

        {pending > 0 && (
          <div className="mb-3 bg-pcard rounded-2xl p-3.5 flex items-center gap-2.5 shadow-2xs relative z-10">
            <div className="size-2 rounded-full bg-pblue animate-ping flex-shrink-0" />
            <p className="text-xs text-pfg font-medium">
              {pending} {tt('pendingSyncNotice') || `${pending} ta javob oflayn saqlandi (internet ulanganda natija yangilanadi)`}
            </p>
          </div>
        )}

        <div className="mx-auto mb-1 size-36 sm:size-40">
          {hideVerdict && !disqualifiedByCheat ? (
            <BrilliantEndstateRive
              kind="recommended-level"
              variant={percent >= 80 ? 0 : percent >= 50 ? 1 : 4}
              dark={typeof document !== 'undefined' && document.body.dataset.theme === 'dark'}
              label="Brilliant Recommended Level Result"
              className="size-full"
            />
          ) : (
            <BrilliantEndstateRive
              kind="progress-endstate"
              progressTrigger={disqualifiedByCheat || !passed ? 'playPoor' : percent === 100 ? 'playMastered' : 'playPassed'}
              variant={disqualifiedByCheat || !passed ? 2 : percent === 100 ? 4 : 0}
              dark={typeof document !== 'undefined' && document.body.dataset.theme === 'dark'}
              label="Brilliant Progress Check Result"
              className="size-full"
            />
          )}
        </div>

        <DonutChart correct={correct} total={total} threshold={threshold} hideVerdict={hideVerdict || disqualifiedByCheat}
          passedLabel={tt('passed')} failedLabel={tt('failed')} />

        {/* Chek uslubidagi natija qatorlari (App Store "Transaction" tili) */}
        <SpecCard className="mb-4">
          <SpecList>
            <SpecRow tone="green" icon={<Check />} label={tt('correct')} value={correct} />
            <SpecRow tone="pink" icon={<X />} label={tt('wrong')} value={wrong} />
            <SpecRow tone="neutral" icon={<Minus />} label={tt('unanswered')} value={unanswered} />
            {earnedXp ? <SpecRow tone="primary" icon={<Sparkles />} label="XP" value={`+${earnedXp}`} /> : null}
            {earnedCoins ? (
              <SpecRow
                tone="gold"
                icon={<CoinIcon size={16} />}
                label={isRu ? 'Монеты' : 'Tangalar'}
                value={`+${earnedCoins}`}
              />
            ) : null}
            {passed && streak > 0 ? (
              <div
                role="button"
                tabIndex={0}
                onClick={() => {
                  haptics.impact('light')
                  setShowStreakModal(true)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    setShowStreakModal(true)
                  }
                }}
                className="cursor-pointer"
              >
                <SpecRow
                  tone="amber"
                  icon={<BrilliantStreakIcon size={16} className="text-[#A8D31D]" />}
                  label={isRu ? 'Серия дней (нажмите)' : 'Kunlik seriya (bosing)'}
                  value={`${streak} ${tt('daysWord')}`}
                />
              </div>
            ) : null}
          </SpecList>
        </SpecCard>

        {pending > 0 && !earnedXp && !earnedCoins ? (
          <p className="relative z-10 mb-3.5 text-center text-[11.5px] font-medium text-psubtle">
            ⏳ {isRu ? 'Награды будут начислены при подключении к сети' : 'Mukofotlar internet tiklangach hisoblanadi'}
          </p>
        ) : null}

        {/* Milliy sertifikat rasmiy baholash va DTM imtiyozi kartasi */}
        {isMilliySertifikat && dtmBenefit && (
          <div className="mb-4 bg-pcard rounded-2xl p-4 shadow-2xs relative z-10">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full bg-psurface text-pmuted">
                Milliy sertifikat
              </span>
              <span className="text-[12px] font-bold text-pfg tabular-nums">
                Maks. 75 ball
              </span>
            </div>

            {/* Daraja va ball banner */}
            <div
              className="rounded-2xl p-4 mb-3 flex items-center justify-between shadow-2xs"
              style={{
                backgroundColor: dtmBenefit.gradeMeta?.bg ?? 'rgba(239, 68, 68, 0.1)',
              }}
            >
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-pmuted">
                  {isRu ? 'Уровень' : 'Rasmiy daraja'}
                </span>
                <div
                  className="text-2xl font-black tracking-tight mt-0.5"
                  style={{ color: dtmBenefit.gradeMeta?.color ?? 'var(--p-danger)' }}
                >
                  {dtmBenefit.grade ? `${dtmBenefit.grade} daraja` : (isRu ? 'Сертификат не выдается' : 'Sertifikat berilmaydi')}
                </div>
                <p className="text-[12px] font-semibold text-pfg opacity-90 mt-1">
                  {isRu ? dtmBenefit.summaryRu : dtmBenefit.summaryUz}
                </p>
              </div>

              <div className="text-right shrink-0">
                <span className="text-[11px] font-bold uppercase tracking-wider text-pmuted">
                  {isRu ? 'Балл' : 'Ball'}
                </span>
                <div className="text-2xl font-black tabular-nums text-pfg">
                  {dtmBenefit.rashScore}
                  <span className="text-sm font-semibold text-pmuted">/75</span>
                </div>
                <span className="text-[11px] font-semibold text-pmuted">
                  {percent}% aniqlik
                </span>
              </div>
            </div>

            {/* DTM Imtiyozlari */}
            <div className="bg-psurface rounded-xl p-3 mb-2 shadow-2xs">
              <p className="text-[11.5px] font-bold text-pfg mb-2 flex items-center gap-1.5">
                <Landmark size={15} className="text-pprimary shrink-0" /> {isRu ? 'Льготы DTM:' : 'DTM kirish imtiyozi:'}
              </p>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-pcard rounded-lg p-2.5 shadow-2xs">
                  <p className="text-[10.5px] font-medium text-pmuted mb-0.5">
                    {isRu ? '1-й предмет' : '1-mutaxassislik'}
                  </p>
                  <p className="font-bold text-pfg tabular-nums text-[13px]">
                    {dtmBenefit.isPassed ? `${dtmBenefit.major1Score} / 93` : '0 ball'}
                  </p>
                  {dtmBenefit.isPassed && (
                    <p className="text-[10px] text-psuccess font-semibold mt-0.5">
                      {dtmBenefit.percentOfMax}% {isRu ? 'макс.' : 'maks.'}
                    </p>
                  )}
                </div>

                <div className="bg-pcard rounded-lg p-2.5 shadow-2xs">
                  <p className="text-[10.5px] font-medium text-pmuted mb-0.5">
                    {isRu ? '2-й предмет' : '2-mutaxassislik'}
                  </p>
                  <p className="font-bold text-pfg tabular-nums text-[13px]">
                    {dtmBenefit.isPassed ? `${dtmBenefit.major2Score} / 63` : '0 ball'}
                  </p>
                  {dtmBenefit.isPassed && (
                    <p className="text-[10px] text-psuccess font-semibold mt-0.5">
                      {dtmBenefit.percentOfMax}% {isRu ? 'макс.' : 'maks.'}
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-2.5 pt-2 flex items-center justify-between text-[11px]">
                <span className="text-pmuted">
                  {isRu ? 'Обязательный блок:' : 'Majburiy blok:'}
                </span>
                <span className={`font-bold ${dtmBenefit.isPassed ? 'text-psuccess' : 'text-pmuted'}`}>
                  {dtmBenefit.isPassed
                    ? (isRu ? '100% максимум' : '100% maksimal')
                    : (isRu ? '0 ball' : '0 ball')}
                </span>
              </div>
            </div>

            <p className="text-[10.5px] text-psubtle text-center mt-1">
              {isRu
                ? 'Срок действия — 3 года (Постановление № 646)'
                : 'Amal qilish muddati — 3 yil (646-son qaror)'}
            </p>
          </div>
        )}

        {/* Mavzular kesimida diagnostika — rasmiy imtihon presetlarida */}
        {topicBreakdown && topicBreakdown.length > 0 && (
          <div className="mb-4 bg-pcard rounded-2xl p-4 shadow-2xs relative z-10">
            <p className="text-[13px] font-bold text-pfg mb-2.5">{tt('topicBreakdownTitle')}</p>
            <div className="flex flex-col gap-2.5">
              {topicBreakdown.map((t) => {
                const color = t.pct >= 70 ? 'var(--p-success)' : t.pct >= 40 ? 'var(--p-warning)' : 'var(--p-danger)'
                return (
                  <div key={t.topicId ?? -1}>
                    <div className="flex items-baseline justify-between gap-2 mb-1">
                      <p className="text-[12px] font-semibold text-pfg truncate">{t.name}</p>
                      <p className="text-[11px] font-semibold text-pmuted flex-shrink-0 tabular-nums">
                        {t.correct}/{t.total} · {t.pct}%
                      </p>
                    </div>
                    <div className="h-1.5 rounded-full bg-psurface overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${t.pct}%`, background: color }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Savollar katakchalari (barcha savollar gridi — 10 ustunli ixcham va qulay tartib) */}
        <div className="grid grid-cols-10 gap-1.5 sm:gap-2 mb-4 max-h-52 overflow-y-auto overscroll-contain p-0.5 relative z-10">
          {results.map((r, i) => (
            <button
              key={r.questionId}
              onClick={() => onGoToQuestion(i)}
              aria-label={`${tt('question')} ${i + 1}, ${r.status === 'correct' ? tt('correct') : r.status === 'incorrect' ? tt('wrong') : r.status === 'pending' ? 'pending' : tt('unanswered')}`}
              className={`aspect-square rounded-full flex items-center justify-center text-[10.5px] sm:text-[11px] font-bold tabular-nums transition-all active:scale-90 shadow-2xs ${
                r.status === 'correct'   ? 'bg-pprimary text-ponprimary shadow-xs' :
                r.status === 'incorrect' ? 'bg-pdanger text-white shadow-xs'   :
                r.status === 'pending'   ? 'bg-pcard text-pblue ring-1 ring-[rgb(var(--p-blue-rgb)/0.5)]' :
                                           'bg-pcard text-pmuted hover:text-pfg'
              }`}
            >
              {i + 1}
            </button>
          ))}
        </div>

        {/* Sertifikat tugmasi (imtihon topshirilganda yoki yuqori natijada) */}
        {passed && !disqualifiedByCheat && (
          <Button
            type="button"
            variant="secondary"
            block
            size="lg"
            onClick={() => setShowCertificate(true)}
            className="mb-2.5 relative z-10"
          >
            <Award size={17} strokeWidth={1.75} />
            <span>{tt('viewCertificate')}</span>
          </Button>
        )}

        {/* Yutuq tantanasini ko'rish */}
        {!disqualifiedByCheat && (
          <Button
            type="button"
            variant="secondary"
            block
            onClick={() => {
              const badge = (percent === 100 ? ACHIEVEMENTS.find((b) => b.id === 'perfectRun') : null) || ACHIEVEMENTS[0]
              useAchievementCelebrationStore.getState().triggerCelebration(badge)
            }}
            className="mb-2.5 relative z-10"
          >
            <Sparkles size={16} className="text-pgold" />
            <span>{tt('achViewCelebration')}</span>
          </Button>
        )}

        {onOpenReview && (
          <Button
            type="button"
            variant="secondary"
            block
            size="lg"
            onClick={onOpenReview}
            className="mb-2.5 relative z-10"
          >
            <BookOpen size={16} strokeWidth={1.75} />
            <span>{wrong > 0 ? `${tt('examReviewBtn')} (${wrong})` : tt('examReviewBtn')}</span>
          </Button>
        )}

        <div className="flex gap-2.5 mb-2.5 relative z-10">
          <Button
            type="button"
            variant="secondary"
            onClick={onRetry}
            className="flex-1 h-12"
          >
            <RotateCcw size={15} strokeWidth={2} aria-hidden="true" />
            <span>{tt('retry')}</span>
          </Button>
          <Button
            type="button"
            onClick={onFinish}
            className="flex-[2] h-12"
          >
            <span>{tt('finish')}</span>
          </Button>
        </div>

        {/* Natijani RASM qilib ulashish (#48) — Web Share → bot chat → matn fallback */}
        <div className="flex flex-col gap-2 relative z-10">
          <Button
            type="button"
            variant="secondary"
            block
            disabled={sharingImage}
            loading={sharingImage}
            onClick={handleShareImage}
          >
            <ImageDown size={15} strokeWidth={1.75} />
            <span>{tt('shareResultImage')}</span>
          </Button>
          {imageSentToBot && (
            <p className="text-center text-[11.5px] font-semibold text-pprimary animate-fadeIn">
              {tt('shareResultImageSent')}
            </p>
          )}

          {/* Matn + referal link bilan ulashish */}
          <Button
            type="button"
            variant="secondary"
            block
            onClick={() => {
              const uid  = useAppStore.getState().user?.id
              const lang = useAppStore.getState().settings.language
              const streak = useAppStore.getState().streak
              const text = buildResultShareText({ correct, total, percent, passed, streak, lang })
              shareUrl(`https://t.me/${config.botUsername}?start=ref_${uid ?? '0'}`, text)
            }}
          >
            <Share2 size={15} strokeWidth={1.75} />
            <span>{tt('shareResult')}</span>
          </Button>
        </div>

        {showStreakModal && streak > 0 && (
        <BrilliantStreakModal
          streak={streak}
          onClose={() => setShowStreakModal(false)}
        />
      )}

      {showCertificate && (
          <CertificateModal
            score={correct}
            total={total}
            percent={percent}
            grade={dtmBenefit?.grade ?? undefined}
            rashScore={dtmBenefit?.rashScore ?? undefined}
            onClose={() => setShowCertificate(false)}
          />
        )}
      </ModalShell>
    </>
  )
}
