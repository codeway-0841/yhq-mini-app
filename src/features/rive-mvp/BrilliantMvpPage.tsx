import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Award,
  CheckCircle2,
  Flame,
  GraduationCap,
  Layers,
  Loader2,
  Lock,
  Moon,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  Star,
  Sun,
  Trophy,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import type {
  BrilliantLessonTrigger,
  BrilliantPracticeTrigger,
  BrilliantProgressTrigger,
} from '../../shared/components/BrilliantEndstateRive'
import type { BrilliantLeagueState } from '../../shared/components/BrilliantExtrasRive'
import { PageHeader } from '../../shared/components/ui/page-header'
import { Button } from '../../shared/components/ui/button'
import { useAppStore } from '../../shared/store/useAppStore'
import { goBack } from '../../shared/lib/navigation'
import { cn } from '../../shared/lib/cn'
import { haptics } from '../../platform/haptics'
import { playSound } from '../../shared/lib/sounds'
import { renderMvpScreen, type MvpScreenId } from './RiveMvpScreens'
import './brilliant-mvp.css'

interface CatalogItem {
  id: MvpScreenId
  group: 'endstate' | 'assessment' | 'flow'
  titleUz: string
  titleRu: string
  meta: string
  layoutUz: string
  layoutRu: string
  icon: LucideIcon
  tone: string
}

