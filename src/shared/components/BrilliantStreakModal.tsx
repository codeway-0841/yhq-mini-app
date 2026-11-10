import { memo, useCallback, useEffect, useState } from 'react'
import { ShieldCheck, Zap, CalendarCheck2, Sparkles } from 'lucide-react'
import { Button } from './ui/button'
import ModalShell from './ModalShell'
import {
  BrilliantEndstateRive,
  type BrilliantLessonTrigger,
  type BrilliantProgressTrigger,
} from './BrilliantEndstateRive'
import { BrilliantExtrasRive } from './BrilliantExtrasRive'
import { BrilliantEndstateShell } from './BrilliantEndstateShell'
import {
  BrilliantChargeStage,
  BrilliantCompletionStage,
  BrilliantStreakStage,
} from './BrilliantCompletionContent'
import { playSound } from '../lib/sounds'
import { haptics } from '../../platform/haptics'
import { useAppStore } from '../store/useAppStore'

export interface BrilliantStreakModalProps {
  streak: number
  onClose: () => void
  isOpen?: boolean
  /** 'charge' — batareya ekrani, 'lesson' — Lesson Complete, 'progress' — Progress Check, 'rate' — Barcha maxsus sahnalar */
  initialView?: 'streak' | 'charge' | 'lesson' | 'progress' | 'rate'
  /** `true` bo'lsa, seriya ekranidan so'ng "Davom etish" bosilganda Streak Charge ekraniga o'tadi */
  showCharge?: boolean
  /** Joriy seriya zaryadlari soni (0..2) */
  charges?: number
  /** Kun o'tkazilganda zaryad avtomatik sarflanib seriyani saqladimi */
  chargeSaved?: boolean
  /** Yangi zaryad (+1) shu sessiyada qo'lga kiritildimi */
  chargeEarned?: boolean
  /** Preview rejimida tepada barcha bo'limlar orasida o'tish tablari chiqadi */
  showPreviewTabs?: boolean
  /** Lesson Complete rejimi uchun XP qiymati */
  xpEarned?: number
}

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

type RatePresetId =
  | 'rate-app'
  | 'premium-lock'
  | 'recommended-level'
  | 'post-checkout'
  | 'review-mistakes'
  | 'review-complete'
  | 'practice-nudge'
  | 'assessment-intro'
  | 'warm-up'
  | 'level-insertion'
  | 'lcr-transition'
  | 'koji-entrance'
  | 'league'
  | 'icp-node'
  | 'lightning-bolt'
  | 'ondemand-node'

const PREVIEW_TABS: { id: 'streak' | 'charge' | 'lesson' | 'progress' | 'rate'; uz: string; ru: string }[] = [
  { id: 'streak',   uz: 'Seriya',   ru: 'Серия' },
  { id: 'charge',   uz: 'Zaryad',   ru: 'Заряд' },
  { id: 'lesson',   uz: 'Dars',     ru: 'Урок' },
  { id: 'progress', uz: 'Imtihon',  ru: 'Экзамен' },
  { id: 'rate',     uz: 'Barchasi', ru: 'Все' },
]

