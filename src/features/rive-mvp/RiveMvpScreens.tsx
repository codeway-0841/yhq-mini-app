import { useEffect, useState } from 'react'
import { Flame, Lock, Sparkles, Trophy } from 'lucide-react'
import {
  BrilliantEndstateRive,
  type BrilliantLessonTrigger,
  type BrilliantPracticeTrigger,
  type BrilliantProgressTrigger,
} from '../../shared/components/BrilliantEndstateRive'
import {
  BrilliantExtrasRive,
  type BrilliantLeagueState,
} from '../../shared/components/BrilliantExtrasRive'
import {
  BrilliantChargeStage,
  BrilliantCompletionStage,
  BrilliantStreakStage,
} from '../../shared/components/BrilliantCompletionContent'
import { haptics } from '../../platform/haptics'
import { playSound } from '../../shared/lib/sounds'
import { cn } from '../../shared/lib/cn'
import {
  BrilliantCopyContainer,
  BrilliantEndstateShell,
  BrilliantLevelCheckShell,
  BrilliantRiveContainer,
} from './BrilliantEndstateShell'
import { MvpRiveStage } from './MvpRiveStage'
import { renderExtraMvpScreen, type ExtraMvpScreenId } from './ExtraBrilliantScreens'

export type MvpScreenId =
  | 'lesson'
  | 'practice'
  | 'streak'
  | 'charge'
  | 'rate-app'
  | 'premium-lock'
  | 'progress-intro'
  | 'progress-endstate'
  | 'leagues'
  | 'review-mistakes'
  | 'post-checkout'
  | 'recommended-level'
  | 'level-insertion'
  | 'lesson-loader'
  | 'jump-back-in'
  | ExtraMvpScreenId

export interface MvpScreenContext {
  lang: 'uz' | 'ru'
  dark: boolean
  nonce: number
  colorVariant: number
  lessonTrigger: BrilliantLessonTrigger
  lessonMode: 'lesson' | 'level' | 'mastered'
  practiceTrigger: BrilliantPracticeTrigger
  streakVariant: 0 | 1 | 2
  progressTrigger: BrilliantProgressTrigger
  leagueLevel: number
  leagueState: BrilliantLeagueState
  onEvent?: (eventName: string) => void
  onClose: () => void
  onReplay: () => void
}

/** 1. LessonComplete & 2. PracticeComplete (shared BrilliantCompletionStage 1:1) */
function ContentCompletionMvp({
  ctx,
  mode,
}: {
  ctx: MvpScreenContext
  mode: 'lesson' | 'practice'
}) {
  const { lang, dark, nonce, colorVariant, lessonTrigger, lessonMode, practiceTrigger, onEvent, onReplay } = ctx
  const allowXp = mode === 'lesson' || practiceTrigger !== 'playFailure'
  const earnedXp = mode === 'lesson' ? (lessonMode === 'level' ? 40 : 25) : practiceTrigger === 'play100' ? 30 : 20

  const heading =
    mode === 'lesson'
      ? lessonMode === 'mastered'
        ? lang === 'ru'
          ? 'Навык освоен!'
          : 'Mavzu mukammal egallandi!'
        : lessonMode === 'level'
          ? lang === 'ru'
            ? 'Уровень пройден!'
            : 'Bosqich yakunlandi!'
          : lang === 'ru'
            ? 'Урок завершён!'
            : 'Dars yakunlandi!'
      : practiceTrigger === 'playFailure'
        ? lang === 'ru'
          ? 'Хорошая попытка!'
          : 'Yaxshi urinish!'
        : practiceTrigger === 'play50Plus'
          ? lang === 'ru'
            ? 'Отличная практика!'
            : "A'lo mashq!"
          : lang === 'ru'
            ? 'Идеальный результат!'
            : 'Mukammal natija!'

  return (
    <BrilliantEndstateShell
      primaryLabel={lang === 'ru' ? 'Продолжить' : 'Davom etish'}
      onPrimaryClick={() => {
        playSound('click')
        haptics.impact('light')
        onReplay()
      }}
    >
      <BrilliantCompletionStage
        mode={mode}
        heading={heading}
        xpLabel={lang === 'ru' ? 'Всего XP' : 'Jami XP'}
        dark={dark}
        variant={colorVariant}
        nonce={nonce}
        lessonTrigger={lessonTrigger}
        isLevel={lessonMode === 'level'}
        levelNumber={3}
        skillCheckMastered={lessonMode === 'mastered'}
        practiceTrigger={practiceTrigger}
        practiceStats={
          mode === 'practice'
            ? {
                correct: practiceTrigger === 'play100' ? 20 : practiceTrigger === 'play50Plus' ? 16 : 7,
                wrong: practiceTrigger === 'play100' ? 0 : practiceTrigger === 'play50Plus' ? 4 : 13,
                total: 20,
                percent: practiceTrigger === 'play100' ? 100 : practiceTrigger === 'play50Plus' ? 80 : 35,
                isRu: lang === 'ru',
              }
            : undefined
        }
        showXp={allowXp}
        earnedXp={earnedXp}
        onRiveEvent={onEvent}
      />
    </BrilliantEndstateShell>
  )
}

