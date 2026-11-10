import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Award,
  BarChart3,
  Bell,
  Bot,
  Briefcase,
  CheckCircle2,
  Compass,
  Flame,
  Gamepad2,
  GraduationCap,
  Layers,
  Loader2,
  Lock,
  MessageSquare,
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

type CatalogGroup = 'endstate' | 'paywall' | 'assessment' | 'inlesson' | 'maploaders' | 'nuxrux'
type KivviStatus = 'missing' | 'needs_layout' | 'wired'

interface CatalogItem {
  id: MvpScreenId
  group: CatalogGroup
  kivviStatus: KivviStatus
  titleUz: string
  titleRu: string
  meta: string
  layoutUz: string
  layoutRu: string
  icon: LucideIcon
  tone: string
}

const CATALOG: CatalogItem[] = [
  // 1) Asosiy Endstate Ekranlar (100dvh Layout 750350)
  {
    id: 'lesson',
    group: 'endstate',
    kivviStatus: 'wired',
    titleUz: 'Dars yakuni (+ XP Starburst)',
    titleRu: 'Конец урока (+ XP Starburst)',
    meta: 'endstates · MAIN_lesson-endstate · transition_up',
    layoutUz: '100dvh · translateY(30%→0%) + RiveEvent XP',
    layoutRu: '100dvh · translateY(30%→0%) + RiveEvent XP',
    icon: GraduationCap,
    tone: 'text-[#29cc57] bg-[#29cc57]/12',
  },
  {
    id: 'practice',
    group: 'endstate',
    kivviStatus: 'wired',
    titleUz: 'Mashq natijasi',
    titleRu: 'Итог практики',
    meta: 'endstates · MAIN_practice-endstate · play100/50+/Fail',
    layoutUz: '100dvh · 50% dan yuqorida starburst',
    layoutRu: '100dvh · starburst от 50%',
    icon: CheckCircle2,
    tone: 'text-[#3557ff] bg-[#3557ff]/12',
  },
  {
    id: 'streak',
    group: 'endstate',
    kivviStatus: 'wired',
    titleUz: 'Kunlik seriya (Streak)',
    titleRu: 'Ударная серия (Streak)',
    meta: 'endstates · MAIN_streak-endstate · 5 RiveEvents',
    layoutUz: '100dvh · 5-kun kalendar + 6-zarra burst',
    layoutRu: '100dvh · календарь 5 дней + частицы',
    icon: Flame,
    tone: 'text-[#ff8d23] bg-[#ff8d23]/12',
  },
  {
    id: 'charge',
    group: 'endstate',
    kivviStatus: 'wired',
    titleUz: 'Seriya himoyasi (Charge)',
    titleRu: 'Заморозка серии',
    meta: 'endstates · Streaks Forgive · PlayStreakChargeSound',
    layoutUz: '100dvh · 1:1 sahna + ovoz eventi',
    layoutRu: '100dvh · 1:1 сцена + звук',
    icon: Zap,
    tone: 'text-[#b7dc00] bg-[#b7dc00]/15',
  },
  {
    id: 'rate-app',
    group: 'endstate',
    kivviStatus: 'needs_layout',
    titleUz: 'Ilovani baholash',
    titleRu: 'Оценка приложения',
    meta: 'endstates · MAIN_RateTheApp · 353/243',
    layoutUz: '100dvh full-screen (Hozir KIVVIda ModalShell)',
    layoutRu: '100dvh полный экран (в KIVVI пока шторка)',
    icon: Star,
    tone: 'text-[#f6b31f] bg-[#f6b31f]/15',
  },
  {
    id: 'opt-in',
    group: 'endstate',
    kivviStatus: 'missing',
    titleUz: 'Push bildirishnoma taklifi',
    titleRu: 'Запрос Push-уведомлений',
    meta: 'push_opt_in_apr_22_26 · Opt-In (OptInVM)',
    layoutUz: '100dvh Page · RiveContainer + 2 CTA',
    layoutRu: '100dvh Page · RiveContainer + 2 CTA',
    icon: Bell,
    tone: 'text-[#3557ff] bg-[#3557ff]/12',
  },
  {
    id: 'review-complete',
    group: 'endstate',
    kivviStatus: 'wired',
    titleUz: 'Takrorlash yakuni',
    titleRu: 'Повтор завершён',
    meta: 'level-check · MAIN_ReviewComplete',
    layoutUz: '100dvh Page · 1/1 aspectRatio',
    layoutRu: '100dvh Page · 1/1 aspectRatio',
    icon: CheckCircle2,
    tone: 'text-[#29cc57] bg-[#29cc57]/12',
  },
  {
    id: 'practice-tray',
    group: 'endstate',
    kivviStatus: 'missing',
    titleUz: 'Mashq Tray yakuni',
    titleRu: 'Практика Tray завершена',
    meta: 'practice_tray_sep_30_2026 · PracticeCompleteVM',
    layoutUz: '100dvh / Tray sheet · kunlik mashq',
    layoutRu: '100dvh / Tray sheet · ежедневная разминка',
    icon: Award,
    tone: 'text-[#9d62ff] bg-[#9d62ff]/12',
  },

  // 2) Paywall, Premium Nudge & Obuna
  {
    id: 'premium-lock',
    group: 'paywall',
    kivviStatus: 'needs_layout',
    titleUz: 'Premium qulf (Lock Bounce)',
    titleRu: 'Premium замок (Lock Bounce)',
    meta: 'endstates · PremiumNudgeLockBounce · Play_Text and BG',
    layoutUz: '100dvh · Iridescent fon + RiveEvent matn',
    layoutRu: '100dvh · Iridescent фон + RiveEvent текст',
    icon: Lock,
    tone: 'text-[#9d62ff] bg-[#9d62ff]/12',
  },
  {
    id: 'premium-bar',
    group: 'paywall',
    kivviStatus: 'missing',
    titleUz: 'Premium o‘sish ustunchasi (Bar Graph)',
    titleRu: 'Premium столбчатый график',
    meta: 'endstates · MAIN_premium-nudge · PremiumNudgeBarGraph',
    layoutUz: '100dvh · Iridescent Paywall Endstate',
    layoutRu: '100dvh · Iridescent Paywall Endstate',
    icon: BarChart3,
    tone: 'text-[#3557ff] bg-[#3557ff]/12',
  },
  {
    id: 'premium-line',
    group: 'paywall',
    kivviStatus: 'missing',
    titleUz: 'Premium egri grafik (Line Chart)',
    titleRu: 'Premium линейный график',
    meta: 'endstates · MAIN_premium-nudge · PremiumNudgeLineChart',
    layoutUz: '100dvh · Iridescent Paywall Endstate',
    layoutRu: '100dvh · Iridescent Paywall Endstate',
    icon: BarChart3,
    tone: 'text-[#29cc57] bg-[#29cc57]/12',
  },
  {
    id: 'personalized-practice',
    group: 'paywall',
    kivviStatus: 'missing',
    titleUz: 'Shaxsiy mashq (Full-Screen)',
    titleRu: 'Персональная практика (Full-Screen)',
    meta: 'endstates · PersonalizedPracticeNudgeVM',
    layoutUz: '100dvh · Iridescent + 1:1 RiveContainer',
    layoutRu: '100dvh · Iridescent + 1:1 RiveContainer',
    icon: Sparkles,
    tone: 'text-[#9d62ff] bg-[#9d62ff]/12',
  },
  {
    id: 'practice-nudge-modal',
    group: 'paywall',
    kivviStatus: 'missing',
    titleUz: 'Kurs xaritasi ResponsiveModal Drawer',
    titleRu: 'ResponsiveModal карты курса',
    meta: 'personalized-practice-nudge · 320×350px Sheet',
    layoutUz: 'Bottom Sheet / Modal (paywall.upsellBg)',
    layoutRu: 'Шторка / Модалка (paywall.upsellBg)',
    icon: Zap,
    tone: 'text-[#9d62ff] bg-[#9d62ff]/12',
  },
  {
    id: 'post-checkout',
    group: 'paywall',
    kivviStatus: 'needs_layout',
    titleUz: 'To‘lovdan so‘ng (Post-Checkout)',
    titleRu: 'После оплаты (Post-Checkout)',
    meta: 'post_checkout_apr_01_26 · MAIN_PostCheckoutFlow',
    layoutUz: '100dvh Iridescent (Hozir KIVVIda Drawer)',
    layoutRu: '100dvh Iridescent (в KIVVI шторка)',
    icon: Sparkles,
    tone: 'text-[#3557ff] bg-[#3557ff]/12',
  },
  {
    id: 'sale-promo',
    group: 'paywall',
    kivviStatus: 'missing',
    titleUz: 'Chegirma / Aksiya Ekrani (SaleScreen)',
    titleRu: 'Экран акции (SaleScreen)',
    meta: 'new_year_endstate_promo · MAIN_new-years-endstate',
    layoutUz: '100dvh Page · oltin radial glow + firewerk',
    layoutRu: '100dvh Page · золотое свечение + фейерверк',
    icon: Sparkles,
    tone: 'text-[#f6b31f] bg-[#f6b31f]/15',
  },

  // 3) Tekshiruvlar, Xatolar va Ligalar
  {
    id: 'progress-intro',
    group: 'assessment',
    kivviStatus: 'needs_layout',
    titleUz: 'Bosqich tekshiruvi (Kirish)',
    titleRu: 'Проверка уровня (Вход)',
    meta: 'progress-check · MAIN_ProgressCheckIntro · 284×283',
    layoutUz: 'LevelCheckShell · Top Navbar + Karta 360px',
    layoutRu: 'LevelCheckShell · Верхний Navbar + Карта 360px',
    icon: Layers,
    tone: 'text-[#3557ff] bg-[#3557ff]/12',
  },
  {
    id: 'progress-endstate',
    group: 'assessment',
    kivviStatus: 'needs_layout',
    titleUz: 'Bosqich tekshiruvi (Natija)',
    titleRu: 'Проверка уровня (Итог)',
    meta: 'progress-check · MAIN_ProgressCheckEndstate · 244×244',
    layoutUz: 'LevelCheckShell (Hozir ResultsModalda 144px)',
    layoutRu: 'LevelCheckShell (в ResultsModal 144px)',
    icon: Award,
    tone: 'text-[#29cc57] bg-[#29cc57]/12',
  },
  {
    id: 'assessment-intro',
    group: 'assessment',
    kivviStatus: 'wired',
    titleUz: 'Kirish baholashi (Assessment)',
    titleRu: 'Входное тестирование (Assessment)',
    meta: 'level-check-assessment-intro · LevelCheckVM',
    layoutUz: 'LevelCheckShell · 260px sahna + 360px karta',
    layoutRu: 'LevelCheckShell · 260px сцена + 360px карта',
    icon: Layers,
    tone: 'text-[#3557ff] bg-[#3557ff]/12',
  },
  {
    id: 'level-check-transition',
    group: 'assessment',
    kivviStatus: 'wired',
    titleUz: 'Bosqichga o‘tish kristalli',
    titleRu: 'Кристалл перехода LevelCheck',
    meta: 'level-check · MAIN_LevelCheckTransition',
    layoutUz: 'LevelCheckShell · 260px sahna',
    layoutRu: 'LevelCheckShell · 260px сцена',
    icon: Sparkles,
    tone: 'text-[#9d62ff] bg-[#9d62ff]/12',
  },
  {
    id: 'warm-up',
    group: 'assessment',
    kivviStatus: 'wired',
    titleUz: 'Qizdirish mashqi (Warm-Up)',
    titleRu: 'Разминка (Warm-Up)',
    meta: 'level-check · MAIN_WarmUp · playWarmUp',
    layoutUz: 'LevelCheckShell · 260px sahna',
    layoutRu: 'LevelCheckShell · 260px сцена',
    icon: Flame,
    tone: 'text-[#ff8d23] bg-[#ff8d23]/12',
  },
  {
    id: 'review-mistakes',
    group: 'assessment',
    kivviStatus: 'needs_layout',
    titleUz: 'Xatolar ustida ishlash (LCR)',
    titleRu: 'Разбор ошибок (LCR)',
    meta: 'lcr-koji-transition · MAIN_ReviewMistakes',
    layoutUz: 'LevelCheckShell · 240px (Hozir XatolarPageda 56px)',
    layoutRu: 'LevelCheckShell · 240px (сейчас 56px)',
    icon: Sparkles,
    tone: 'text-[#ff4b6e] bg-[#ff4b6e]/12',
  },
  {
    id: 'recommended-level',
    group: 'assessment',
    kivviStatus: 'needs_layout',
    titleUz: 'Keyingi darajaga sakrash',
    titleRu: 'Переход на уровень выше',
    meta: 'endstates · MAIN_RecommendedLevelCheck',
    layoutUz: '100dvh · 50dvh RiveContainer + 2 CTA',
    layoutRu: '100dvh · 50dvh RiveContainer + 2 CTA',
    icon: Layers,
    tone: 'text-[#29cc57] bg-[#29cc57]/12',
  },
  {
    id: 'leagues',
    group: 'assessment',
    kivviStatus: 'needs_layout',
    titleUz: 'Liga ko‘tarilishi (Podium)',
    titleRu: 'Повышение в лиге (Podium)',
    meta: 'leagues-badges · 190px + 1s slide-up',
    layoutUz: 'Radial nur ustida badge + jadval ko‘tarilishi',
    layoutRu: 'Бейдж над свечением + таблица снизу',
    icon: Trophy,
    tone: 'text-[#f6b31f] bg-[#f6b31f]/15',
  },

  // 4) Dars Ichidagi Komponentlar (Tooltip, Speech Bubble, AI Tutor)
  {
    id: 'in-lesson-lightning',
    group: 'inlesson',
    kivviStatus: 'missing',
    titleUz: 'Dars ichidagi Chaqmoq Tooltip',
    titleRu: 'Внутриурочный Streak Tooltip',
    meta: 'lightning.6513fd63 · Streaks Tooltip Animation · 200×185px',
    layoutUz: 'Header ⚡ ustida Popover + onLightningExplode',
    layoutRu: 'Popover под ⚡ в хедере + onLightningExplode',
    icon: Zap,
    tone: 'text-[#b7dc00] bg-[#b7dc00]/15',
  },
  {
    id: 'koji-speech-bubble',
    group: 'inlesson',
    kivviStatus: 'missing',
    titleUz: 'Dars ichidagi Maslahat Pufagi',
    titleRu: 'Подсказка Koji Speech Bubble',
    meta: 'koji-speech-bubble · 260px Card + 180×180px Koji',
    layoutUz: 'Inline Speech Bubble + "speech-bubble" RiveEvent',
    layoutRu: 'Speech Bubble + событие "speech-bubble"',
    icon: MessageSquare,
    tone: 'text-[#29cc57] bg-[#29cc57]/12',
  },
  {
    id: 'ask-koji-ai',
    group: 'inlesson',
    kivviStatus: 'missing',
    titleUz: 'AskKoji AI Ustoz Widget',
    titleRu: 'AskKoji ИИ-репетитор',
    meta: 'ask_koji.410199b8 · AskKojiVM (52×52px FAB & Hero)',
    layoutUz: 'Floating 52×52 FAB / 160px Chat Header',
    layoutRu: 'Кнопка 52×52 / 160px аватар чата',
    icon: Bot,
    tone: 'text-[#9d62ff] bg-[#9d62ff]/12',
  },

  // 5) Kurs Xaritasi & Loaderlar
  {
    id: 'icp-node',
    group: 'maploaders',
    kivviStatus: 'wired',
    titleUz: 'Kurs Xaritasi Tugunlari (ICPNode & Klasik)',
    titleRu: 'Узлы карты курса (ICPNode & Classic)',
    meta: 'icp-node.add6a472 + koji-gameboard.e2320c48',
    layoutUz: 'Interaktiv Tugun Kartasi (Lock / Mastered / Koji)',
    layoutRu: 'Интерактивный узел карты',
    icon: Gamepad2,
    tone: 'text-[#3557ff] bg-[#3557ff]/12',
  },
  {
    id: 'level-insertion',
    group: 'maploaders',
    kivviStatus: 'wired',
    titleUz: 'Yangi Modul Kirishi (Intro)',
    titleRu: 'Вставка модуля (Intro)',
    meta: 'level-insertion-intro · SM: LevelHeader',
    layoutUz: '100dvh · Dinamik modul nomlari',
    layoutRu: '100dvh · Динамические названия модулей',
    icon: Layers,
    tone: 'text-[#3557ff] bg-[#3557ff]/12',
  },
  {
    id: 'level-insertion-acceptance',
    group: 'maploaders',
    kivviStatus: 'missing',
    titleUz: 'Modul Xaritaga Qabul Qilinishi',
    titleRu: 'Анимация добавления на карту',
    meta: 'level-insertion-acceptance · ICPLevelInsertion',
    layoutUz: '100dvh · Tugunlar ketma-ket ochilishi',
    layoutRu: '100dvh · Поочерёдное открытие узлов',
    icon: Layers,
    tone: 'text-[#29cc57] bg-[#29cc57]/12',
  },
  {
    id: 'lesson-loader',
    group: 'maploaders',
    kivviStatus: 'missing',
    titleUz: 'Dars va Warm-Up Yuklash Ekrani',
    titleRu: 'Экран загрузки урока и Warm-Up',
    meta: 'lesson_loader_apr_13_26 + lesson-loader.ac940c03',
    layoutUz: '100dvh Full-Screen Loader (LessonLoaderVM)',
    layoutRu: '100dvh Полноэкранный лоадер',
    icon: Loader2,
    tone: 'text-[#3557ff] bg-[#3557ff]/12',
  },
  {
    id: 'ondemand-loader',
    group: 'maploaders',
    kivviStatus: 'wired',
    titleUz: 'On-Demand Kurs Yuklanishi',
    titleRu: 'Загрузка On-Demand курса',
    meta: 'ondemand-gamified · 140px Entry/Exit',
    layoutUz: '100vh Full-Screen Center Loader',
    layoutRu: '100vh Полноэкранный лоадер',
    icon: Loader2,
    tone: 'text-[#29cc57] bg-[#29cc57]/12',
  },
  {
    id: 'master-loader',
    group: 'maploaders',
    kivviStatus: 'missing',
    titleUz: 'NUX Mavzu Tanlash Loaderi',
    titleRu: 'NUX лоадер темы (MasterLoader)',
    meta: 'nux_loaders.51875c1e · ShowTopicVM',
    layoutUz: '100dvh · Math / CS / Mantiq mavzu animatsiyasi',
    layoutRu: '100dvh · Анимация темы Math / CS / Logic',
    icon: Compass,
    tone: 'text-[#ff8d23] bg-[#ff8d23]/12',
  },

  // 6) Onboarding, Habit, RUX & Marketing
  {
    id: 'habit-screen',
    group: 'nuxrux',
    kivviStatus: 'missing',
    titleUz: 'Kunlik Odat Tanlash (HabitScreen)',
    titleRu: 'Выбор привычки (HabitScreen)',
    meta: 'endstates · MAIN_KojiSpeech (powerupOne/Two/Three)',
    layoutUz: '100dvh + 3 ta HueShift vaqt tugmasi (5/10/15m)',
    layoutRu: '100dvh + 3 карточки времени (5/10/15 мин)',
    icon: Flame,
    tone: 'text-[#ff8d23] bg-[#ff8d23]/12',
  },
  {
    id: 'koji-speech-steps',
    group: 'nuxrux',
    kivviStatus: 'missing',
    titleUz: 'Onboarding Karusel & Knowledge Graph',
    titleRu: 'Onboarding карусель и граф знаний',
    meta: 'nux-refresh + nux_revamp · 3-Step & 150×150 Speech',
    layoutUz: '3-qadamli ValueProps + MAIN_Koji-speech + Graph',
    layoutRu: '3-шаговая карусель + Speech + Граф знаний',
    icon: Compass,
    tone: 'text-[#9d62ff] bg-[#9d62ff]/12',
  },
  {
    id: 'nux-reactions',
    group: 'nuxrux',
    kivviStatus: 'missing',
    titleUz: 'Onboarding Savol Reaksiyalari & Kartalar',
    titleRu: 'Реакции Koji на опрос (NUX)',
    meta: 'nux_koji_reactions_v2 + nux-koji + nux-koji-onboarding',
    layoutUz: 'So‘rovnoma header reaksiyalari (4 ta artboard)',
    layoutRu: 'Реакции в заголовке опроса (4 артборда)',
    icon: Sparkles,
    tone: 'text-[#f6b31f] bg-[#f6b31f]/15',
  },
  {
    id: 'rux-reactivation',
    group: 'nuxrux',
    kivviStatus: 'missing',
    titleUz: 'Qaytish Ekrani (RUX Book & Briefcase)',
    titleRu: 'Экран возврата (RUX Book & Briefcase)',
    meta: 'rux_short_apr_22_26 + rux_long_apr_22_26 · 390×390px',
    layoutUz: '100vh Hero (390×390px) — 4 kun va 30 kun pauza',
    layoutRu: '100vh Hero (390×390px) — возврат в курс',
    icon: Briefcase,
    tone: 'text-[#3557ff] bg-[#3557ff]/12',
  },
  {
    id: 'jump-back-in',
    group: 'nuxrux',
    kivviStatus: 'wired',
    titleUz: 'Qolgan joydan davom etish',
    titleRu: 'Продолжить с места (Jump Back In)',
    meta: 'koji-jump-back-in.7a4d3c18 · RUX Jump back In',
    layoutUz: '100dvh · 50dvh RiveContainer',
    layoutRu: '100dvh · 50dvh RiveContainer',
    icon: Zap,
    tone: 'text-[#f6b31f] bg-[#f6b31f]/15',
  },
  {
    id: 'lohp-hero',
    group: 'nuxrux',
    kivviStatus: 'missing',
    titleUz: 'Bosh Sahifa Hero & Koji Entrance',
    titleRu: 'Главная страница Hero & Koji Entrance',
    meta: 'lohp-cta-koji-rive (LOHP_TOP) + lohp_koji_entrance',
    layoutUz: 'Marketing Hero & Scroll Entrance Banner',
    layoutRu: 'Маркетинг Hero & Секция Meet Koji',
    icon: Compass,
    tone: 'text-[#29cc57] bg-[#29cc57]/12',
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
  const [statusFilter, setStatusFilter] = useState<'all' | KivviStatus>('all')

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
        key: 'paywall' as const,
        title: lang === 'ru' ? '2. Paywall, Premium и Акции' : '2. Paywall, Premium va Aksiyalar',
        desc:
          lang === 'ru'
            ? 'Lock Bounce, Bar/Line графики, ResponsiveModal шторка и Post-Checkout.'
            : 'Lock Bounce, Bar/Line grafiklar, Bottom Sheet Drawer va Post-Checkout.',
      },
      {
        key: 'assessment' as const,
        title: lang === 'ru' ? '3. Проверки и Лиги (LevelCheck / Podium)' : '3. Tekshiruv va Ligalar',
        desc:
          lang === 'ru'
            ? 'Верхний navbar, карточки 360px и анимация подиума лиги.'
            : 'Tepa navbar, 360px kartalar va liga podium animatsiyasi.',
      },
      {
        key: 'inlesson' as const,
        title: lang === 'ru' ? '4. Внутри урока (Tooltip, Bubble, AskKoji AI)' : '4. Dars ichida (Tooltip, Pufak, AskKoji AI)',
        desc:
          lang === 'ru'
            ? 'Молния в хедере, реплики Koji и интерактивный ИИ-ассистент.'
            : 'Header chaqmoq popoveri, maslahat pufagi va jonli AI yordamchi.',
      },
      {
        key: 'maploaders' as const,
        title: lang === 'ru' ? '5. Карта курса и Лоадеры' : '5. Kurs xaritasi va Loaderlar',
        desc:
          lang === 'ru'
            ? 'Интерактивные узлы ICPNode, вставка модулей и экраны загрузки.'
            : 'Interaktiv Gameboard tugunlari, modul qo‘shilishi va loaderlar.',
      },
      {
        key: 'nuxrux' as const,
        title: lang === 'ru' ? '6. Onboarding, Привычки, RUX и Лендинг' : '6. Onboarding, Odat, RUX va Landing',
        desc:
          lang === 'ru'
            ? 'Выбор времени HabitScreen, 3-шаговая карусель, реакции и возврат RUX.'
            : 'Habit vaqt tanlash, 3-qadamli karusel, savol reaksiyalari va RUX.',
      },
    ],
    [lang],
  )

  const counts = useMemo(
    () => ({
      all: CATALOG.length,
      missing: CATALOG.filter((c) => c.kivviStatus === 'missing').length,
      needs_layout: CATALOG.filter((c) => c.kivviStatus === 'needs_layout').length,
      wired: CATALOG.filter((c) => c.kivviStatus === 'wired').length,
    }),
    [],
  )

  const hasTopHeaderOverlay =
    activeId === 'progress-intro' ||
    activeId === 'progress-endstate' ||
    activeId === 'review-mistakes' ||
    activeId === 'level-check-transition' ||
    activeId === 'assessment-intro' ||
    activeId === 'warm-up' ||
    activeId === 'in-lesson-lightning'

  return (
    <main className="min-h-[100dvh] bg-pcanvas text-pfg pb-12">
      <PageHeader
        title="Brilliant 1:1 Rive MVP"
        subtitle={
          lang === 'ru'
            ? `${CATALOG.length} сцен · все 37 .riv файлов на диске`
            : `${CATALOG.length} sahna · diskdagi barcha 37 ta .riv fayl`
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

      <div className="mx-auto max-w-[680px] px-4 pt-3 space-y-5">
        {/* Tezkor sinov va Audit xulosasi */}
        <section className="bg-pcard rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-[15px] font-extrabold text-pfg">
                {lang === 'ru' ? 'Полный аудит Rive в Brilliant' : 'Brilliant Rive to‘liq auditi'}
              </h2>
              <p className="text-[12px] text-pmuted">
                {lang === 'ru'
                  ? `Нет в KIVVI: ${counts.missing} · Мелкие в модалках: ${counts.needs_layout}`
                  : `KIVVIda hali yo‘q: ${counts.missing} · Modal/kichik: ${counts.needs_layout} · Bor: ${counts.wired}`}
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-[#3557ff]/12 px-2.5 py-1 text-[11px] font-bold text-pprimary">
              {CATALOG.length} {lang === 'ru' ? 'сцен' : 'sahna'}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <Button variant="primary" size="default" onClick={() => openScreen('lesson')}>
              {lang === 'ru' ? 'Урок + XP' : 'Dars + XP'}
            </Button>
            <Button variant="secondary" size="default" onClick={() => openScreen('in-lesson-lightning')}>
              {lang === 'ru' ? 'Молния / Tooltip' : 'Chaqmoq Tooltip'}
            </Button>
          </div>
        </section>

        {/* Holat bo'yicha filter tablar */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
          {[
            { id: 'all' as const, label: lang === 'ru' ? `Все (${counts.all})` : `Hammasi (${counts.all})` },
            { id: 'missing' as const, label: lang === 'ru' ? `Новые (${counts.missing})` : `KIVVIda yo‘q (${counts.missing})` },
            { id: 'needs_layout' as const, label: lang === 'ru' ? `Нужен 1:1 (${counts.needs_layout})` : `Modal/Kichik (${counts.needs_layout})` },
            { id: 'wired' as const, label: lang === 'ru' ? `Подключено (${counts.wired})` : `Ulangan (${counts.wired})` },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              className={cn(
                'shrink-0 rounded-full border px-3.5 py-1.5 text-[12px] font-bold transition-colors cursor-pointer',
                statusFilter === tab.id
                  ? 'border-pfg bg-pfg text-pcanvas'
                  : 'border-plineStrong bg-psurface text-pmuted',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Barcha 6 kategoriya */}
        {groups.map((grp) => {
          const items = CATALOG.filter(
            (i) => i.group === grp.key && (statusFilter === 'all' || i.kivviStatus === statusFilter),
          )
          if (items.length === 0) return null
          return (
            <section key={grp.key} className="space-y-2.5">
              <div className="px-1">
                <h2 className="text-[15px] font-extrabold text-pfg">{grp.title}</h2>
                <p className="text-[12px] text-pmuted">{grp.desc}</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {items.map((item) => {
                  const Icon = item.icon
                  const badge =
                    item.kivviStatus === 'missing'
                      ? {
                          text: lang === 'ru' ? 'Нет в KIVVI' : 'KIVVIda yo‘q',
                          cls: 'bg-[#ff4b6e]/14 text-[#ff4b6e]',
                        }
                      : item.kivviStatus === 'needs_layout'
                        ? {
                            text: lang === 'ru' ? 'Мелко / Шторка' : 'Modal / Kichik',
                            cls: 'bg-[#f6b31f]/18 text-[#d99300] dark:text-[#f6b31f]',
                          }
                        : {
                            text: lang === 'ru' ? 'Готово' : 'Ulangan',
                            cls: 'bg-[#29cc57]/15 text-[#1ca844] dark:text-[#29cc57]',
                          }
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
                        <div className="flex items-start justify-between gap-1.5">
                          <div className="text-[14px] font-bold text-pfg leading-snug">
                            {lang === 'ru' ? item.titleRu : item.titleUz}
                          </div>
                          <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[10px] font-extrabold', badge.cls)}>
                            {badge.text}
                          </span>
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
          {/* Tepada (yoki dars ichidagi chaqmoq uchun pastda) ixcham boshqaruv pill */}
          <div
            className={cn(
              'fixed right-3 z-[140] flex items-center gap-1.5',
              activeId === 'in-lesson-lightning'
                ? 'bottom-[calc(env(safe-area-inset-bottom,0px)+14px)]'
                : hasTopHeaderOverlay
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
                hasTopHeaderOverlay
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