const RATE_PRESETS: {
  id: RatePresetId
  uz: string
  ru: string
  uzTitle: string
  ruTitle: string
  uzDesc: string
  ruDesc: string
  engine: 'endstate' | 'extras'
  hasColor?: boolean
}[] = [
  { id: 'rate-app',          uz: '⭐ Baholash',      ru: '⭐ Оценка',      uzTitle: 'Ilova sizga yoqyaptimi?',       ruTitle: 'Нравится приложение?',        uzDesc: 'Sizning 5 yulduzli bahoingiz platformani har kuni yanada yaxshilashga yordam beradi.', ruDesc: 'Ваша оценка 5 звёзд помогает нам развивать платформу каждый день.', engine: 'endstate' },
  { id: 'premium-lock',      uz: '🔒 Premium qulf',  ru: '🔒 Замок',       uzTitle: 'To‘liq imkoniyatlarni oching',   ruTitle: 'Откройте полный доступ',      uzDesc: 'Premium obuna bilan barcha cheklovlarni olib tashlang va tezroq o‘rganing.',         ruDesc: 'Снимите все ограничения с подпиской Premium и учитесь быстрее.', engine: 'endstate' },
  { id: 'recommended-level', uz: '💎 Daraja',        ru: '💎 Уровень',     uzTitle: 'Tavsiya etilgan daraja!',       ruTitle: 'Рекомендуемый уровень!',      uzDesc: 'Biz siz uchun eng mos qiyinlik darajasini aniqladik.',                              ruDesc: 'Мы подобрали оптимальный уровень сложности специально для вас.', engine: 'endstate', hasColor: true },
  { id: 'post-checkout',     uz: '🎉 Obuna',         ru: '🎉 Покупка',     uzTitle: 'Premium faollashdi!',           ruTitle: 'Premium активирован!',        uzDesc: 'Endi barcha kurslar, AI-tutor va mashqlar cheklovsiz ochiq.',                      ruDesc: 'Теперь все курсы, ИИ-тьютор и тренажёры доступны без ограничений.', engine: 'endstate' },
  { id: 'review-mistakes',   uz: '🛠️ Xatolar',       ru: '🛠️ Ошибки',      uzTitle: 'Xatolarni tahlil qilamiz!',     ruTitle: 'Разберём ошибки!',            uzDesc: 'Qiyin savollarni qayta ko‘rib chiqish bilimingizni mustahkamlaydi.',                 ruDesc: 'Повторный разбор сложных вопросов закрепляет ваши знания.', engine: 'endstate', hasColor: true },
  { id: 'review-complete',   uz: '✨ Toza natija',   ru: '✨ Без ошибок',  uzTitle: 'Barcha xatolar tozalandi!',     ruTitle: 'Все ошибки исправлены!',      uzDesc: 'Siz barcha murakkab savollarni muvaffaqiyatli yechib chiqdingiz.',                  ruDesc: 'Вы успешно проработали все сложные вопросы.', engine: 'endstate', hasColor: true },
  { id: 'practice-nudge',    uz: '🏋️ Mashq',         ru: '🏋️ Тренировка',  uzTitle: 'Shaxsiy mashq vaqti!',          ruTitle: 'Время личной практики!',      uzDesc: 'Koji siz uchun zaif mavzular bo‘yicha maxsus mashq tayyorladi.',                     ruDesc: 'Коджи подготовил персональную подборку для закрепления слабых тем.', engine: 'extras' },
  { id: 'assessment-intro',  uz: '🧭 Diagnostika',   ru: '🧭 Диагностика', uzTitle: 'Bilim darajasini tekshirish',   ruTitle: 'Оценка уровня знаний',        uzDesc: 'Qisqa sinov orqali hozirgi darajangizni aniq belgilab oling.',                       ruDesc: 'Определите свой текущий уровень с помощью короткой проверки.', engine: 'endstate', hasColor: true },
  { id: 'warm-up',           uz: '🔥 Qizib olish',   ru: '🔥 Разминка',    uzTitle: 'Mashg‘ulotdan oldingi razminka', ruTitle: 'Быстрая разминка перед тестом', uzDesc: 'Asosiy imtihon oldidan tez va yengil savollar bilan tayyorlaning.',                ruDesc: 'Подготовьтесь к основному тесту на лёгких вопросах.', engine: 'endstate', hasColor: true },
  { id: 'level-insertion',   uz: '🚀 Yangi bob',     ru: '🚀 Новый блок',  uzTitle: 'Yangi bosqich ochildi!',        ruTitle: 'Открыт новый уровень!',       uzDesc: 'Keyingi bobdagi barcha darslar va mashqlar endi siz uchun tayyor.',                 ruDesc: 'Все уроки и задания следующего уровня готовы для прохождения.', engine: 'endstate', hasColor: true },
  { id: 'lcr-transition',    uz: '🔄 O‘tish',        ru: '🔄 Переход',     uzTitle: 'Keyingi bosqichga o‘tish',      ruTitle: 'Переход к проверке',          uzDesc: 'O‘zlashtirilgan bilimlarni amaliy mashqda sinab ko‘ramiz.',                         ruDesc: 'Закрепим изученный материал на практическом задании.', engine: 'endstate' },
  { id: 'koji-entrance',     uz: '🤖 Koji kirish',   ru: '🤖 Приветствие', uzTitle: 'KIVVI bilan o‘rganing!',        ruTitle: 'Учитесь вместе с KIVVI!',     uzDesc: 'Har kunlik interaktiv darslar, sun’iy intellekt va aqlli takrorlash.',               ruDesc: 'Ежедневные интерактивные уроки, ИИ-тьютор и умное повторение.', engine: 'endstate' },
  { id: 'league',            uz: '🏆 Liga',          ru: '🏆 Лига',        uzTitle: 'Haftalik Liga',                 ruTitle: 'Еженедельная лига',           uzDesc: 'Haftalik jadvalda yuqori ligalarga ko‘tariling!',                                   ruDesc: 'Поднимайтесь выше в еженельной таблице лидеров!', engine: 'extras', hasColor: true },
  { id: 'icp-node',          uz: '👋 Davom tuguni',  ru: '👋 Узел курса',  uzTitle: 'Darsni davom ettiring!',        ruTitle: 'Продолжите курс!',            uzDesc: 'To‘xtagan joyingizdan interaktiv bosqichlarni davom ettiring.',                     ruDesc: 'Продолжите обучение с места, где остановились.', engine: 'endstate', hasColor: true },
  { id: 'lightning-bolt',    uz: '⚡ Chaqmoq',       ru: '⚡ Молния',      uzTitle: 'Seriya quvvati!',               ruTitle: 'Энергия серии!',              uzDesc: 'Kunlik faolligingizning jonli chaqmoq animatsiyasi.',                                ruDesc: 'Живой разряд вашей ежедневной активности.', engine: 'endstate' },
  { id: 'ondemand-node',     uz: '⭕ Tugun',         ru: '⭕ Узел',        uzTitle: 'Topshiriq tuguni bajarildi!',   ruTitle: 'Узел задания пройден!',       uzDesc: 'Kurs xaritasidagi har bir bosqich uchun Brilliant tugun animatsiyasi.',             ruDesc: 'Анимация завершения каждого узла на карте курса.', engine: 'extras', hasColor: true },
]