/** 3. StreaksScreen (shared BrilliantStreakStage 1:1) */
function StreaksMvp({ ctx }: { ctx: MvpScreenContext }) {
  const { lang, dark, nonce, streakVariant, onEvent, onReplay } = ctx
  const [bgGlow, setBgGlow] = useState(false)
  const streakCount = streakVariant === 0 ? 1 : streakVariant === 2 ? 30 : 7

  const heading =
    streakVariant === 0
      ? lang === 'ru'
        ? 'Вы начали серию!'
        : 'Siz seriyani boshladingiz!'
      : streakVariant === 2
        ? lang === 'ru'
          ? '30 дней подряд!'
          : '30 kunlik marra!'
        : lang === 'ru'
          ? 'Серия продлена!'
          : 'Seriya davom etmoqda!'

  return (
    <BrilliantEndstateShell
      primaryLabel={lang === 'ru' ? 'Продолжить' : 'Davom etish'}
      viewportClassName={bgGlow ? 'brilliant-streak-bg-glow' : undefined}
      onPrimaryClick={() => {
        playSound('click')
        haptics.impact('light')
        onReplay()
      }}
    >
      <BrilliantStreakStage
        streak={streakCount}
        heading={heading}
        lang={lang}
        dark={dark}
        variant={streakVariant}
        nonce={nonce}
        onGlowChange={setBgGlow}
        onRiveEvent={onEvent}
      />
    </BrilliantEndstateShell>
  )
}

/** 4. StreakChargesScreen (shared BrilliantChargeStage 1:1) */
function StreakChargeMvp({ ctx }: { ctx: MvpScreenContext }) {
  const { lang, dark, nonce, onEvent, onReplay } = ctx
  return (
    <BrilliantEndstateShell
      primaryLabel={lang === 'ru' ? 'Супер!' : "Zo'r!"}
      onPrimaryClick={() => {
        playSound('click')
        onReplay()
      }}
    >
      <BrilliantChargeStage
        heading={lang === 'ru' ? 'Вы получили Заморозку серии!' : 'Seriya himoyasi qo‘lga kiritildi!'}
        description={
          lang === 'ru'
            ? 'Если пропустите день, заморозка автоматически сохранит ваш ударный режим.'
            : 'Biror kun dars o‘tkazib yuborsangiz, zaryad seriyangizni avtomatik saqlab qoladi.'
        }
        dark={dark}
        nonce={nonce}
        onRiveEvent={onEvent}
      />
    </BrilliantEndstateShell>
  )
}