const CATALOG: CatalogItem[] = [
  // 1) Asosiy Full-screen Endstate Layout (750350)
  {
    id: 'lesson',
    group: 'endstate',
    titleUz: 'Dars yakuni (+ XP Starburst)',
    titleRu: 'Конец урока (+ XP Starburst)',
    meta: 'MAIN_lesson-endstate · transition_up',
    layoutUz: '100dvh · translateY(30%→0%) + RiveEvent XP',
    layoutRu: '100dvh · translateY(30%→0%) + RiveEvent XP',
    icon: GraduationCap,
    tone: 'text-[#29cc57] bg-[#29cc57]/12',
  },
  {
    id: 'practice',
    group: 'endstate',
    titleUz: 'Mashq natijasi',
    titleRu: 'Итог практики',
    meta: 'MAIN_practice-endstate · play100/50+/Fail',
    layoutUz: '100dvh · 50% dan yuqorida starburst',
    layoutRu: '100dvh · starburst от 50%',
    icon: CheckCircle2,
    tone: 'text-[#3557ff] bg-[#3557ff]/12',
  },
  {
    id: 'streak',
    group: 'endstate',
    titleUz: 'Kunlik seriya (Streak)',
    titleRu: 'Ударная серия (Streak)',
    meta: 'MAIN_streak-endstate · 5 RiveEvents',
    layoutUz: '100dvh · 5-kun kalendar + 6-zarra burst',
    layoutRu: '100dvh · календарь 5 дней + частицы',
    icon: Flame,
    tone: 'text-[#ff8d23] bg-[#ff8d23]/12',
  },
  {
    id: 'charge',
    group: 'endstate',
    titleUz: 'Seriya himoyasi (Charge)',
    titleRu: 'Заморозка серии',
    meta: 'Streaks Forgive · PlayStreakChargeSound',
    layoutUz: '100dvh · 1:1 sahna + ovoz eventi',
    layoutRu: '100dvh · 1:1 сцена + звук',
    icon: Zap,
    tone: 'text-[#b7dc00] bg-[#b7dc00]/15',
  },
  {
    id: 'rate-app',
    group: 'endstate',
    titleUz: 'Ilovani baholash',
    titleRu: 'Оценка приложения',
    meta: 'MAIN_RateTheApp · 353/243',
    layoutUz: '100dvh full-screen (modal sheet emas!)',
    layoutRu: '100dvh полный экран (не шторка!)',
    icon: Star,
    tone: 'text-[#f6b31f] bg-[#f6b31f]/15',
  },
  {
    id: 'premium-lock',
    group: 'endstate',
    titleUz: 'Premium qulf (Lock Bounce)',
    titleRu: 'Premium замок',
    meta: 'MAIN_premium-nudge · Play_Text and BG',
    layoutUz: '100dvh · Iridescent fon + RiveEvent matn',
    layoutRu: '100dvh · Iridescent фон + RiveEvent текст',
    icon: Lock,
    tone: 'text-[#9d62ff] bg-[#9d62ff]/12',
  },

  // 2) LevelCheckScreenLayout + Leagues Podium
  {
    id: 'progress-intro',
    group: 'assessment',
    titleUz: 'Bosqich tekshiruvi (Kirish)',
    titleRu: 'Проверка уровня (Вход)',
    meta: 'MAIN_ProgressCheckIntro · 284×283px',
    layoutUz: 'Top Navbar + Karta 360px + Sticky CTA',
    layoutRu: 'Верхний Navbar + Карта 360px + CTA',
    icon: Layers,
    tone: 'text-[#3557ff] bg-[#3557ff]/12',
  },
  {
    id: 'progress-endstate',
    group: 'assessment',
    titleUz: 'Bosqich tekshiruvi (Natija)',
    titleRu: 'Проверка уровня (Итог)',
    meta: 'MAIN_ProgressCheckEndstate · 244×244px',
    layoutUz: 'Top Navbar + Karta 360px + Mastered/Pass/Poor',
    layoutRu: 'Верхний Navbar + Карта 360px + статусы',
    icon: Award,
    tone: 'text-[#29cc57] bg-[#29cc57]/12',
  },
  {
    id: 'leagues',
    group: 'assessment',
    titleUz: 'Liga ko‘tarilishi (Podium)',
    titleRu: 'Повышение в лиге',
    meta: 'leagues-badges · 190px + 1s slide-up',
    layoutUz: 'Radial nur ustida badge + jadval ko‘tarilishi',
    layoutRu: 'Бейдж над свечением + таблица снизу',
    icon: Trophy,
    tone: 'text-[#f6b31f] bg-[#f6b31f]/15',
  },
  {
    id: 'review-mistakes',
    group: 'assessment',
    titleUz: 'Xatolar ustida ishlash',
    titleRu: 'Разбор ошибок',
    meta: 'MAIN_ReviewMistakes · LevelCheckShell',
    layoutUz: '240px sahna + 360px xato kartasi',
    layoutRu: '240px сцена + 360px карта ошибок',
    icon: Sparkles,
    tone: 'text-[#ff4b6e] bg-[#ff4b6e]/12',
  },

  // 3) Onboarding, Checkout & Loaderlar
  {
    id: 'post-checkout',
    group: 'flow',
    titleUz: 'To‘lovdan so‘ng (Post-Checkout)',
    titleRu: 'После оплаты (Post-Checkout)',
    meta: 'MAIN_PostCheckoutFlow · 100dvh',
    layoutUz: 'Iridescent full-screen tabrik ekrani',
    layoutRu: 'Iridescent full-screen экран успеха',
    icon: Sparkles,
    tone: 'text-[#3557ff] bg-[#3557ff]/12',
  },
  {
    id: 'practice-nudge',
    group: 'flow',
    titleUz: 'Shaxsiy mashq taklifi',
    titleRu: 'Персональная практика',
    meta: 'personalized-practice-nudge · SM',
    layoutUz: 'Iridescent fon + 50dvh RiveContainer',
    layoutRu: 'Iridescent фон + 50dvh RiveContainer',
    icon: Zap,
    tone: 'text-[#9d62ff] bg-[#9d62ff]/12',
  },
  {
    id: 'warm-up',
    group: 'flow',
    titleUz: 'Qizdirish mashqi (Warm-up)',
    titleRu: 'Разминка (Warm-up)',
    meta: 'MAIN_WarmUp · LevelCheckVM',
    layoutUz: '100dvh · 50dvh RiveContainer',
    layoutRu: '100dvh · 50dvh RiveContainer',
    icon: Flame,
    tone: 'text-[#ff8d23] bg-[#ff8d23]/12',
  },
  {
    id: 'recommended-level',
    group: 'flow',
    titleUz: 'Keyingi darajaga sakrash',
    titleRu: 'Переход на уровень выше',
    meta: 'MAIN_RecommendedLevelCheck',
    layoutUz: '100dvh · 50dvh RiveContainer + 2 CTA',
    layoutRu: '100dvh · 50dvh RiveContainer + 2 CTA',
    icon: Layers,
    tone: 'text-[#29cc57] bg-[#29cc57]/12',
  },
  {
    id: 'level-insertion',
    group: 'flow',
    titleUz: 'Yangi daraja qo‘shilishi',
    titleRu: 'Новый модуль в карте',
    meta: 'MAIN_LevelInsertionIntro',
    layoutUz: '100dvh · dinamik modul nomlari bilan',
    layoutRu: '100dvh · с динамическими темами',
    icon: Layers,
    tone: 'text-[#3557ff] bg-[#3557ff]/12',
  },
  {
    id: 'lesson-loader',
    group: 'flow',
    titleUz: 'Dars yuklanish ekrani',
    titleRu: 'Экран загрузки урока',
    meta: 'lesson-loader · MAIN_Lesson Loader',
    layoutUz: '100dvh full-screen Rive loader',
    layoutRu: '100dvh полноэкранный лоадер',
    icon: Loader2,
    tone: 'text-[#3557ff] bg-[#3557ff]/12',
  },
  {
    id: 'jump-back-in',
    group: 'flow',
    titleUz: 'Qolgan joydan davom etish',
    titleRu: 'Продолжить с места',
    meta: 'koji-jump-back-in · RUX',
    layoutUz: '100dvh · 50dvh RiveContainer',
    layoutRu: '100dvh · 50dvh RiveContainer',
    icon: Zap,
    tone: 'text-[#f6b31f] bg-[#f6b31f]/15',
  },
]