export const BrilliantStreakModal = memo(function BrilliantStreakModal({
  streak,
  onClose,
  isOpen = true,
  initialView = 'streak',
  showCharge = false,
  charges,
  chargeSaved = false,
  chargeEarned = false,
  showPreviewTabs = false,
  xpEarned = 20,
}: BrilliantStreakModalProps) {
  const language = useAppStore((s) => s.settings.language)
  const isRu = language === 'ru'
  const dark = typeof document !== 'undefined' && document.body.dataset.theme === 'dark'

  const [view, setView] = useState<'streak' | 'charge' | 'lesson' | 'progress' | 'rate'>(initialView)
  const [riveNonce, setRiveNonce] = useState(0)
  const [lessonPreset, setLessonPreset] = useState<LessonPresetId>('lesson-check')
  const [progressMode, setProgressMode] = useState<ProgressMode>('playMastered')
  const [progressColor, setProgressColor] = useState<number>(0)
  const [ratePreset, setRatePreset] = useState<RatePresetId>('rate-app')
  const [streakGlow, setStreakGlow] = useState(false)
  // Progress / Rate fallback stage
  const [chargeStage, setChargeStage] = useState(0)
  const [showChargeInfo, setShowChargeInfo] = useState(false)

  useEffect(() => {
    setView(initialView)
  }, [initialView])

  useEffect(() => {
    if (!isOpen) return
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

    if (view === 'streak') {
      playSound('win')
      haptics.impact('heavy')
      return
    }

    if (view === 'charge' || view === 'lesson') return

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

  if (!isOpen) return null

  const title = streak <= 1
    ? (isRu ? 'Вы начали новую серию!' : 'Yangi seriyani boshladingiz!')
    : (isRu ? `Серия ${streak} дн.!` : `${streak} kunlik seriya!`)

  const fade = (on: boolean) => ({
    opacity: on ? 1 : 0,
    transform: on ? 'translateY(0)' : 'translateY(10px)',
    transition: 'opacity 420ms ease-out, transform 420ms cubic-bezier(0.16,1,0.3,1)',
  })

  const handleContinue = () => {
    haptics.impact('light')
    if (view === 'streak' && showCharge) {
      setView('charge')
      setRiveNonce((n) => n + 1)
      return
    }
    onClose()
  }

  const previewTabBar = showPreviewTabs ? (
    <div className="relative z-20 mx-auto mt-3 mb-1 flex flex-wrap items-center justify-center gap-1 rounded-full bg-psurface p-1 shadow-xs">
      {PREVIEW_TABS.map((t) => {
        const active = view === t.id
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              haptics.selection()
              setView(t.id)
              setRiveNonce((n) => n + 1)
            }}
            className={`rounded-full px-3 py-1 text-[11.5px] font-bold transition-all cursor-pointer active:scale-95 ${
              active ? 'bg-pfg text-pcanvas shadow-xs' : 'text-pmuted hover:text-pfg'
            }`}
          >
            {isRu ? t.ru : t.uz}
          </button>
        )
      })}
    </div>
  ) : undefined

  const chargeInfoModal = showChargeInfo ? (
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
  ) : null

  if (view === 'streak' || view === 'charge' || view === 'lesson') {
    const activePreset = LESSON_PRESETS.find((p) => p.id === lessonPreset) ?? LESSON_PRESETS[0]
    const lessonHeading =
      activePreset.id === 'lesson-fail'
        ? isRu ? 'Урок не пройден' : 'Dars yakunlanmadi'
        : activePreset.id === 'level-gem'
          ? isRu ? `Уровень ${progressColor + 1} пройден!` : `${progressColor + 1}-daraja yakunlandi!`
          : activePreset.id === 'skill-mastered'
            ? isRu ? 'Мастерство подтверждено!' : 'Mahorat tasdiqlandi!'
            : isRu ? 'Урок пройден!' : 'Dars yakunlandi!'

    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="streak-celebration-title"
        className="fixed inset-0 z-[100] bg-pcanvas select-none"
      >
        <BrilliantEndstateShell
          topSlot={previewTabBar}
          viewportClassName={view === 'streak' && streakGlow ? 'brilliant-streak-bg-glow' : undefined}
          primaryLabel={isRu ? 'Продолжить' : 'Davom etish'}
          onPrimaryClick={handleContinue}
        >
          {view === 'streak' ? (
            <BrilliantStreakStage
              streak={streak}
              heading={title}
              lang={isRu ? 'ru' : 'uz'}
              dark={dark}
              nonce={riveNonce}
              titleId="streak-celebration-title"
              onGlowChange={setStreakGlow}
              onRiveEvent={handleRiveEvent}
            />
          ) : view === 'charge' ? (
            <BrilliantChargeStage
              heading={
                chargeSaved
                  ? (isRu ? 'Заряд спас вашу серию!' : 'Seriya zaryadi seriyangizni saqladi!')
                  : (chargeEarned || charges === undefined)
                    ? (isRu ? 'Вы получили 1 заряд серии!' : '1 ta Seriya zaryadini oldingiz!')
                    : (isRu
                        ? `Заряды серии: ${charges}/2`
                        : `Seriya zaryadingiz: ${charges}/2`)
              }
              description={
                chargeSaved
                  ? (isRu
                      ? `Пропущенный день закрыт зарядом — серия сохранена (${charges ?? 0}/2 заряда осталось).`
                      : `O'tkazib yuborilgan kun zaryad bilan yopildi — seriyangiz saqlandi (${charges ?? 0}/2 zaryad qoldi).`)
                  : (isRu
                      ? 'С зарядом серии вы можете пропустить день обучения, не потеряв свою серию.'
                      : 'Seriya zaryadi bilan bir kunlik mashg‘ulotni o‘tkazib yuborsangiz ham seriyangiz yo‘qolmaydi.')
              }
              dark={dark}
              nonce={riveNonce}
              titleId="streak-celebration-title"
              onRiveEvent={handleRiveEvent}
            >
              <button
                type="button"
                onClick={() => {
                  haptics.selection()
                  setShowChargeInfo(true)
                }}
                className="text-[13px] font-semibold text-pmuted underline underline-offset-4 hover:text-pfg transition-colors cursor-pointer"
              >
                {isRu ? 'Что такое заряд серии?' : 'Seriya zaryadi nima?'}
              </button>
            </BrilliantChargeStage>
          ) : (
            <BrilliantCompletionStage
              mode="lesson"
              heading={lessonHeading}
              subtitle={
                isRu
                  ? 'Отличная работа! Вы освоили новый материал и приблизились к цели.'
                  : 'Ajoyib natija! Siz yangi mavzuni o‘zlashtirdingiz va maqsadga yaqinlashdingiz.'
              }
              xpLabel={isRu ? 'Всего XP' : 'Jami XP'}
              dark={dark}
              variant={progressColor}
              nonce={riveNonce}
              lessonTrigger={activePreset.trigger}
              isLevel={activePreset.isLevel}
              levelNumber={progressColor + 1}
              skillCheckMastered={activePreset.skillCheckMastered}
              showXp={activePreset.id !== 'lesson-fail'}
              earnedXp={xpEarned}
              onRiveEvent={handleRiveEvent}
            >
              <div className="flex flex-wrap items-center justify-center gap-1.5">
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
                        active ? 'bg-pfg text-pcanvas shadow-xs' : 'bg-psurface text-pmuted hover:text-pfg'
                      }`}
                    >
                      {isRu ? p.ru : p.uz}
                    </button>
                  )
                })}
              </div>
              <div className="flex items-center justify-center gap-2">
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
            </BrilliantCompletionStage>
          )}
        </BrilliantEndstateShell>
        {chargeInfoModal}
      </div>
    )
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="streak-celebration-title"
      className="fixed inset-0 z-[100] flex flex-col bg-pcanvas text-pfg select-none overflow-hidden"
    >
      <div className="relative z-10 flex flex-1 flex-col items-center px-6 pt-[calc(var(--safe-top,0px)+1rem)] min-h-0">
        {previewTabBar}
        {view === 'progress' ? (
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
        ) : (
          (() => {
            const activeMeta = RATE_PRESETS.find((r) => r.id === ratePreset) ?? RATE_PRESETS[0]
            return (
              <>
                {/* Barcha Brilliant maxsus & qo'shimcha artboardlar */}
                {activeMeta.engine === 'extras' ? (
                  <BrilliantExtrasRive
                    key={`extra-${ratePreset}-${progressColor}-${riveNonce}`}
                    kind={ratePreset as 'league' | 'practice-nudge' | 'ondemand-node'}
                    leagueLevel={(progressColor % 10) + 1}
                    leagueState="promote"
                    boltVisible
                    variant={progressColor}
                    dark={dark}
                    nonce={riveNonce}
                    label="Brilliant Special Extra"
                    className="mt-[2.5vh] aspect-square w-full max-w-[260px] sm:max-w-[290px] shrink-0"
                    fallback={<Sparkles size={72} className="text-pwarning" />}
                  />
                ) : (
                  <BrilliantEndstateRive
                    key={`rate-${ratePreset}-${progressColor}-${riveNonce}`}
                    kind={ratePreset === 'lightning-bolt' ? 'streak' : (ratePreset as 'rate-app' | 'premium-lock' | 'recommended-level' | 'post-checkout' | 'review-mistakes' | 'review-complete' | 'assessment-intro' | 'warm-up' | 'level-insertion' | 'lcr-transition' | 'koji-entrance' | 'icp-node')}
                    variant={ratePreset === 'lightning-bolt' ? 1 : progressColor}
                    correctNum={4}
                    totalNum={6}
                    levelTitle={isRu ? 'Уровень 2' : '2-bosqich'}
                    skillTitles={isRu ? ['Основы', 'Знаки', 'Практика'] : ['Asoslar', 'Belgilar', 'Amaliyot']}
                    dark={dark}
                    nonce={riveNonce}
                    onRiveEvent={handleRiveEvent}
                    label="Brilliant Special Endstate"
                    className="mt-[2.5vh] aspect-square w-full max-w-[260px] sm:max-w-[290px] shrink-0"
                    fallback={<Sparkles size={72} className="text-pwarning" />}
                  />
                )}

                <div className="mt-1 flex flex-col items-center text-center" style={fade(chargeStage >= 1)}>
                  <h1
                    id="streak-celebration-title"
                    className="font-display text-[22px] sm:text-[25px] font-extrabold leading-tight tracking-tight text-pfg"
                  >
                    {ratePreset === 'league'
                      ? isRu ? `Лига · Уровень ${(progressColor % 10) + 1}` : `Liga · ${(progressColor % 10) + 1}-daraja`
                      : isRu ? activeMeta.ruTitle : activeMeta.uzTitle}
                  </h1>

                  <p className="mt-1 max-w-[310px] text-[13px] font-medium leading-[1.4] text-pmuted">
                    {isRu ? activeMeta.ruDesc : activeMeta.uzDesc}
                  </p>

                  {/* Artboard tanlagichi (ixcham scroll qilinadigan chip ro'yxati) */}
                  <div className="mt-3 flex max-h-[104px] max-w-[360px] flex-wrap items-center justify-center gap-1.5 overflow-y-auto px-1 py-0.5">
                    {RATE_PRESETS.map((r) => {
                      const active = ratePreset === r.id
                      return (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => {
                            haptics.selection()
                            setRatePreset(r.id)
                            setRiveNonce((n) => n + 1)
                          }}
                          className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition-all cursor-pointer active:scale-95 ${
                            active
                              ? 'bg-pfg text-pcanvas shadow-xs'
                              : 'bg-psurface text-pmuted hover:text-pfg'
                          }`}
                        >
                          {isRu ? r.ru : r.uz}
                        </button>
                      )
                    })}
                  </div>

                  {activeMeta.hasColor && (
                    <div className="mt-2.5 flex items-center justify-center gap-2">
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
                            className={`size-5.5 rounded-full transition-transform cursor-pointer ${
                              active ? 'scale-125 ring-2 ring-pfg ring-offset-2 ring-offset-pcanvas' : 'opacity-75 hover:opacity-100'
                            }`}
                            style={{ backgroundColor: c.hex }}
                          />
                        )
                      })}
                    </div>
                  )}
                </div>
              </>
            )
          })()
        )}
      </div>

      <div
        className="relative z-10 w-full max-w-[420px] mx-auto px-5 pt-3 pb-[calc(1rem+var(--safe-bottom,0px))]"
        style={fade(chargeStage >= 1)}
      >
        <Button variant="primary" size="lg" block onClick={handleContinue} className="font-extrabold">
          {isRu ? 'Продолжить' : 'Davom etish'}
        </Button>
      </div>
    </div>
  )
})

export default BrilliantStreakModal
