import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { ShieldCheck, Zap, CalendarCheck2, Sparkles } from 'lucide-react'
import { Button } from './ui/button'
import ModalShell from './ModalShell'
import {
  BrilliantEndstateRive,
  type BrilliantLessonTrigger,
  type BrilliantProgressTrigger,
} from './BrilliantEndstateRive'
import { BrilliantStreakIcon } from './BrilliantStreakIcon'
import { playSound } from '../lib/sounds'
import { haptics } from '../../platform/haptics'
import { useAppStore } from '../store/useAppStore'

export interface BrilliantStreakModalProps {
  streak: number
  onClose: () => void
  isOpen?: boolean
  /** 'charge' — batareya ekrani, 'lesson' — Lesson Complete, 'progress' — Progress Check (Intro & Endstate) */
  initialView?: 'streak' | 'charge' | 'lesson' | 'progress'
  /** `true` bo'lsa, seriya ekranidan so'ng "Davom etish" bosilganda Streak Charge ekraniga o'tadi */
  showCharge?: boolean
  /** Lesson Complete rejimi uchun XP qiymati */
  xpEarned?: number
}

const SHORT_DAYS_UZ = ['Ya', 'Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh']
const SHORT_DAYS_RU = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб']
const LIME = '#A8D31D'

type LessonPresetId = 'lesson-check' | 'level-gem' | 'skill-mastered' | 'lesson-fail'

const LESSON_PRESETS: {
  id: LessonPresetId
  trigger: BrilliantLessonTrigger
  isLevel: boolean
  skillCheckMastered: boolean
  uz: string
  ru: string
}[] = [
  { id: 'lesson-check',   trigger: 'kojiFlip', isLevel: false, skillCheckMastered: false, uz: '✅ Dars (Tanga)',   ru: '✅ Урок (Диск)' },
  { id: 'level-gem',      trigger: 'kojiGem',  isLevel: true,  skillCheckMastered: false, uz: '💎 Daraja (Olmos)', ru: '💎 Уровень (Кристалл)' },
  { id: 'skill-mastered', trigger: 'koji360',  isLevel: true,  skillCheckMastered: true,  uz: '🏅 Mahorat (Oltin)', ru: '🏅 Мастер (Золото)' },
  { id: 'lesson-fail',    trigger: 'kojiFail', isLevel: false, skillCheckMastered: false, uz: '🔄 Yiqildi',        ru: '🔄 Не сдал' },
]

type ProgressMode = 'intro' | BrilliantProgressTrigger

const PROGRESS_MODES: { id: ProgressMode; uz: string; ru: string }[] = [
  { id: 'intro',        uz: '🚀 Kirish (Intro)', ru: '🚀 Старт (Intro)' },
  { id: 'playMastered', uz: '🏆 100% A’lo',      ru: '🏆 100% Мастер' },
  { id: 'playPassed',   uz: '✅ O‘tdi',          ru: '✅ Пройден' },
  { id: 'playPoor',     uz: '🔄 Qayta urinish',  ru: '🔄 Повторить' },
]

const PROGRESS_COLORS: { id: number; hex: string; label: string }[] = [
  { id: 0, hex: '#28A745', label: 'Green' },
  { id: 1, hex: '#3557FF', label: 'Blue' },
  { id: 4, hex: '#F5B301', label: 'Yellow' },
  { id: 3, hex: '#FF7A00', label: 'Orange' },
  { id: 5, hex: '#8B5CF6', label: 'Purple' },
  { id: 2, hex: '#EF4444', label: 'Red' },
]