/** 5. ReviewPromptScreen (MAIN_RateTheApp — 2hkhikiuvwkb8.js: Fullscreen Layout!) */
function RateAppMvp({ ctx }: { ctx: MvpScreenContext }) {
  const { lang, dark, nonce, onEvent, onReplay, onClose } = ctx
  return (
    <BrilliantEndstateShell
      primaryLabel={lang === 'ru' ? 'Оценить сейчас' : 'Hozir baholash'}
      secondaryLabel={lang === 'ru' ? 'Не сейчас' : 'Keyinroq'}
      onPrimaryClick={() => {
        playSound('success')
        haptics.notify('success')
        onReplay()
      }}
      onSecondaryClick={() => {
        playSound('click')
        onClose()
      }}
    >
      <BrilliantRiveContainer className="aspect-[353/243]">
        <BrilliantEndstateRive
          kind="rate-app"
          dark={dark}
          nonce={nonce}
          label="Rate KIVVI"
          className="size-full"
          onRiveEvent={onEvent}
        />
      </BrilliantRiveContainer>
      <BrilliantCopyContainer className="gap-4">
        <h1 className="text-[24px] sm:text-[26px] font-extrabold text-pfg">
          {lang === 'ru' ? 'Нравится KIVVI?' : 'KIVVI yoqyaptimi?'}
        </h1>
        <p className="text-[15px] leading-relaxed text-pmuted">
          {lang === 'ru'
            ? 'Уделите секунду и оцените нас — это помогает развивать платформу!'
            : 'Bir soniya vaqt ajratib bizni baholang — bu platformani rivojlantirishga yordam beradi!'}
        </p>
      </BrilliantCopyContainer>
    </BrilliantEndstateShell>
  )
}

/** 6. ContentMeterScreen (MAIN_premium-nudge / PremiumNudgeLockBounce) */
function PremiumLockMvp({ ctx }: { ctx: MvpScreenContext }) {
  const { lang, dark, nonce, onEvent, onReplay, onClose } = ctx
  const [headerShown, setHeaderShown] = useState(false)

  useEffect(() => {
    setHeaderShown(false)
    const fallback = setTimeout(() => setHeaderShown(true), 2200)
    return () => clearTimeout(fallback)
  }, [nonce])

  return (
    <BrilliantEndstateShell
      viewportClassName="brilliant-iridescent-flipped"
      footerBgClassName="bg-transparent backdrop-blur-md"
      primaryLabel={lang === 'ru' ? 'Попробовать Premium' : 'Premiumni yoqish'}
      secondaryLabel={lang === 'ru' ? 'Продолжить бесплатно' : 'Bepul davom etish'}
      onPrimaryClick={() => {
        playSound('achievement')
        haptics.impact('medium')
        onReplay()
      }}
      onSecondaryClick={() => {
        playSound('click')
        onClose()
      }}
    >
      <BrilliantRiveContainer className="aspect-square">
        <BrilliantEndstateRive
          kind="premium-lock"
          dark={dark}
          nonce={nonce}
          label="Premium Lock Bounce"
          className="size-full"
          onRiveEvent={(name) => {
            onEvent?.(name)
            if (name === 'Play_Text and BG') {
              setHeaderShown(true)
              playSound('chime')
            }
          }}
        />
      </BrilliantRiveContainer>

      {headerShown && (
        <BrilliantCopyContainer className="brilliant-upsell-copy-in justify-center gap-3">
          <h1 className="text-[24px] lg:text-[30px] font-extrabold leading-tight text-pfg">
            {lang === 'ru'
              ? 'Дневной лимит бесплатных уроков исчерпан'
              : 'Bugungi bepul darslar limiti tugadi'}
          </h1>
          <p className="text-[16px] leading-relaxed text-pmuted">
            <strong className="font-bold text-pprimary">Premium</strong>{' '}
            {lang === 'ru'
              ? 'открывает полный доступ ко всем курсам и ИИ-тестам.'
              : 'bilan barcha fanlar va AI testlarga cheklovsiz ruxsat oling.'}
          </p>
        </BrilliantCopyContainer>
      )}
    </BrilliantEndstateShell>
  )
}