const COLOR_LABELS = [
  { id: 0, label: 'Green', hex: '#29cc57' },
  { id: 1, label: 'Blue', hex: '#3557ff' },
  { id: 2, label: 'Red', hex: '#ff4b6e' },
  { id: 3, label: 'Orange', hex: '#ff8d23' },
  { id: 4, label: 'Yellow', hex: '#f6b31f' },
  { id: 5, label: 'Purple', hex: '#9d62ff' },
]

export default function BrilliantMvpPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const language = useAppStore((s) => s.settings.language)
  const lang: 'uz' | 'ru' = language === 'ru' ? 'ru' : 'uz'

  const [dark, setDark] = useState<boolean>(() => {
    if (typeof document === 'undefined') return false
    return document.body.dataset.theme === 'dark'
  })

  const paramScreen = searchParams.get('screen') as MvpScreenId | null
  const [activeId, setActiveId] = useState<MvpScreenId | null>(() =>
    paramScreen && CATALOG.some((c) => c.id === paramScreen) ? paramScreen : null,
  )
  const [nonce, setNonce] = useState(0)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [eventsLog, setEventsLog] = useState<string[]>([])

  useEffect(() => {
    if (paramScreen && CATALOG.some((c) => c.id === paramScreen)) {
      setActiveId(paramScreen)
      setEventsLog([])
      setNonce((n) => n + 1)
    } else if (!paramScreen) {
      setActiveId(null)
    }
  }, [paramScreen])

  // Interaktiv variantlar
  const [colorVariant, setColorVariant] = useState(0)
  const [lessonTrigger, setLessonTrigger] = useState<BrilliantLessonTrigger>('kojiFlip')
  const [lessonMode, setLessonMode] = useState<'lesson' | 'level' | 'mastered'>('lesson')
  const [practiceTrigger, setPracticeTrigger] = useState<BrilliantPracticeTrigger>('play100')
  const [streakVariant, setStreakVariant] = useState<0 | 1 | 2>(1)
  const [progressTrigger, setProgressTrigger] = useState<BrilliantProgressTrigger>('playMastered')
  const [leagueLevel, setLeagueLevel] = useState(3)
  const [leagueState, setLeagueState] = useState<BrilliantLeagueState>('promote')

  // Theme o'zgarganda document.body.dataset.theme ni darhol sinxronlash (telefonda Dark/Light ko'rish uchun)
  useEffect(() => {
    if (typeof document === 'undefined') return
    document.body.dataset.theme = dark ? 'dark' : 'light'
  }, [dark])

  const openScreen = (id: MvpScreenId) => {
    playSound('click')
    haptics.impact('light')
    setEventsLog([])
    setActiveId(id)
    setNonce((n) => n + 1)
    setDrawerOpen(false)
    setSearchParams({ screen: id }, { replace: true })
  }

  const closeScreen = () => {
    setActiveId(null)
    setDrawerOpen(false)
    setSearchParams({}, { replace: true })
  }

  const replay = () => {
    setEventsLog([])
    setNonce((n) => n + 1)
  }

  const groups = useMemo(
    () => [
      {
        key: 'endstate' as const,
        title: lang === 'ru' ? '1. Главные Endstate экраны (100dvh)' : '1. Asosiy Endstate ekranlar (100dvh)',
        desc:
          lang === 'ru'
            ? 'Полный экран, 50dvh сцена, RiveEvent хореография и sticky CTA.'
            : 'To‘liq ekran, 50dvh sahna, RiveEvent xoreografiya va sticky CTA.',
      },
      {
        key: 'assessment' as const,
        title: lang === 'ru' ? '2. Проверки и Лиги (LevelCheck / Podium)' : '2. Tekshiruv va Ligalar',
        desc:
          lang === 'ru'
            ? 'Верхний navbar, карточки 360px и анимация подиума лиги.'
            : 'Tepa navbar, 360px kartalar va liga podium animatsiyasi.',
      },
      {
        key: 'flow' as const,
        title: lang === 'ru' ? '3. Переходы, Checkout и Лоадеры' : '3. O‘tishlar, Checkout va Loaderlar',
        desc:
          lang === 'ru'
            ? 'Экраны до/после оплаты, персональные подсказки и загрузка.'
            : 'To‘lovdan keyingi ekranlar, shaxsiy taklif va yuklanishlar.',
      },
    ],
    [lang],
  )

  return (
    <main className="min-h-[100dvh] bg-pcanvas text-pfg pb-12">
      <PageHeader
        title="Brilliant 1:1 Rive MVP"
        subtitle={
          lang === 'ru'
            ? 'Нажмите карточку — откроется полноэкранный 1:1 макет'
            : 'Istalgan kartani bosing — telefonda to‘liq 1:1 ko‘rinadi'
        }
        onBack={() => goBack(navigate)}
        actions={
          <button
            type="button"
            onClick={() => {
              playSound('toggle')
              setDark((d) => !d)
            }}
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-plineStrong bg-psurface px-3 text-[12px] font-bold text-pfg cursor-pointer"
          >
            {dark ? <Sun size={14} /> : <Moon size={14} />}
            <span>{dark ? 'Light' : 'Dark'}</span>
          </button>
        }
      />

      <div className="mx-auto max-w-[680px] px-4 pt-3 space-y-6">
        {/* Tezkor sinov tugmalari (eng muhim 4 ta) */}
        <section className="bg-pcard rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-[15px] font-extrabold text-pfg">
                {lang === 'ru' ? 'Быстрый старт на телефоне' : 'Telefonda tezkor sinov'}
              </h2>
              <p className="text-[12px] text-pmuted">
                {lang === 'ru'
                  ? 'Сравните новые 1:1 полноэкранные сцены со старыми модалками.'
                  : 'To‘liq ekranli 1:1 dizayn va RiveEventlarni jonli tekshiring.'}
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-[#3557ff]/12 px-2.5 py-1 text-[11px] font-bold text-pprimary">
              17 {lang === 'ru' ? 'сцен' : 'sahna'}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <Button variant="primary" size="default" onClick={() => openScreen('lesson')}>
              {lang === 'ru' ? 'Урок + XP' : 'Dars + XP'}
            </Button>
            <Button variant="secondary" size="default" onClick={() => openScreen('streak')}>
              {lang === 'ru' ? 'Streak + Календарь' : 'Streak + Kalendar'}
            </Button>
          </div>
        </section>

        {/* Barcha 17 ta sahna guruhlar bo'yicha */}
        {groups.map((grp) => {
          const items = CATALOG.filter((i) => i.group === grp.key)
          return (
            <section key={grp.key} className="space-y-2.5">
              <div className="px-1">
                <h2 className="text-[15px] font-extrabold text-pfg">{grp.title}</h2>
                <p className="text-[12px] text-pmuted">{grp.desc}</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {items.map((item) => {
                  const Icon = item.icon
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => openScreen(item.id)}
                      className="bg-pcard flex items-start gap-3 rounded-2xl p-3.5 text-left transition-transform active:scale-[0.985] hover:border-pprimary cursor-pointer"
                    >
                      <div className={cn('flex size-10 shrink-0 items-center justify-center rounded-xl', item.tone)}>
                        <Icon size={20} strokeWidth={2.2} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[14px] font-bold text-pfg leading-snug">
                          {lang === 'ru' ? item.titleRu : item.titleUz}
                        </div>
                        <div className="mt-0.5 text-[11px] font-semibold text-pmuted truncate">
                          {lang === 'ru' ? item.layoutRu : item.layoutUz}
                        </div>
                        <div className="mt-1 text-[10px] font-mono text-pmuted/75 truncate">
                          {item.meta}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </section>
          )
        })}
      </div>

      {/* TO'LIQ EKRAN BRILLIANT 1:1 SIMULYATOR */}
      {activeId && (
        <div className="fixed inset-0 z-[120] bg-pcanvas overflow-y-auto overscroll-contain">
          {/* Tepada ixcham boshqaruv pill (LevelCheck top-bar bilan to'qnashmaydi) */}
          <div
            className={cn(
              'fixed right-3 z-[140] flex items-center gap-1.5',
              activeId === 'progress-intro' || activeId === 'progress-endstate' || activeId === 'review-mistakes'
                ? 'top-[calc(var(--safe-top,0px)+58px)]'
                : 'top-[calc(var(--safe-top,0px)+10px)]',
            )}
          >
            <button
              type="button"
              onClick={replay}
              aria-label="Replay"
              className="flex h-9 items-center gap-1 rounded-full border border-plineStrong bg-pcard/95 px-3 text-[12px] font-bold text-pfg shadow-md active:scale-95 cursor-pointer"
            >
              <RotateCcw size={13} />
              <span>{lang === 'ru' ? 'Повтор' : 'Qayta'}</span>
            </button>
            <button
              type="button"
              onClick={() => setDrawerOpen((o) => !o)}
              aria-label="Sozlamalar"
              className={cn(
                'flex size-9 items-center justify-center rounded-full border shadow-md active:scale-95 cursor-pointer',
                drawerOpen
                  ? 'border-pprimary bg-[#3557ff] text-white'
                  : 'border-plineStrong bg-pcard/95 text-pfg',
              )}
            >
              <SlidersHorizontal size={15} />
            </button>
            <button
              type="button"
              onClick={closeScreen}
              aria-label="Yopish"
              className="flex size-9 items-center justify-center rounded-full border border-plineStrong bg-pcard/95 text-pfg shadow-md active:scale-95 cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>

          {/* Kengaytiriladigan parametrlar paneli (faqat tugmani bosganda ochiladi) */}
          {drawerOpen && (
            <div
              className={cn(
                'fixed right-3 left-3 sm:left-auto sm:w-[340px] z-[140] bg-pcard rounded-2xl p-4 shadow-2xl space-y-3',
                activeId === 'progress-intro' || activeId === 'progress-endstate' || activeId === 'review-mistakes'
                  ? 'top-[calc(var(--safe-top,0px)+102px)]'
                  : 'top-[calc(var(--safe-top,0px)+54px)]',
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-extrabold text-pfg">
                  {lang === 'ru' ? 'Параметры сцены' : 'Sahna parametrlari'}
                </span>
                <button
                  type="button"
                  onClick={() => setDark((d) => !d)}
                  className="inline-flex items-center gap-1 rounded-full bg-psurface px-2.5 py-1 text-[11px] font-bold text-pfg cursor-pointer"
                >
                  {dark ? <Sun size={12} /> : <Moon size={12} />}
                  {dark ? 'Light Mode' : 'Dark Mode'}
                </button>
              </div>

              {/* Rang variantlari */}
              <div className="space-y-1">
                <span className="text-[11px] font-bold text-pmuted">Color Variant (0..5)</span>
                <div className="flex flex-wrap gap-1.5">
                  {COLOR_LABELS.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setColorVariant(c.id)
                        replay()
                      }}
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold border cursor-pointer',
                        colorVariant === c.id
                          ? 'border-pfg bg-psurface text-pfg'
                          : 'border-pline text-pmuted',
                      )}
                    >
                      <span className="size-2 rounded-full" style={{ backgroundColor: c.hex }} />
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>

              {activeId === 'lesson' && (
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-1.5">
                    {(['lesson', 'level', 'mastered'] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => {
                          setLessonMode(m)
                          replay()
                        }}
                        className={cn(
                          'rounded-full px-2.5 py-1 text-[11px] font-bold border cursor-pointer',
                          lessonMode === m ? 'border-pprimary bg-[#3557ff]/15 text-pfg' : 'border-pline text-pmuted',
                        )}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {(['kojiFlip', 'kojiGem', 'kojiSpin', 'koji360', 'kojiFail'] as const).map((tr) => (
                      <button
                        key={tr}
                        type="button"
                        onClick={() => {
                          setLessonTrigger(tr)
                          replay()
                        }}
                        className={cn(
                          'rounded-full px-2.5 py-1 text-[11px] font-bold border cursor-pointer',
                          lessonTrigger === tr ? 'border-pprimary bg-[#3557ff]/15 text-pfg' : 'border-pline text-pmuted',
                        )}
                      >
                        {tr}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {activeId === 'practice' && (
                <div className="flex flex-wrap gap-1.5">
                  {(['play100', 'play50Plus', 'playFailure'] as const).map((tr) => (
                    <button
                      key={tr}
                      type="button"
                      onClick={() => {
                        setPracticeTrigger(tr)
                        replay()
                      }}
                      className={cn(
                        'rounded-full px-2.5 py-1 text-[11px] font-bold border cursor-pointer',
                        practiceTrigger === tr ? 'border-pprimary bg-[#3557ff]/15 text-pfg' : 'border-pline text-pmuted',
                      )}
                    >
                      {tr}
                    </button>
                  ))}
                </div>
              )}

              {activeId === 'streak' && (
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { id: 0 as const, name: '0: First Streak' },
                    { id: 1 as const, name: '1: Standard' },
                    { id: 2 as const, name: '2: Milestone' },
                  ].map((sv) => (
                    <button
                      key={sv.id}
                      type="button"
                      onClick={() => {
                        setStreakVariant(sv.id)
                        replay()
                      }}
                      className={cn(
                        'rounded-full px-2.5 py-1 text-[11px] font-bold border cursor-pointer',
                        streakVariant === sv.id ? 'border-pprimary bg-[#3557ff]/15 text-pfg' : 'border-pline text-pmuted',
                      )}
                    >
                      {sv.name}
                    </button>
                  ))}
                </div>
              )}

              {activeId === 'progress-endstate' && (
                <div className="flex flex-wrap gap-1.5">
                  {(['playMastered', 'playPassed', 'playPoor'] as const).map((tr) => (
                    <button
                      key={tr}
                      type="button"
                      onClick={() => {
                        setProgressTrigger(tr)
                        replay()
                      }}
                      className={cn(
                        'rounded-full px-2.5 py-1 text-[11px] font-bold border cursor-pointer',
                        progressTrigger === tr ? 'border-pprimary bg-[#3557ff]/15 text-pfg' : 'border-pline text-pmuted',
                      )}
                    >
                      {tr}
                    </button>
                  ))}
                </div>
              )}

              {activeId === 'leagues' && (
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-1.5">
                    {(['promote', 'stagnant', 'demote'] as const).map((st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => {
                          setLeagueState(st)
                          replay()
                        }}
                        className={cn(
                          'rounded-full px-2.5 py-1 text-[11px] font-bold border cursor-pointer',
                          leagueState === st ? 'border-pprimary bg-[#3557ff]/15 text-pfg' : 'border-pline text-pmuted',
                        )}
                      >
                        {st}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-pmuted">Level: {leagueLevel}</span>
                    <input
                      type="range"
                      min={1}
                      max={10}
                      value={leagueLevel}
                      onChange={(e) => {
                        setLeagueLevel(Number(e.target.value))
                        replay()
                      }}
                      className="flex-1 accent-[#3557ff]"
                    />
                  </div>
                </div>
              )}

              {/* Jonli RiveEvent logi */}
              <div className="rounded-xl bg-psurface p-2.5">
                <div className="text-[10px] font-bold uppercase tracking-wider text-pmuted mb-1">
                  RiveEvent Log ({eventsLog.length})
                </div>
                {eventsLog.length === 0 ? (
                  <div className="text-[11px] text-pmuted/70">Event kutilmoqda...</div>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {eventsLog.map((ev, idx) => (
                      <span
                        key={`${ev}-${idx}`}
                        className="rounded-md bg-pcard px-1.5 py-0.5 font-mono text-[10px] text-pfg"
                      >
                        {ev}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Render tanlangan Brilliant sahna */}
          {renderMvpScreen(activeId, {
            lang,
            dark,
            nonce,
            colorVariant,
            lessonTrigger,
            lessonMode,
            practiceTrigger,
            streakVariant,
            progressTrigger,
            leagueLevel,
            leagueState,
            onEvent: (ev) => setEventsLog((prev) => [...prev.slice(-11), ev]),
            onClose: closeScreen,
            onReplay: replay,
          })}
        </div>
      )}
    </main>
  )
}