export const BrilliantStreakModal = memo(function BrilliantStreakModal({
  streak,
  onClose,
  isOpen = true,
  initialView = 'streak',
  showCharge = false,
  xpEarned = 20,
}: BrilliantStreakModalProps) {
  const language = useAppStore((s) => s.settings.language)
  const isRu = language === 'ru'
  const dark = typeof document !== 'undefined' && document.body.dataset.theme === 'dark'

  const [view, setView] = useState<'streak' | 'charge' | 'lesson' | 'progress'>(initialView)
  const [riveNonce, setRiveNonce] = useState(0)
  const [lessonPreset, setLessonPreset] = useState<LessonPresetId>('lesson-check')
  const [progressMode, setProgressMode] = useState<ProgressMode>('playMastered')
  const [progressColor, setProgressColor] = useState<number>(0)
  // Streak stage: 0 — animatsiya, 1 — `0` ko'rinadi, 2 — son + gradient, 3 — sarlavha, 4 — kalendar
  const [stage, setStage] = useState(0)
  // Charge / Lesson / Progress stage: 0 — Rive kirishi, 1 — matnlar, 2 — portlash / XP
  const [chargeStage, setChargeStage] = useState(0)
  const [showChargeInfo, setShowChargeInfo] = useState(false)

  useEffect(() => {
    setView(initialView)
  }, [initialView])

  useEffect(() => {
    if (!isOpen) return
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

    if (view === 'streak') {
      setStage(reduce ? 4 : 0)
      playSound('win')
      haptics.impact('heavy')
      if (reduce) return
      const timers = [
        window.setTimeout(() => setStage(1), 900),
        window.setTimeout(() => setStage(2), 3000),
        window.setTimeout(() => setStage(3), 3400),
        window.setTimeout(() => setStage(4), 3900),
      ]
      return () => timers.forEach(window.clearTimeout)
    }

    // view === 'charge' | 'lesson' | 'progress'
    setChargeStage(reduce ? 2 : 0)
    haptics.impact('light')
    if (reduce) {
      playSound('win')
      return
    }
    const timers = [
      window.setTimeout(() => setChargeStage(1), 350),
      window.setTimeout(() => {
        setChargeStage(2)
        playSound(view === 'progress' && progressMode === 'playPoor' ? 'error' : 'win')
        haptics.impact('heavy')
      }, 850),
    ]
    return () => timers.forEach(window.clearTimeout)
  }, [isOpen, view, riveNonce, progressMode])

  const handleRiveEvent = useCallback((eventName: string) => {
    if (
      eventName === 'play-streak-charge-sound' ||
      eventName === 'play-streak-sound' ||
      eventName === 'reveal_xp' ||
      eventName === 'reveal_title'
    ) {
      haptics.impact('medium')
    }
  }, [])

  const days = useMemo(() => {
    const names = isRu ? SHORT_DAYS_RU : SHORT_DAYS_UZ
    const today = new Date().getDay()
    return [0, 1, 2].map((offset) => ({ name: names[(today + offset) % 7], active: offset === 0 }))
  }, [isRu])

  if (!isOpen) return null

  const title = streak <= 1
    ? (isRu ? 'Вы начали новую серию!' : 'Yangi seriyani boshladingiz!')
    : (isRu ? `Серия ${streak} дн.!` : `${streak} kunlik seriya!`)

  const fade = (on: boolean) => ({
    opacity: on ? 1 : 0,
    transform: on ? 'translateY(0)' : 'translateY(10px)',
    transition: 'opacity 420ms ease-out, transform 420ms cubic-bezier(0.16,1,0.3,1)',
  })

  const gradient = dark
    ? 'linear-gradient(180deg, rgba(120,150,20,0.45) 0%, rgba(120,150,20,0.14) 38%, rgba(20,20,20,0) 62%)'
    : 'linear-gradient(180deg, rgba(190,216,48,0.62) 0%, rgba(190,216,48,0.22) 38%, rgba(255,255,255,0) 62%)'

  const handleContinue = () => {
    haptics.impact('light')
    if (view === 'streak' && showCharge) {
      setView('charge')
      setRiveNonce((n) => n + 1)
      return
    }
    onClose()
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="streak-celebration-title"
      className="fixed inset-0 z-[100] flex flex-col bg-pcanvas text-pfg select-none overflow-hidden"
    >
      {view === 'streak' && (
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-[70%]"
          style={{ background: gradient, opacity: stage >= 2 ? 1 : 0, transition: 'opacity 900ms ease-out' }}
          aria-hidden="true"
        />
      )}

      <div className="relative z-10 flex flex-1 flex-col items-center px-6 pt-[calc(var(--safe-top,0px)+1rem)] min-h-0">
        {view === 'streak' ? (
          <>
            <BrilliantEndstateRive
              key={`streak-${riveNonce}`}
              kind="streak"
              variant={0}
              dark={dark}
              nonce={riveNonce}
              onRiveEvent={handleRiveEvent}
              label="Brilliant Streak Celebration"
              className="mt-[6vh] aspect-square w-full max-w-[340px] shrink-0"
              fallback={<BrilliantStreakIcon size={96} />}
            />

            <h1
              id="streak-celebration-title"
              className="mt-2 font-display text-[64px] font-black leading-none tabular-nums"
              style={{
                color: stage >= 2 ? undefined : LIME,
                transform: stage >= 2 ? 'scale(1)' : 'scale(0.85)',
                opacity: stage >= 1 ? 1 : 0,
                transition: 'transform 500ms cubic-bezier(0.34,1.56,0.64,1), color 300ms',
              }}
            >
              {stage >= 2 ? streak : 0}
            </h1>

            <p className="mt-2 text-[17px] font-extrabold tracking-tight text-center" style={fade(stage >= 3)}>
              {title}
            </p>

            <div className="mt-6 flex items-start justify-center gap-6" style={fade(stage >= 4)}>
              {days.map((d) => (
                <div key={d.name} className="flex flex-col items-center gap-1.5">
                  <div
                    className={`grid size-10 place-items-center rounded-full ${
                      d.active ? '' : 'border-2 border-pline bg-pcard'
                    }`}
                    style={d.active ? { background: LIME } : undefined}
                  >
                    {d.active && <BrilliantStreakIcon size={18} className="text-black" />}
                  </div>
                  <span className={`text-[12px] font-bold ${d.active ? 'text-pfg' : 'text-pmuted'}`}>{d.name}</span>
                </div>
              ))}
            </div>
          </>
        ) : view === 'charge' ? (
          <>
            {/* 08_brilliant-streak-charge-animation.mp4: Markaziy 3D Batareya Rive sahnasi */}
            <BrilliantEndstateRive
              key={`charge-${riveNonce}`}
              kind="charge"
              dark={dark}
              nonce={riveNonce}
              onRiveEvent={handleRiveEvent}
              label="Brilliant Streak Charge"
              className="mt-[11vh] aspect-square w-full max-w-[270px] sm:max-w-[300px] shrink-0"
              fallback={<BrilliantStreakIcon size={96} />}
            />

            <div className="mt-3 flex flex-col items-center text-center" style={fade(chargeStage >= 1)}>
              <h1
                id="streak-celebration-title"
                className="font-display text-[22px] sm:text-[24px] font-extrabold leading-snug tracking-tight text-pfg"
              >
                {isRu ? 'Вы получили 1 заряд серии!' : '1 ta Seriya zaryadini oldingiz!'}
              </h1>

              <p className="mt-2.5 max-w-[300px] text-[14px] font-medium leading-[1.45] text-pmuted">
                {isRu
                  ? 'С зарядом серии вы можете пропустить день обучения, не потеряв свою серию.'
                  : 'Seriya zaryadi bilan bir kunlik mashg‘ulotni o‘tkazib yuborsangiz ham seriyangiz yo‘qolmaydi.'}
              </p>

              <button
                type="button"
                onClick={() => {
                  haptics.selection()
                  setShowChargeInfo(true)
                }}
                className="mt-4 text-[13px] font-semibold text-pmuted underline underline-offset-4 hover:text-pfg transition-colors cursor-pointer"
              >
                {isRu ? 'Что такое заряд серии?' : 'Seriya zaryadi nima?'}
              </button>
            </div>
          </>
        ) : view === 'lesson' ? (
          <>
            {(() => {
              const activePreset = LESSON_PRESETS.find((p) => p.id === lessonPreset) ?? LESSON_PRESETS[0]
              return (
                <>
                  {/* Brilliant MAIN_lesson-endstate (LessonEndstateVM) + MAIN_xp-starburst */}
                  <BrilliantEndstateRive
                    key={`lesson-${activePreset.id}-${progressColor}-${riveNonce}`}
                    kind="lesson"
                    lessonTrigger={activePreset.trigger}
                    isLevel={activePreset.isLevel}
                    levelNumber={progressColor + 1}
                    skillCheckMastered={activePreset.skillCheckMastered}
                    variant={progressColor}
                    dark={dark}
                    nonce={riveNonce}
                    onRiveEvent={handleRiveEvent}
                    label="Brilliant Lesson Complete"
                    className="mt-[4vh] aspect-square w-full max-w-[290px] sm:max-w-[320px] shrink-0"
                    fallback={<Sparkles size={72} className="text-pprimary" />}
                  />

                  <div className="mt-1 flex flex-col items-center text-center" style={fade(chargeStage >= 1)}>
                    <h1
                      id="streak-celebration-title"
                      className="font-display text-[25px] sm:text-[27px] font-extrabold leading-tight tracking-tight text-pfg"
                    >
                      {activePreset.id === 'lesson-fail'
                        ? isRu ? 'Урок не пройден' : 'Dars yakunlanmadi'
                        : activePreset.id === 'level-gem'
                          ? isRu ? `Уровень ${progressColor + 1} пройден!` : `${progressColor + 1}-daraja yakunlandi!`
                          : activePreset.id === 'skill-mastered'
                            ? isRu ? 'Мастерство подтверждено!' : 'Mahorat tasdiqlandi!'
                            : isRu ? 'Урок пройден!' : 'Dars yakunlandi!'}
                    </h1>

                    <p className="mt-1.5 max-w-[300px] text-[13.5px] font-medium leading-[1.45] text-pmuted">
                      {isRu
                        ? 'Отличная работа! Вы освоили новый материал и приблизились к цели.'
                        : 'Ajoyib natija! Siz yangi mavzuni o‘zlashtirdingiz va maqsadga yaqinlashdingiz.'}
                    </p>

                    {/* XP Starburst + Mukofot kapsulasi */}
                    <div className="relative mt-3.5 flex items-center justify-center">
                      <BrilliantEndstateRive
                        key={`xp-${riveNonce}`}
                        kind="xp"
                        dark={dark}
                        nonce={riveNonce}
                        label="XP Starburst"
                        className="pointer-events-none absolute -inset-8 size-28"
                      />
                      <div className="relative z-10 inline-flex items-center gap-2 rounded-2xl bg-psurface px-5 py-2 shadow-xs">
                        <Sparkles size={18} className="text-[#A8D31D]" />
                        <span className="font-display text-[19px] font-extrabold tabular-nums text-pfg">
                          +{xpEarned} XP
                        </span>
                      </div>
                    </div>

                    {/* MAIN_lesson-endstate 4 ta vizual holati */}
                    <div className="mt-3.5 flex flex-wrap items-center justify-center gap-1.5">
                      {LESSON_PRESETS.map((p) => {
                        const active = lessonPreset === p.id
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => {
                              haptics.selection()
                              setLessonPreset(p.id)
                              setRiveNonce((n) => n + 1)
                            }}
                            className={`rounded-full px-3 py-1 text-[11.5px] font-bold transition-all cursor-pointer active:scale-95 ${
                              active
                                ? 'bg-pfg text-pcanvas shadow-xs'
                                : 'bg-psurface text-pmuted hover:text-pfg'
                            }`}
                          >
                            {isRu ? p.ru : p.uz}
                          </button>
                        )
                      })}
                    </div>

                    {/* 6 xil Brilliant mavzu ranglari */}
                    <div className="mt-3 flex items-center justify-center gap-2">
                      {PROGRESS_COLORS.map((c) => {
                        const active = progressColor === c.id
                        return (
                          <button
                            key={c.id}
                            type="button"
                            aria-label={c.label}
                            onClick={() => {
                              haptics.selection()
                              setProgressColor(c.id)
                              setRiveNonce((n) => n + 1)
                            }}
                            className={`size-6 rounded-full transition-transform cursor-pointer ${
                              active ? 'scale-125 ring-2 ring-pfg ring-offset-2 ring-offset-pcanvas' : 'opacity-75 hover:opacity-100'
                            }`}
                            style={{ backgroundColor: c.hex }}
                          />
                        )
                      })}
                    </div>
                  </div>
                </>
              )
            })()}
          </>
        ) : (
          <>
            {/* progress-check.ae37b864.riv: MAIN_ProgressCheckIntro va MAIN_ProgressCheckEndstate */}
            <BrilliantEndstateRive
              key={`progress-${progressMode}-${progressColor}-${riveNonce}`}
              kind={progressMode === 'intro' ? 'progress-intro' : 'progress-endstate'}
              progressTrigger={progressMode === 'intro' ? 'playMastered' : progressMode}
              variant={progressColor}
              dark={dark}
              nonce={riveNonce}
              onRiveEvent={handleRiveEvent}
              label="Brilliant Progress Check"
              className="mt-[5vh] aspect-square w-full max-w-[290px] sm:max-w-[320px] shrink-0"
              fallback={<ShieldCheck size={72} className="text-pprimary" />}
            />

            <div className="mt-1 flex flex-col items-center text-center" style={fade(chargeStage >= 1)}>
              <h1
                id="streak-celebration-title"
                className="font-display text-[25px] sm:text-[27px] font-extrabold leading-tight tracking-tight text-pfg"
              >
                {progressMode === 'intro'
                  ? isRu ? 'Проверка уровня' : 'Bosqich imtihoni'
                  : progressMode === 'playMastered'
                    ? isRu ? 'Безупречный результат!' : 'Mukammal natija (100%)!'
                    : progressMode === 'playPassed'
                      ? isRu ? 'Испытание пройдено!' : 'Sinov muvaffaqiyatli o‘tildi!'
                      : isRu ? 'Попробуйте ещё раз' : 'Yana bir bor urinib ko‘ring'}
              </h1>

              <p className="mt-1.5 max-w-[310px] text-[13.5px] font-medium leading-[1.45] text-pmuted">
                {progressMode === 'intro'
                  ? isRu
                    ? 'Проверьте свои знания по ключевым вопросам и подтвердите мастерство.'
                    : 'Asosiy savollar bo‘yicha bilimingizni sinovdan o‘tkazing va mahoratingizni tasdiqlang.'
                  : progressMode === 'playPoor'
                    ? isRu
                      ? 'Повторите ошибки и попробуйте пройти проверку снова.'
                      : 'Xatolarni ko‘rib chiqing va sinovni qayta topshiring.'
                    : isRu
                      ? 'Вы успешно подтвердили свои знания на этом этапе!'
                      : 'Siz ushbu bosqichdagi bilimingizni a’lo darajada tasdiqladingiz!'}
              </p>

              {/* Progress Check holatlari (Intro / Mastered / Passed / Poor) */}
              <div className="mt-4 flex flex-wrap items-center justify-center gap-1.5">
                {PROGRESS_MODES.map((m) => {
                  const active = progressMode === m.id
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        haptics.selection()
                        setProgressMode(m.id)
                        setRiveNonce((n) => n + 1)
                      }}
                      className={`rounded-full px-3 py-1 text-[11.5px] font-bold transition-all cursor-pointer active:scale-95 ${
                        active
                          ? 'bg-pfg text-pcanvas shadow-xs'
                          : 'bg-psurface text-pmuted hover:text-pfg'
                      }`}
                    >
                      {isRu ? m.ru : m.uz}
                    </button>
                  )
                })}
              </div>

              {/* 6 xil Brilliant mavzu ranglari */}
              <div className="mt-3 flex items-center justify-center gap-2">
                {PROGRESS_COLORS.map((c) => {
                  const active = progressColor === c.id
                  return (
                    <button
                      key={c.id}
                      type="button"
                      aria-label={c.label}
                      onClick={() => {
                        haptics.selection()
                        setProgressColor(c.id)
                        setRiveNonce((n) => n + 1)
                      }}
                      className={`size-6 rounded-full transition-transform cursor-pointer ${
                        active ? 'scale-125 ring-2 ring-pfg ring-offset-2 ring-offset-pcanvas' : 'opacity-75 hover:opacity-100'
                      }`}
                      style={{ backgroundColor: c.hex }}
                    />
                  )
                })}
              </div>
            </div>
          </>
        )}
      </div>

      <div
        className="relative z-10 w-full max-w-[420px] mx-auto px-5 pt-3 pb-[calc(1rem+var(--safe-bottom,0px))]"
        style={view !== 'streak' ? fade(chargeStage >= 1) : undefined}
      >
        <Button variant="secondary" size="lg" block onClick={handleContinue} className="rounded-full font-extrabold">
          {isRu ? 'Продолжить' : 'Davom etish'}
        </Button>
      </div>

      {/* "What are Streak Charges?" / "Seriya zaryadi nima?" tushuntirish oynasi */}
      {showChargeInfo && (
        <ModalShell
          title={isRu ? 'Что такое заряд серии?' : 'Seriya zaryadi nima?'}
          onClose={() => setShowChargeInfo(false)}
          closeLabel={isRu ? 'Закрыть' : 'Yopish'}
          zIndex={110}
          footer={
            <Button
              type="button"
              variant="secondary"
              block
              onClick={() => setShowChargeInfo(false)}
            >
              {isRu ? 'Понятно' : 'Tushunarli'}
            </Button>
          }
        >
          <div className="space-y-2.5">
            {[
              {
                icon: ShieldCheck,
                color: 'text-psuccess',
                bg: 'bg-[rgb(var(--p-success-rgb)/0.12)]',
                title: isRu ? 'Автоматическая защита' : 'Avtomatik himoya',
                desc: isRu
                  ? 'Если вы пропустите один день занятий, заряд серии сработает автоматически и сохранит вашу текущую серию.'
                  : 'Agar biror kun mashg‘ulotni o‘tkazib yuborsangiz, seriya zaryadi avtomatik ishga tushadi va seriyangizni saqlab qoladi.',
              },
              {
                icon: Zap,
                color: 'text-pwarning',
                bg: 'bg-[rgb(var(--p-warning-rgb)/0.12)]',
                title: isRu ? 'Как получить заряд' : 'Qanday qo‘lga kiritiladi',
                desc: isRu
                  ? 'Заряды серии выдаются за стабильное выполнение ежедневных целей и достижение новых рубежей.'
                  : 'Seriya zaryadlari kunlik maqsadlarni muntazam bajarish va yangi seriya bosqichlariga yetganda beriladi.',
              },
              {
                icon: CalendarCheck2,
                color: 'text-pprimary',
                bg: 'bg-[rgb(var(--p-primary-rgb)/0.12)]',
                title: isRu ? 'Запас до 2 зарядов' : '2 tagacha zaryad zaxirasi',
                desc: isRu
                  ? 'Одновременно может храниться до 2 активных зарядов серии.'
                  : 'Bir vaqtning o‘zida 2 tagacha faol seriya zaryadini zaxirada saqlash mumkin.',
              },
            ].map((item) => {
              const Icon = item.icon
              return (
                <div key={item.title} className="flex items-start gap-3 rounded-2xl bg-psurface p-3.5">
                  <div className={`grid size-9 shrink-0 place-items-center rounded-xl ${item.bg} ${item.color}`}>
                    <Icon size={18} strokeWidth={2} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] font-bold text-pfg leading-snug">{item.title}</p>
                    <p className="text-[12.5px] text-pmuted leading-relaxed mt-0.5">{item.desc}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </ModalShell>
      )}
    </div>
  )
})

export default BrilliantStreakModal