/** 7 & 8. ProgressCheckIntro & ProgressCheckEndstate (2r5aem_zhr2z1.js) */
function ProgressCheckMvp({
  ctx,
  phase,
}: {
  ctx: MvpScreenContext
  phase: 'intro' | 'endstate'
}) {
  const { lang, dark, nonce, colorVariant, progressTrigger, onEvent, onReplay, onClose } = ctx
  const isEndstate = phase === 'endstate'
  const scorePct =
    progressTrigger === 'playMastered' ? 100 : progressTrigger === 'playPassed' ? 80 : 40

  return (
    <BrilliantLevelCheckShell
      title={lang === 'ru' ? 'Проверка уровня' : 'Daraja tekshiruvi'}
      progressPercent={isEndstate ? 100 : 25}
      onClose={onClose}
      primaryLabel={
        isEndstate
          ? lang === 'ru'
            ? 'Продолжить курс'
            : 'Kursni davom ettirish'
          : lang === 'ru'
            ? 'Начать проверку'
            : 'Tekshiruvni boshlash'
      }
      secondaryLabel={isEndstate ? (lang === 'ru' ? 'Повторить ошибки' : 'Xatolarni ko‘rish') : undefined}
      onPrimaryClick={() => {
        playSound('success')
        onReplay()
      }}
      onSecondaryClick={isEndstate ? onClose : undefined}
    >
      {/* Brilliant exact pixel stages: Intro 284x283 (md 355x354), Endstate 244x244 (md 284x283) */}
      <div
        className={cn(
          'relative mx-auto shrink-0',
          isEndstate
            ? 'size-[244px] md:w-[284px] md:h-[283px]'
            : 'w-[284px] h-[283px] md:w-[355px] md:h-[354px]',
        )}
      >
        <BrilliantEndstateRive
          kind={isEndstate ? 'progress-endstate' : 'progress-intro'}
          variant={
            isEndstate && progressTrigger === 'playPoor'
              ? 2
              : isEndstate && progressTrigger === 'playMastered'
                ? 4
                : colorVariant
          }
          progressTrigger={progressTrigger}
          dark={dark}
          nonce={nonce}
          label="Progress Check"
          className="size-full"
          onRiveEvent={onEvent}
        />
      </div>

      {/* Brilliant Card (w: 360px, maxW: full, borderRadius: 2xl, borderWidth: 2px, padding: 6) */}
      <div className="bg-pcard w-full max-w-[360px] rounded-2xl p-6 text-center space-y-2">
        <h2 className="text-[20px] font-extrabold text-pfg">
          {!isEndstate
            ? lang === 'ru'
              ? 'Проверим ваши знания!'
              : 'Bilimingizni tekshiramiz!'
            : progressTrigger === 'playMastered'
              ? lang === 'ru'
                ? 'Уровень освоен на 100%!'
                : 'Bosqich 100% zabt etildi!'
              : progressTrigger === 'playPassed'
                ? lang === 'ru'
                  ? 'Отлично! Проверка пройдена'
                  : 'Ajoyib! Sinovdan o‘tdingiz'
                : lang === 'ru'
                  ? 'Стоит повторить тему'
                  : 'Mavzuni qayta ko‘rib chiqamiz'}
        </h2>
        <p className="text-[14px] text-pmuted leading-relaxed">
          {isEndstate
            ? lang === 'ru'
              ? `Результат: ${scorePct}% · Награда: +${scorePct >= 70 ? 50 : 10} XP`
              : `Natija: ${scorePct}% · Mukofot: +${scorePct >= 70 ? 50 : 10} XP`
            : lang === 'ru'
              ? '5 быстрых вопросов помогут определить ваш текущий уровень.'
              : '5 ta tezkor savol hozirgi bilim darajangizni aniqlab beradi.'}
        </p>
      </div>
    </BrilliantLevelCheckShell>
  )
}

/** 9. LeaguesScreen (36qja4cbbolyk.js — 190px badge over radial glow + 1s slide-up leaderboard) */
function LeaguesMvp({ ctx }: { ctx: MvpScreenContext }) {
  const { lang, dark, nonce, leagueLevel, leagueState, onReplay } = ctx
  const [slidUp, setSlidUp] = useState(false)
  const [boardShown, setBoardShown] = useState(false)

  useEffect(() => {
    setSlidUp(false)
    setBoardShown(false)
    const t1 = setTimeout(() => setSlidUp(true), 1000)
    const t2 = setTimeout(() => setBoardShown(true), 1150)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [nonce, leagueLevel, leagueState])

  const leagueNamesUz = ['Bronza', 'Kumush', 'Oltin', 'Sapfir', 'Zumrad', 'Rubin', 'Ametist', 'Marvarid', 'Obsidian', 'Olmos']
  const leagueNamesRu = ['Бронза', 'Серебро', 'Золото', 'Сапфир', 'Изумруд', 'Рубин', 'Аметист', 'Жемчуг', 'Обсидиан', 'Алмаз']
  const tierName = (lang === 'ru' ? leagueNamesRu : leagueNamesUz)[Math.max(0, Math.min(9, leagueLevel - 1))]

  const rows = [
    { rank: 1, name: 'Azizbek T.', xp: 640, me: false },
    { rank: 2, name: lang === 'ru' ? 'Вы' : 'Siz', xp: 590, me: true },
    { rank: 3, name: 'Madina K.', xp: 520, me: false },
    { rank: 4, name: 'Sardor R.', xp: 475, me: false },
  ]

  return (
    <BrilliantEndstateShell
      primaryLabel={lang === 'ru' ? 'Продолжить' : 'Davom etish'}
      onPrimaryClick={() => {
        playSound('achievement')
        onReplay()
      }}
    >
      <div
        className="flex flex-col items-center transition-transform duration-700 ease-out"
        style={{ transform: slidUp ? 'translateY(0%)' : 'translateY(28%)' }}
      >
        {/* Radial glow + absolute top badge */}
        <div className="relative mx-auto flex w-full max-w-[536px] flex-col items-center px-4">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-[120px] left-1/2 h-[340px] w-[520px] -translate-x-1/2 rounded-full opacity-55"
            style={{
              background:
                leagueState === 'demote'
                  ? 'radial-gradient(circle, rgba(148,163,184,0.22) 0%, transparent 68%)'
                  : 'radial-gradient(circle, rgba(246,179,31,0.28) 0%, rgba(53,87,255,0.12) 45%, transparent 72%)',
            }}
          />
          <div className="relative z-10 mt-6 size-[190px] lg:size-[250px]">
            <BrilliantExtrasRive
              kind="league"
              leagueLevel={leagueLevel}
              leagueState={leagueState}
              dark={dark}
              nonce={nonce}
              label={`League ${tierName}`}
              className="size-full"
            />
          </div>
        </div>

        {/* Leaderboard Fade in 800ms */}
        <div
          className="mt-4 w-full max-w-[393px] px-4 space-y-3 transition-opacity duration-700 ease-out"
          style={{ opacity: boardShown ? 1 : 0 }}
        >
          <div className="text-center space-y-1">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-psurface px-3 py-1 text-[12px] font-bold text-pfg">
              <Trophy size={13} className="text-[#f6b31f]" />
              {tierName} {lang === 'ru' ? 'лига' : 'ligasi'} ({leagueLevel}/10)
            </span>
            <h1 className="text-[22px] font-extrabold text-pfg">
              {leagueState === 'promote'
                ? lang === 'ru'
                  ? 'Повышение в лиге!'
                  : 'Yangi ligaga ko‘tarildingiz!'
                : leagueState === 'demote'
                  ? lang === 'ru'
                    ? 'Лига обновилась'
                    : 'Liga yangilandi'
                  : lang === 'ru'
                    ? 'Вы удержались в лиге!'
                    : 'Ligada o‘rningizni saqladingiz!'}
            </h1>
          </div>

          <div className="bg-pcard rounded-2xl overflow-hidden divide-y divide-pline">
            {rows.map((r) => (
              <div
                key={r.rank}
                className={cn(
                  'flex items-center justify-between px-4 py-2.5 text-[14px]',
                  r.me && 'bg-[#3557ff]/12 font-bold text-pfg',
                )}
              >
                <div className="flex items-center gap-3">
                  <span className="w-5 text-center font-extrabold text-pmuted">{r.rank}</span>
                  <span>{r.name}</span>
                </div>
                <span className="font-bold text-[#29cc57] tabular-nums">{r.xp} XP</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </BrilliantEndstateShell>
  )
}

/** 10. LessonLoader standalone (`lesson_loader_apr_13_26.riv` & `lesson-loader.ac940c03.riv`) */
function LessonLoaderMvp({ ctx }: { ctx: MvpScreenContext }) {
  const { lang, dark, nonce, colorVariant, onEvent, onReplay, onClose } = ctx
  const [loaderKind, setLoaderKind] = useState<'lesson' | 'warmup'>('lesson')

  return (
    <BrilliantEndstateShell
      primaryLabel={
        loaderKind === 'lesson'
          ? lang === 'ru'
            ? 'Показать Warm-Up Loader'
            : 'Warm-Up Loader ni ko‘rish'
          : lang === 'ru'
            ? 'Показать Lesson Loader'
            : 'Lesson Loader ni ko‘rish'
      }
      secondaryLabel={lang === 'ru' ? 'Назад' : 'Orqaga'}
      onPrimaryClick={() => {
        setLoaderKind((k) => (k === 'lesson' ? 'warmup' : 'lesson'))
        onReplay()
      }}
      onSecondaryClick={onClose}
    >
      <BrilliantRiveContainer className="aspect-square">
        {loaderKind === 'lesson' ? (
          <MvpRiveStage
            file="lesson_loader_apr_13_26.riv"
            artboard="MAIN_Lesson Loader"
            stateMachine="LessonLoader"
            viewModel="LessonLoaderVM"
            booleans={{ darkMode: dark, level: false }}
            numbers={{ color: colorVariant }}
            vmTriggers={['enter']}
            dark={dark}
            nonce={nonce}
            label="Lesson Loader"
            className="size-full"
            onRiveEvent={onEvent}
          />
        ) : (
          <MvpRiveStage
            file="lesson-loader.ac940c03.riv"
            artboard="MAIN_practice-warm-up-loader"
            stateMachine="practice-loader"
            dark={dark}
            nonce={nonce}
            label="Warm-Up Loader"
            className="size-full"
            onRiveEvent={onEvent}
          />
        )}
      </BrilliantRiveContainer>
      <BrilliantCopyContainer>
        <h1 className="text-[22px] font-extrabold text-pfg">
          {loaderKind === 'lesson'
            ? lang === 'ru'
              ? 'Подбираем задания для вас…'
              : 'Siz uchun topshiriqlar tayyorlanmoqda…'
            : lang === 'ru'
              ? 'Готовим разминку…'
              : 'Qizdirish mashqi yuklanmoqda…'}
        </h1>
        <p className="text-[14px] text-pmuted">
          {loaderKind === 'lesson'
            ? 'lesson_loader_apr_13_26.riv · LessonLoaderVM (enter)'
            : 'lesson-loader.ac940c03.riv · practice-loader'}
        </p>
      </BrilliantCopyContainer>
    </BrilliantEndstateShell>
  )
}

/** Qolgan barcha Brilliant ekranlar uchun 1:1 Layout adapteri */
function GenericEndstateMvp({
  ctx,
  screenId,
}: {
  ctx: MvpScreenContext
  screenId:
    | 'review-mistakes'
    | 'post-checkout'
    | 'recommended-level'
    | 'level-insertion'
    | 'lesson-loader'
    | 'jump-back-in'
}) {
  const { lang, dark, nonce, colorVariant, onEvent, onReplay, onClose } = ctx

  if (screenId === 'review-mistakes') {
    return (
      <BrilliantLevelCheckShell
        title={lang === 'ru' ? 'Работа над ошибками' : 'Xatolar ustida ishlash'}
        progressPercent={60}
        onClose={onClose}
        primaryLabel={lang === 'ru' ? 'Разобрать ошибки' : 'Xatolarni tuzatish'}
        onPrimaryClick={() => {
          playSound('click')
          onReplay()
        }}
      >
        <div className="size-[240px] sm:size-[280px]">
          <BrilliantEndstateRive
            kind="review-mistakes"
            variant={colorVariant}
            correctNum={4}
            totalNum={5}
            dark={dark}
            nonce={nonce}
            label="Review Mistakes"
            className="size-full"
            onRiveEvent={onEvent}
          />
        </div>
        <div className="bg-pcard w-full max-w-[360px] rounded-2xl p-6 text-center space-y-2">
          <h2 className="text-[22px] font-extrabold text-pfg">
            {lang === 'ru' ? '4 из 5 верно!' : '5 tadan 4 tasi to‘g‘ri!'}
          </h2>
          <p className="text-[14px] text-pmuted">
            {lang === 'ru'
              ? 'Исправьте оставшуюся ошибку, чтобы закрепить материал на 100%.'
              : 'Mavzuni 100% mustahkamlash uchun qolgan xatoni birga ko‘rib chiqamiz.'}
          </p>
        </div>
      </BrilliantLevelCheckShell>
    )
  }

  if (screenId === 'post-checkout') {
    return (
      <BrilliantEndstateShell
        viewportClassName="brilliant-iridescent-flipped"
        footerBgClassName="bg-transparent"
        primaryLabel={lang === 'ru' ? 'Начать обучение' : 'O‘rganishni boshlash'}
        onPrimaryClick={() => {
          playSound('win')
          haptics.notify('success')
          onReplay()
        }}
      >
        <BrilliantRiveContainer className="aspect-square">
          <MvpRiveStage
            file="post_checkout_apr_01_26.riv"
            artboard="MAIN_PostCheckoutFlow"
            stateMachine="PostCheckoutFlow"
            viewModel="PostCheckoutFlowVM"
            booleans={{ darkMode: dark, text: false }}
            numbers={{ copyVariation: 0 }}
            vmTriggers={['playAnimation']}
            dark={dark}
            nonce={nonce}
            label="Post Checkout Pro"
            className="size-full"
            onRiveEvent={onEvent}
          />
        </BrilliantRiveContainer>
        <BrilliantCopyContainer>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#3557ff]/15 px-3 py-1 text-[12px] font-bold text-pprimary">
            <Sparkles size={13} /> KIVVI PRO
          </span>
          <h1 className="text-[26px] font-extrabold text-pfg">
            {lang === 'ru' ? 'Добро пожаловать в Premium!' : 'Premiumga xush kelibsiz!'}
          </h1>
          <p className="text-[15px] text-pmuted">
            {lang === 'ru'
              ? 'Все курсы, тренажёры и ИИ-разборы теперь полностью открыты.'
              : 'Barcha darsliklar, testlar va AI tushuntirishlar endi to‘liq ochiq.'}
          </p>
        </BrilliantCopyContainer>
      </BrilliantEndstateShell>
    )
  }

  if (screenId === 'lesson-loader') {
    return <LessonLoaderMvp ctx={ctx} />
  }

  if (screenId === 'level-insertion') {
    return (
      <BrilliantEndstateShell
        primaryLabel={lang === 'ru' ? 'Посмотреть карту' : 'Xaritani ko‘rish'}
        secondaryLabel={lang === 'ru' ? 'Позже' : 'Keyinroq'}
        onPrimaryClick={() => {
          playSound('click')
          onReplay()
        }}
        onSecondaryClick={onClose}
      >
        <BrilliantRiveContainer className="aspect-square">
          <MvpRiveStage
            file="level-insertion-intro.fb376b71.riv"
            artboard="MAIN_LevelInsertionIntro"
            stateMachine="LevelInsertionIntro"
            viewModel="LevelInsertionIntroVM"
            booleans={{ darkMode: dark, isTalking: false }}
            numbers={{ color: colorVariant, numberOfSkills1to4: 3 }}
            strings={{
              levelTitle: lang === 'ru' ? 'Алгебра II' : 'Algebra II',
              skillTitle01: lang === 'ru' ? 'Функции' : 'Funksiyalar',
              skillTitle02: lang === 'ru' ? 'Графики' : 'Grafiklar',
              skillTitle03: lang === 'ru' ? 'Уравнения' : 'Tenglamalar',
            }}
            vmTriggers={['playAnimation']}
            dark={dark}
            nonce={nonce}
            label="Level Insertion Intro"
            className="size-full"
            onRiveEvent={onEvent}
          />
        </BrilliantRiveContainer>
        <BrilliantCopyContainer>
          <h1 className="text-[24px] sm:text-[26px] font-extrabold text-pfg">
            {lang === 'ru' ? 'Добавлен новый модуль!' : 'Yangi modul qo‘shildi!'}
          </h1>
          <p className="text-[15px] text-pmuted leading-relaxed">
            {lang === 'ru'
              ? 'Специально подобранные уроки встроены в ваш план обучения.'
              : 'Bilimingizga mos yangi darslar o‘quv xaritangizga joylashtirildi.'}
          </p>
        </BrilliantCopyContainer>
      </BrilliantEndstateShell>
    )
  }

  const copyMap = {
    'recommended-level': {
      kind: 'recommended-level' as const,
      title: lang === 'ru' ? 'Перейти на уровень выше?' : 'Yuqori bosqichga sakraymizmi?',
      body:
        lang === 'ru'
          ? 'Пройдите быстрый чек и откройте более сложные задания сразу.'
          : 'Tezkor sinovdan o‘ting va keyingi daraja darslarini darhol oching.',
      cta: lang === 'ru' ? 'Пройти проверку' : 'Sinovni boshlash',
    },
    'jump-back-in': {
      kind: 'recommended-level' as const,
      title: lang === 'ru' ? 'Продолжим с того же места!' : 'Qolgan joydan davom etamiz!',
      body:
        lang === 'ru'
          ? 'До завершения текущего модуля осталось всего 2 урока.'
          : 'Joriy modulni tugatishga atigi 2 ta dars qoldi.',
      cta: lang === 'ru' ? 'Продолжить урок' : 'Darsni davom ettirish',
    },
  }
  const c = copyMap[screenId]

  return (
    <BrilliantEndstateShell
      primaryLabel={c.cta}
      secondaryLabel={lang === 'ru' ? 'Позже' : 'Keyinroq'}
      onPrimaryClick={() => {
        playSound('click')
        onReplay()
      }}
      onSecondaryClick={onClose}
    >
      <BrilliantRiveContainer className="aspect-square">
        {screenId === 'jump-back-in' ? (
          <BrilliantExtrasRive
            kind="jump-back-in"
            dark={dark}
            nonce={nonce}
            label={c.title}
            className="size-full"
          />
        ) : (
          <BrilliantEndstateRive
            kind={c.kind}
            variant={colorVariant}
            dark={dark}
            nonce={nonce}
            label={c.title}
            className="size-full"
            onRiveEvent={onEvent}
          />
        )}
      </BrilliantRiveContainer>
      <BrilliantCopyContainer>
        <h1 className="text-[24px] sm:text-[26px] font-extrabold text-pfg">{c.title}</h1>
        <p className="text-[15px] text-pmuted leading-relaxed">{c.body}</p>
      </BrilliantCopyContainer>
    </BrilliantEndstateShell>
  )
}

/** Tanlangan ekran bo'yicha to'liq 1:1 Brilliant sahifani chizadi */
export function renderMvpScreen(id: MvpScreenId, ctx: MvpScreenContext) {
  switch (id) {
    case 'lesson':
      return <ContentCompletionMvp ctx={ctx} mode="lesson" />
    case 'practice':
      return <ContentCompletionMvp ctx={ctx} mode="practice" />
    case 'streak':
      return <StreaksMvp ctx={ctx} />
    case 'charge':
      return <StreakChargeMvp ctx={ctx} />
    case 'rate-app':
      return <RateAppMvp ctx={ctx} />
    case 'premium-lock':
      return <PremiumLockMvp ctx={ctx} />
    case 'progress-intro':
      return <ProgressCheckMvp ctx={ctx} phase="intro" />
    case 'progress-endstate':
      return <ProgressCheckMvp ctx={ctx} phase="endstate" />
    case 'leagues':
      return <LeaguesMvp ctx={ctx} />
    case 'review-mistakes':
    case 'post-checkout':
    case 'recommended-level':
    case 'level-insertion':
    case 'lesson-loader':
    case 'jump-back-in':
      return <GenericEndstateMvp ctx={ctx} screenId={id} />
    default:
      return renderExtraMvpScreen(id, ctx)
  }
}

export const MVP_CATALOG_ICONS = {
  Flame,
  Lock,
  Sparkles,
  Trophy,
}
