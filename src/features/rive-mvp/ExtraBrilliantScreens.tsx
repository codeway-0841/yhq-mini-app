import { useEffect, useState } from 'react'
import { Flame, Lock, Sparkles, Zap } from 'lucide-react'
import { Button } from '../../shared/components/ui/button'
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

export type ExtraMvpScreenId =
  | 'opt-in'
  | 'premium-bar'
  | 'premium-line'
  | 'personalized-practice'
  | 'practice-nudge-modal'
  | 'sale-promo'
  | 'review-complete'
  | 'level-check-transition'
  | 'assessment-intro'
  | 'warm-up'
  | 'practice-tray'
  | 'in-lesson-lightning'
  | 'koji-speech-bubble'
  | 'ask-koji-ai'
  | 'icp-node'
  | 'level-insertion-acceptance'
  | 'ondemand-loader'
  | 'master-loader'
  | 'habit-screen'
  | 'koji-speech-steps'
  | 'nux-reactions'
  | 'rux-reactivation'
  | 'lohp-hero'

export interface ExtraMvpCtx {
  lang: 'uz' | 'ru'
  dark: boolean
  nonce: number
  colorVariant: number
  onEvent?: (name: string) => void
  onClose: () => void
  onReplay: () => void
}

/** 1) Push Opt-In (`Opt-In` SM: `OptIn` VM: `OptInVM`) */
function OptInMvp({ ctx }: { ctx: ExtraMvpCtx }) {
  const { lang, dark, nonce, onEvent, onReplay, onClose } = ctx
  return (
    <BrilliantEndstateShell
      primaryLabel={lang === 'ru' ? 'Включить уведомления' : 'Eslatmalarni yoqish'}
      secondaryLabel={lang === 'ru' ? 'Не сейчас' : 'Keyinroq'}
      onPrimaryClick={() => {
        playSound('success')
        haptics.notify('success')
        onReplay()
      }}
      onSecondaryClick={onClose}
    >
      <BrilliantRiveContainer className="aspect-square">
        <MvpRiveStage
          file="push_opt_in_apr_22_26.riv"
          artboard="Opt-In"
          stateMachine="OptIn"
          viewModel="OptInVM"
          vmTriggers={['playAnimation']}
          dark={dark}
          nonce={nonce}
          label="Push Opt-In"
          className="size-full"
          onRiveEvent={onEvent}
        />
      </BrilliantRiveContainer>
      <BrilliantCopyContainer>
        <h1 className="text-[24px] sm:text-[26px] font-extrabold text-pfg">
          {lang === 'ru' ? 'Достигайте цели с напоминаниями' : 'Eslatmalar bilan maqsadga tezroq yeting'}
        </h1>
        <p className="text-[15px] text-pmuted leading-relaxed">
          {lang === 'ru'
            ? 'Включите push-уведомления — мы поможем не потерять серию.'
            : 'Bildirishnomalarni yoqing — kundalik seriyangizni saqlashga yordam beramiz.'}
        </p>
      </BrilliantCopyContainer>
    </BrilliantEndstateShell>
  )
}

/** 2) Premium BarGraph / LineChart Endstates (`MAIN_premium-nudge`) */
function PremiumChartNudgeMvp({
  ctx,
  variant,
}: {
  ctx: ExtraMvpCtx
  variant: 'bar' | 'line'
}) {
  const { lang, dark, nonce, onEvent, onReplay, onClose } = ctx
  const [headerShown, setHeaderShown] = useState(false)

  useEffect(() => {
    setHeaderShown(false)
    const t = setTimeout(() => setHeaderShown(true), 2000)
    return () => clearTimeout(t)
  }, [nonce, variant])

  const sm = variant === 'bar' ? 'PremiumNudgeBarGraph' : 'PremiumNudgeLineChart'
  return (
    <BrilliantEndstateShell
      viewportClassName="brilliant-iridescent-flipped"
      footerBgClassName="bg-transparent backdrop-blur-md"
      primaryLabel={lang === 'ru' ? 'Открыть Premium' : 'Premiumga o‘tish'}
      secondaryLabel={lang === 'ru' ? 'Пропустить' : 'O‘tkazib yuborish'}
      onPrimaryClick={() => {
        playSound('achievement')
        onReplay()
      }}
      onSecondaryClick={onClose}
    >
      <BrilliantRiveContainer className="aspect-square">
        <MvpRiveStage
          file="endstates.e233a7c3.riv"
          artboard="MAIN_premium-nudge"
          stateMachine={sm}
          viewModel="PremiumNudgeVM"
          booleans={{ darkMode: dark }}
          vmTriggers={['playAnimation']}
          dark={dark}
          nonce={nonce}
          label={sm}
          className="size-full"
          onRiveEvent={(ev) => {
            onEvent?.(ev)
            if (ev === 'Play_Text and BG') {
              setHeaderShown(true)
              playSound('chime')
            }
          }}
        />
      </BrilliantRiveContainer>
      {headerShown && (
        <BrilliantCopyContainer className="brilliant-upsell-copy-in justify-center gap-3">
          <h1 className="text-[24px] lg:text-[28px] font-extrabold text-pfg">
            {variant === 'bar'
              ? lang === 'ru'
                ? 'Учитесь в 3× эффективнее с Premium'
                : 'Premium bilan 3× tezroq o‘rganing'
              : lang === 'ru'
                ? 'Стабильный рост результатов каждый день'
                : 'Har kuni barqaror o‘sish grafigi'}
          </h1>
          <p className="text-[15px] text-pmuted leading-relaxed">
            {lang === 'ru'
              ? 'Неограниченный доступ ко всем интерактивным модулям и ИИ-тестам.'
              : 'Barcha interaktiv modullar, xatolar tahlili va AI testlar cheklovsiz.'}
          </p>
        </BrilliantCopyContainer>
      )}
    </BrilliantEndstateShell>
  )
}

/** 3) Personalized Practice Fullscreen (`endstates.e233a7c3.riv`) */
function PersonalizedPracticeFullscreenMvp({ ctx }: { ctx: ExtraMvpCtx }) {
  const { lang, dark, nonce, onEvent, onReplay, onClose } = ctx
  return (
    <BrilliantEndstateShell
      viewportClassName="brilliant-iridescent-flipped"
      footerBgClassName="bg-transparent backdrop-blur-md"
      primaryLabel={lang === 'ru' ? 'Начать практику' : 'Shaxsiy mashqni boshlash'}
      secondaryLabel={lang === 'ru' ? 'Позже' : 'Keyinroq'}
      onPrimaryClick={onReplay}
      onSecondaryClick={onClose}
    >
      <BrilliantRiveContainer className="aspect-square">
        <MvpRiveStage
          file="endstates.e233a7c3.riv"
          artboard="MAIN_personalized-practice-nudge"
          stateMachine="PersonalizedPracticeNudge"
          viewModel="PersonalizedPracticeNudgeVM"
          booleans={{ darkMode: dark }}
          vmTriggers={['playAnimation']}
          dark={dark}
          nonce={nonce}
          label="Personalized Practice Fullscreen"
          className="size-full"
          onRiveEvent={onEvent}
        />
      </BrilliantRiveContainer>
      <BrilliantCopyContainer>
        <h1 className="text-[24px] sm:text-[26px] font-extrabold text-pfg">
          {lang === 'ru' ? 'Умная практика под ваши цели' : 'Maqsadingizga mos aqlli mashqlar'}
        </h1>
        <p className="text-[15px] text-pmuted leading-relaxed">
          {lang === 'ru'
            ? 'Алгоритм подбирает задания, которые усилят слабые места.'
            : 'Algoritm aynan qiynalgan mavzularingiz bo‘yicha topshiriqlar tuzadi.'}
        </p>
      </BrilliantCopyContainer>
    </BrilliantEndstateShell>
  )
}

/** 4) Course Map Personalized Practice ResponsiveModal (`1i3itd-2ldg21.js` exact Bottom Sheet!) */
function PersonalizedPracticeModalMvp({ ctx }: { ctx: ExtraMvpCtx }) {
  const { lang, dark, nonce, onEvent, onReplay, onClose } = ctx
  return (
    <div className="relative flex min-h-[100dvh] w-full flex-col justify-end sm:items-center sm:justify-center bg-black/60 p-0 sm:p-4">
      <div
        className="w-full sm:max-w-[440px] rounded-t-3xl sm:rounded-3xl p-6 pb-[calc(max(env(safe-area-inset-bottom,0px),16px)+16px)] text-center shadow-2xl border-2 border-plineStrong brilliant-iridescent-flipped"
      >
        {/* Brilliant sh: height: { base: "320px", md: "350px" }, width: { base: "320px", md: "350px" } */}
        <div className="mx-auto size-[280px] sm:size-[320px]">
          <MvpRiveStage
            file="personalized-practice-nudge.8d7e7c26.riv"
            artboard="MAIN_personalized-practice-nudge"
            stateMachine="personalized-practice-nudge"
            smTriggers={['play-animation']}
            dark={dark}
            nonce={nonce}
            label="Personalized Practice Drawer"
            className="size-full"
            onRiveEvent={onEvent}
          />
        </div>
        <h2 className="mt-2 mb-6 text-[22px] font-extrabold leading-tight text-pfg">
          {lang === 'ru'
            ? 'Учитесь быстрее с персональной практикой — только в Premium'
            : 'Shaxsiy mashq bilan tezroq o‘rganing — faqat Premiumda'}
        </h2>
        <div className="mx-auto max-w-[350px] space-y-2.5">
          <Button
            variant="primary"
            size="lg"
            block
            onClick={() => {
              playSound('achievement')
              onReplay()
            }}
          >
            {lang === 'ru' ? 'Открыть практику' : 'Shaxsiy mashqni ochish'}
          </Button>
          <Button variant="secondary" size="lg" block onClick={onClose}>
            {lang === 'ru' ? 'Закрыть' : 'Yopish'}
          </Button>
        </div>
      </div>
    </div>
  )
}

/** 5) SaleScreen Promo (`new_year_endstate_promo.32852c2a.riv`) */
function SalePromoMvp({ ctx }: { ctx: ExtraMvpCtx }) {
  const { lang, dark, nonce, onEvent, onReplay, onClose } = ctx
  return (
    <BrilliantEndstateShell
      viewportClassName="brilliant-streak-bg-glow"
      primaryLabel={lang === 'ru' ? 'Забрать скидку' : 'Chegirmani olish'}
      secondaryLabel={lang === 'ru' ? 'Позже' : 'Keyinroq'}
      onPrimaryClick={() => {
        playSound('win')
        onReplay()
      }}
      onSecondaryClick={onClose}
    >
      <BrilliantRiveContainer className="aspect-square rounded-3xl overflow-hidden bg-black border border-white/10 shadow-2xl">
        <MvpRiveStage
          file="new_year_endstate_promo.32852c2a.riv"
          artboard="MAIN_new-years-endstate"
          stateMachine="new-years-endstate"
          smTriggers={['play-animation']}
          dark={dark}
          nonce={nonce}
          label="New Year Sale Promo"
          className="size-full"
          onRiveEvent={onEvent}
        />
      </BrilliantRiveContainer>
      <BrilliantCopyContainer>
        <span className="inline-flex items-center gap-1 rounded-full bg-[#f6b31f]/20 px-3 py-1 text-[12px] font-bold text-[#f6b31f]">
          <Sparkles size={13} /> -20% PROMO
        </span>
        <h1 className="text-[24px] sm:text-[26px] font-extrabold text-pfg">
          {lang === 'ru' ? 'Праздничное предложение KIVVI!' : 'KIVVI bayram aksiyasi!'}
        </h1>
        <p className="text-[15px] text-pmuted">
          {lang === 'ru'
            ? 'Годовая подписка Premium со скидкой только сегодня.'
            : 'Yillik Premium obuna faqat bugun maxsus narxda.'}
        </p>
      </BrilliantCopyContainer>
    </BrilliantEndstateShell>
  )
}

/** 6) ReviewComplete, LevelCheckTransition & AssessmentIntro (`level-check.e74e7d3c.riv` / `1dfae46f`) */
function LevelCheckExtraMvp({
  ctx,
  mode,
}: {
  ctx: ExtraMvpCtx
  mode: 'review-complete' | 'level-check-transition' | 'assessment-intro' | 'warm-up'
}) {
  const { lang, dark, nonce, colorVariant, onEvent, onReplay, onClose } = ctx
  const cfg =
    mode === 'review-complete'
      ? {
          file: 'level-check.e74e7d3c.riv',
          artboard: 'MAIN_ReviewComplete',
          sm: 'ReviewComplete',
          vm: 'ReviewCompleteVM',
          trigger: 'playAnimation',
          title: lang === 'ru' ? 'Повтор завершён!' : 'Takrorlash yakunlandi!',
          body: lang === 'ru' ? 'Все ошибки разобраны и закреплены.' : 'Barcha xatolar ko‘rib chiqildi va mustahkamlandi.',
          useLevelShell: false,
        }
      : mode === 'level-check-transition'
        ? {
            file: 'level-check.e74e7d3c.riv',
            artboard: 'MAIN_LevelCheckTransition',
            sm: 'LevelCheckTransition',
            vm: 'LevelCheckTransitionVM',
            trigger: 'playAnimation',
            title: lang === 'ru' ? 'Переходим к проверке' : 'Daraja tekshiruviga o‘tish',
            body: lang === 'ru' ? 'Закрепите пройденные темы за 3 минуты.' : 'O‘tilgan mavzularni 3 daqiqada mustahkamlang.',
            useLevelShell: true,
          }
        : mode === 'warm-up'
          ? {
              file: 'level-check.e74e7d3c.riv',
              artboard: 'MAIN_WarmUp',
              sm: 'WarmUp',
              vm: 'LevelCheckVM',
              trigger: 'playWarmUp',
              title: lang === 'ru' ? 'Быстрая разминка!' : 'Qisqa qizdirish mashqi!',
              body: lang === 'ru' ? 'Вспомним ключевые идеи перед новыми задачами.' : 'Yangi mavzudan oldin asosiy g‘oyalarni takrorlaymiz.',
              useLevelShell: true,
            }
          : {
              file: 'level-check-assessment-intro.1dfae46f.riv',
              artboard: 'MAIN_AssessmentIntro',
              sm: 'AssessmentIntro',
              vm: 'LevelCheckVM',
              trigger: 'playAssessmentIntro',
              title: lang === 'ru' ? 'Входное тестирование' : 'Kirish baholashi',
              body: lang === 'ru' ? 'Подберём точный стартовый уровень под ваши знания.' : 'Bilimingizga mos aniq boshlang‘ich darajani aniqlaymiz.',
              useLevelShell: true,
            }

  const stage = (
    <MvpRiveStage
      file={cfg.file}
      artboard={cfg.artboard}
      stateMachine={cfg.sm}
      viewModel={cfg.vm}
      numbers={{ color: colorVariant }}
      vmTriggers={[cfg.trigger]}
      dark={dark}
      nonce={nonce}
      label={cfg.title}
      className="size-full"
      onRiveEvent={onEvent}
    />
  )

  if (cfg.useLevelShell) {
    return (
      <BrilliantLevelCheckShell
        title={cfg.title}
        progressPercent={20}
        onClose={onClose}
        primaryLabel={lang === 'ru' ? 'Начать' : 'Boshlash'}
        onPrimaryClick={() => {
          playSound('click')
          onReplay()
        }}
      >
        <div className="size-[260px] md:size-[300px]">{stage}</div>
        <div className="bg-pcard w-full max-w-[360px] rounded-2xl p-6 text-center space-y-2">
          <h2 className="text-[20px] font-extrabold text-pfg">{cfg.title}</h2>
          <p className="text-[14px] text-pmuted leading-relaxed">{cfg.body}</p>
        </div>
      </BrilliantLevelCheckShell>
    )
  }

  return (
    <BrilliantEndstateShell
      primaryLabel={lang === 'ru' ? 'Продолжить' : 'Davom etish'}
      onPrimaryClick={onReplay}
    >
      <BrilliantRiveContainer className="aspect-square">{stage}</BrilliantRiveContainer>
      <BrilliantCopyContainer className="pt-2">
        <h1 className="text-[26px] font-extrabold text-pfg">{cfg.title}</h1>
        <p className="text-[15px] text-pmuted">{cfg.body}</p>
      </BrilliantCopyContainer>
    </BrilliantEndstateShell>
  )
}

/** 7) Practice Tray Complete (`practice_tray_sep_30_2026.riv`) */
function PracticeTrayMvp({ ctx }: { ctx: ExtraMvpCtx }) {
  const { lang, dark, nonce, onEvent, onReplay, onClose } = ctx
  return (
    <BrilliantEndstateShell
      primaryLabel={lang === 'ru' ? 'Готово' : 'Tayyor'}
      secondaryLabel={lang === 'ru' ? 'Закрыть' : 'Yopish'}
      onPrimaryClick={onReplay}
      onSecondaryClick={onClose}
    >
      <BrilliantRiveContainer className="aspect-square">
        <MvpRiveStage
          file="practice_tray_sep_30_2026.riv"
          artboard="MAIN_Practice complete"
          stateMachine="PracticeComplete"
          viewModel="PracticeCompleteVM"
          booleans={{ darkMode: dark }}
          vmTriggers={['playAnimation']}
          dark={dark}
          nonce={nonce}
          label="Practice Tray Complete"
          className="size-full"
          onRiveEvent={onEvent}
        />
      </BrilliantRiveContainer>
      <BrilliantCopyContainer>
        <h1 className="text-[24px] font-extrabold text-pfg">
          {lang === 'ru' ? 'Ежедневная разминка выполнена!' : 'Kunlik mashq bajarildi!'}
        </h1>
        <p className="text-[15px] text-pmuted">practice_tray_sep_30_2026.riv · MAIN_Practice complete</p>
      </BrilliantCopyContainer>
    </BrilliantEndstateShell>
  )
}

/** 8) In-Lesson Streaks Lightning Tooltip (`0k3li05m9_b0s.js` exact header + popover!) */
function InLessonLightningMvp({ ctx }: { ctx: ExtraMvpCtx }) {
  const { lang, dark, nonce, onEvent, onClose } = ctx
  const [pulseSeq, setPulseSeq] = useState(1)
  const [popoverOpen, setPopoverOpen] = useState(false)

  useEffect(() => {
    setPopoverOpen(false)
    const t = setTimeout(() => setPulseSeq((s) => s + 1), 350)
    return () => clearTimeout(t)
  }, [nonce])

  return (
    <div className="flex min-h-[100dvh] w-full flex-col bg-pcanvas text-pfg pt-[var(--safe-top,0px)]">
      {/* Haqiqiy Brilliant dars tepa paneli */}
      <header className="flex h-14 items-center justify-between border-b border-pline px-4">
        <div className="flex items-center gap-3 flex-1 pr-3">
          <div className="h-2.5 flex-1 rounded-full bg-psurface overflow-hidden">
            <div className="h-full w-3/4 rounded-full bg-[#29cc57]" />
          </div>
        </div>

        {/* Chaqmoq badge + 200x185px Rive Tooltip Layer */}
        <div className="relative flex items-center mt-[-2.5px]">
          <div className="pointer-events-none absolute -right-2 -top-2 z-30 h-[185px] w-[200px]">
            <MvpRiveStage
              file="lightning.6513fd63.riv"
              artboard="Streaks Tooltip Animation"
              stateMachine="In-Lesson Streak Mobile"
              smBooleans={{ 'Bolt visible': true }}
              pulseSmTrigger={{ name: 'Lightning', seq: pulseSeq }}
              dark={dark}
              nonce={nonce}
              label="In-Lesson Streak Lightning"
              className="size-full"
              onRiveEvent={(ev) => {
                onEvent?.(ev)
                if (ev === 'onLightningExplode') {
                  setPopoverOpen(true)
                  playSound('chime')
                  haptics.notify('success')
                }
              }}
            />
          </div>
          <button
            type="button"
            onClick={() => {
              setPopoverOpen((o) => !o)
              setPulseSeq((s) => s + 1)
            }}
            className="relative z-20 inline-flex h-9 items-center gap-1 rounded-full bg-[#b7dc00]/20 px-3 text-[13px] font-extrabold text-pfg cursor-pointer"
          >
            <Zap size={16} className="fill-[#b7dc00] text-[#b7dc00]" />
            <span>3 / 3</span>
          </button>

          {popoverOpen && (
            <div className="absolute right-0 top-12 z-40 w-[260px] bg-pcard rounded-2xl p-4 shadow-2xl text-left">
              <div className="flex items-center gap-2 font-extrabold text-[14px] text-pfg">
                <Flame size={16} className="text-[#ff8d23]" />
                {lang === 'ru' ? 'Серия активирована!' : 'Kunlik seriya yondi!'}
              </div>
              <p className="mt-1 text-[13px] text-pmuted leading-snug">
                {lang === 'ru'
                  ? 'Вы решили 3 задачи — серия на сегодня засчитана!'
                  : '3 ta masala yechdingiz — bugungi seriya hisoblandi!'}
              </p>
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[440px] flex-1 flex-col items-center justify-center gap-5 px-5 text-center">
        <div className="bg-pcard rounded-2xl p-6 space-y-3">
          <h1 className="text-[20px] font-extrabold text-pfg">
            {lang === 'ru' ? 'Внутриурочный Streak Popover' : 'Dars ichidagi Chaqmoq Tooltip'}
          </h1>
          <p className="text-[14px] text-pmuted leading-relaxed">
            {lang === 'ru'
              ? 'Нажмите кнопку «Отстрелить молнию» или значок ⚡ справа вверху — вспыхнет 200×185px Rive и откроется Popover.'
              : 'Yuqori o‘ngdagi ⚡ tugmasini yoki pastdagi tugmani bosing — 200×185px chaqmoq chaqnaydi va tooltip ochiladi.'}
          </p>
          <Button
            variant="primary"
            block
            onClick={() => {
              setPopoverOpen(false)
              setPulseSeq((s) => s + 1)
              playSound('click')
            }}
          >
            {lang === 'ru' ? 'Запустить молнию ⚡' : 'Chaqmoqni yoqish ⚡'}
          </Button>
          <Button variant="secondary" block onClick={onClose}>
            {lang === 'ru' ? 'Назад' : 'Orqaga'}
          </Button>
        </div>
      </main>
    </div>
  )
}

/** 9) Koji Speech Bubble (`3-19jli8nw9de.js`: 260px bubble + 180x180 Koji) */
function KojiSpeechBubbleMvp({ ctx }: { ctx: ExtraMvpCtx }) {
  const { lang, dark, nonce, onEvent, onClose } = ctx
  const [shown, setShown] = useState(false)
  const [pulse, setPulse] = useState({ name: 'play_speech-one', seq: 1 })

  useEffect(() => {
    setShown(false)
    const t1 = setTimeout(() => setPulse({ name: 'play_speech-one', seq: Date.now() }), 120)
    const t2 = setTimeout(() => setShown(true), 1200)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [nonce])

  return (
    <BrilliantEndstateShell
      primaryLabel={lang === 'ru' ? 'Следующая реплика' : 'Keyingi gap'}
      secondaryLabel={lang === 'ru' ? 'Закрыть' : 'Yopish'}
      onPrimaryClick={() => {
        setShown(true)
        setPulse((p) => ({
          name: p.name === 'play_speech-one' ? 'play_speech-two' : 'play_speech-one',
          seq: p.seq + 1,
        }))
        playSound('click')
      }}
      onSecondaryClick={onClose}
    >
      <div className="flex flex-1 flex-col items-center justify-center px-5 gap-0 min-h-[340px]">
        {/* Brilliant Speech Bubble card: maxW 260px, p 20px, opacity on "speech-bubble" RiveEvent */}
        <div
          className="bg-pcard max-w-[260px] rounded-2xl p-5 text-center text-[15px] font-medium text-pfg transition-opacity duration-200"
          style={{ opacity: shown ? 1 : 0 }}
        >
          {lang === 'ru'
            ? 'Попробуйте разбить задачу на два простых шага!'
            : 'Masalani ikki oddiy qadamga bo‘lib yechib ko‘ring!'}
        </div>
        <div className="-mt-5 size-[180px]">
          <MvpRiveStage
            file="koji-speech-bubble.5abaf0ba.riv"
            artboard="Koji_speechBubble"
            stateMachine="Koji_speechBubble"
            pulseSmTrigger={pulse}
            dark={dark}
            nonce={nonce}
            label="Koji Speech Bubble"
            className="size-full"
            onRiveEvent={(ev) => {
              onEvent?.(ev)
              if (ev === 'speech-bubble') setShown(true)
            }}
          />
        </div>
      </div>
    </BrilliantEndstateShell>
  )
}

/** 10) AskKoji Interactive AI Tutor Widget (`ask_koji.410199b8.riv`, `AskKojiVM`) */
function AskKojiAiMvp({ ctx }: { ctx: ExtraMvpCtx }) {
  const { lang, dark, nonce, onEvent, onClose } = ctx
  const [pulseVm, setPulseVm] = useState<{ name: string; seq: number }>({ name: 'playEnter', seq: 1 })
  const [isTalking, setIsTalking] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const triggers = [
    { id: 'playEnter', label: 'Enter' },
    { id: 'yesAnd', label: 'Yes & Nod' },
    { id: 'incorrect', label: 'Incorrect' },
    { id: 'correctAfterIncorrect', label: 'Fixed!' },
    { id: 'successBigOne', label: 'Success!' },
    { id: 'waveLeft', label: 'Wave' },
    { id: 'tiltRight', label: 'Tilt' },
  ]

  return (
    <BrilliantEndstateShell
      primaryLabel={lang === 'ru' ? 'Закрыть' : 'Yopish'}
      onPrimaryClick={onClose}
    >
      <div className="mx-auto flex w-full max-w-[393px] flex-col items-center gap-4 px-4 pt-12">
        {/* Brilliant uses both 52x52 floating FAB and 140px tutor header */}
        <div className="flex items-center gap-4">
          <div className="size-[52px] rounded-full bg-psurface border border-pline flex items-center justify-center overflow-hidden">
            <MvpRiveStage
              file="ask_koji.410199b8.riv"
              artboard="MAIN_AskKoji_52x52"
              stateMachine="AskKoji"
              viewModel="AskKojiVM"
              booleans={{ darkMode: dark, isTalking, isLoading }}
              vmTriggers={['playEnter']}
              pulseVmTrigger={pulseVm}
              liveBooleans={{ isTalking, isLoading, darkMode: dark }}
              dark={dark}
              nonce={nonce}
              label="AskKoji 52px"
              className="size-full"
            />
          </div>
          <div className="size-[160px] rounded-3xl bg-psurface border-2 border-plineStrong overflow-hidden">
            <MvpRiveStage
              file="ask_koji.410199b8.riv"
              artboard="MAIN_AskKoji_52x52"
              stateMachine="AskKoji"
              viewModel="AskKojiVM"
              booleans={{ darkMode: dark, isTalking, isLoading }}
              vmTriggers={['playEnter']}
              pulseVmTrigger={pulseVm}
              liveBooleans={{ isTalking, isLoading, darkMode: dark }}
              dark={dark}
              nonce={nonce}
              label="AskKoji 160px"
              className="size-full"
              onRiveEvent={onEvent}
            />
          </div>
        </div>

        <h1 className="text-[22px] font-extrabold text-pfg">AskKoji AI Ustoz (52×52 & Hero)</h1>
        <div className="flex flex-wrap justify-center gap-2">
          {triggers.map((tr) => (
            <button
              key={tr.id}
              type="button"
              onClick={() => {
                setPulseVm((p) => ({ name: tr.id, seq: p.seq + 1 }))
                playSound('click')
              }}
              className="rounded-full border border-plineStrong bg-psurface px-3 py-1.5 text-[12px] font-bold text-pfg cursor-pointer active:scale-95"
            >
              {tr.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setIsTalking((v) => !v)}
            className={cn(
              'rounded-full px-3.5 py-1.5 text-[12px] font-bold border cursor-pointer',
              isTalking ? 'border-pprimary bg-[#3557ff]/15 text-pfg' : 'border-pline text-pmuted',
            )}
          >
            isTalking: {String(isTalking)}
          </button>
          <button
            type="button"
            onClick={() => setIsLoading((v) => !v)}
            className={cn(
              'rounded-full px-3.5 py-1.5 text-[12px] font-bold border cursor-pointer',
              isLoading ? 'border-pprimary bg-[#3557ff]/15 text-pfg' : 'border-pline text-pmuted',
            )}
          >
            isLoading: {String(isLoading)}
          </button>
        </div>
      </div>
    </BrilliantEndstateShell>
  )
}

const ICP_INIT_BOOLS = { darkMode: false, startIdle: true }
const ICP_INIT_NUMS = { icon: 0 }
const ICP_INIT_TRIGS = ['kojiAppear']
const NODE_ALL_INIT_TRIGS = ['koji_appear']

/** 11) Gameboard Course Map Node (`icp-node.add6a472.riv` + `koji-gameboard.e2320c48.riv`) — Brilliant 1:1 */
function IcpNodeMvp({ ctx }: { ctx: ExtraMvpCtx }) {
  const { lang, dark, nonce, colorVariant, onEvent, onClose } = ctx
  const [completed, setCompleted] = useState(false)
  const [mastered, setMastered] = useState(false)
  const [padlock, setPadlock] = useState(false)
  const [premiumNode, setPremiumNode] = useState(false)
  const [progressCheck, setProgressCheck] = useState(false)
  const [level, setLevel] = useState(false)
  const [selected, setSelected] = useState(true)
  const [hoveredIcp, setHoveredIcp] = useState(false)
  const [hoveredClassic, setHoveredClassic] = useState(false)
  const [downIcp, setDownIcp] = useState(false)
  const [pulseVm, setPulseVm] = useState({ name: 'kojiAppear', seq: 1 })
  const [pulseSm, setPulseSm] = useState({ name: 'koji_appear', seq: 1 })

  const fireBoth = (vmName: string, smName: string) => {
    setPulseVm((p) => ({ name: vmName, seq: p.seq + 1 }))
    setPulseSm((p) => ({ name: smName, seq: p.seq + 1 }))
    playSound('click')
    haptics.impact('light')
  }

  const iconNum = padlock ? 3 : completed && !level ? 1 : 0

  return (
    <BrilliantEndstateShell
      primaryLabel={lang === 'ru' ? 'Появление Koji (Appear)' : 'Koji chiqishi (Appear)'}
      secondaryLabel={lang === 'ru' ? 'Закрыть' : 'Yopish'}
      onPrimaryClick={() => fireBoth('kojiAppear', 'koji_appear')}
      onSecondaryClick={onClose}
    >
      <div className="mx-auto flex w-full max-w-[393px] flex-col items-center gap-3.5 px-4 pt-12 pb-2">
        <div className="grid grid-cols-2 gap-3 w-full max-w-[340px]">
          {/* 1. Yangi ICPNodeVM (128x134 Brilliant exact stage) */}
          <button
            type="button"
            onClick={() => fireBoth('kojiEnterLesson', 'koji_enter_lesson')}
            onPointerEnter={() => setHoveredIcp(true)}
            onPointerLeave={() => {
              setHoveredIcp(false)
              setDownIcp(false)
            }}
            onPointerDown={() => setDownIcp(true)}
            onPointerUp={() => setDownIcp(false)}
            className="bg-pcard rounded-2xl p-2.5 flex flex-col items-center gap-1 cursor-pointer select-none"
            style={{ WebkitTapHighlightColor: 'transparent' }}
          >
            <div className="h-[134px] w-[128px] shrink-0">
              <MvpRiveStage
                file="icp-node.add6a472.riv"
                artboard="Gameboard Node"
                stateMachine="ICPNode"
                viewModel="ICPNodeVM"
                booleans={ICP_INIT_BOOLS}
                numbers={ICP_INIT_NUMS}
                vmTriggers={ICP_INIT_TRIGS}
                pulseVmTrigger={pulseVm}
                liveBooleans={{
                  darkMode: dark,
                  completed,
                  mastered,
                  padlock: !completed && padlock,
                  lockedProgressCheck: !completed && padlock && progressCheck,
                  premiumNode,
                  progressCheck,
                  level,
                  select: selected,
                  hover: hoveredIcp,
                  cursorDown: downIcp,
                  startIdle: true,
                }}
                liveNumbers={{ color: colorVariant, icon: iconNum }}
                dark={dark}
                nonce={nonce}
                label="ICPNode"
                className="size-full"
                onRiveEvent={onEvent}
              />
            </div>
            <span className="text-[11px] font-bold text-pmuted">ICPNodeVM (128×134)</span>
          </button>

          {/* 2. Klassik node_all (koji-gameboard.e2320c48.riv — 128x134) */}
          <button
            type="button"
            onClick={() => fireBoth('kojiEnterLesson', 'koji_enter_lesson')}
            onPointerEnter={() => setHoveredClassic(true)}
            onPointerLeave={() => setHoveredClassic(false)}
            className="bg-pcard rounded-2xl p-2.5 flex flex-col items-center gap-1 cursor-pointer select-none"
            style={{ WebkitTapHighlightColor: 'transparent' }}
          >
            <div className="h-[134px] w-[128px] shrink-0">
              <MvpRiveStage
                file="koji-gameboard.e2320c48.riv"
                artboard="Gameboard Node"
                stateMachine="node_all"
                smTriggers={NODE_ALL_INIT_TRIGS}
                pulseSmTrigger={pulseSm}
                liveSmBooleans={{
                  'dark-mode': dark,
                  completed,
                  select: selected,
                  hover: hoveredClassic,
                  level,
                  padlock: !completed && padlock,
                }}
                liveSmNumbers={{ color: colorVariant, icon: iconNum }}
                dark={dark}
                nonce={nonce}
                label="Koji Gameboard Node"
                className="size-full"
              />
            </div>
            <span className="text-[11px] font-bold text-pmuted">node_all (128×134)</span>
          </button>
        </div>

        <div className="text-center">
          <h1 className="text-[18px] font-extrabold text-pfg">
            {lang === 'ru' ? 'Узлы карты курса (Gameboard)' : 'Kurs xaritasi tugunlari (Gameboard)'}
          </h1>
          <p className="text-[12px] text-pmuted">
            {lang === 'ru' ? 'Нажмите узел для kojiEnterLesson' : 'Tugunni bosing — darsga kirish animatsiyasi o‘ynaydi'}
          </p>
        </div>

        {/* Boolean holatlar */}
        <div className="flex flex-wrap justify-center gap-1.5">
          {[
            { label: 'Select', active: selected, toggle: () => setSelected((v) => !v) },
            {
              label: 'Completed',
              active: completed,
              toggle: () => {
                const next = !completed
                setCompleted(next)
                if (next) fireBoth('kojiDisappear', 'koji_disappear')
                else if (!padlock && !level) fireBoth('kojiAppear', 'koji_appear')
              },
            },
            { label: 'Mastered', active: mastered, toggle: () => setMastered((v) => !v) },
            {
              label: 'Padlock',
              active: padlock,
              toggle: () => {
                const next = !padlock
                setPadlock(next)
                if (next && !completed) fireBoth('kojiDisappear', 'koji_disappear')
              },
            },
            {
              label: 'Level',
              active: level,
              toggle: () => {
                const next = !level
                setLevel(next)
                if (next) fireBoth('kojiDisappear', 'koji_disappear')
              },
            },
            { label: 'Premium', active: premiumNode, toggle: () => setPremiumNode((v) => !v) },
            { label: 'ProgressCheck', active: progressCheck, toggle: () => setProgressCheck((v) => !v) },
          ].map((btn) => (
            <button
              key={btn.label}
              type="button"
              onClick={() => {
                playSound('toggle')
                btn.toggle()
              }}
              className={cn(
                'rounded-full border px-2.5 py-1 text-[11px] font-bold cursor-pointer',
                btn.active ? 'border-pprimary bg-[#3557ff]/15 text-pfg' : 'border-pline text-pmuted',
              )}
            >
              {btn.label}
            </button>
          ))}
        </div>

        {/* Trigger tugmalari */}
        <div className="flex flex-wrap justify-center gap-1.5">
          {[
            { label: 'Appear', vm: 'kojiAppear', sm: 'koji_appear' },
            { label: 'Appear+Enter', vm: 'kojiAppearEnter', sm: 'koji_appear_enter' },
            { label: 'Enter Lesson', vm: 'kojiEnterLesson', sm: 'koji_enter_lesson' },
            { label: 'Disappear', vm: 'kojiDisappear', sm: 'koji_disappear' },
          ].map((tr) => (
            <button
              key={tr.label}
              type="button"
              onClick={() => fireBoth(tr.vm, tr.sm)}
              className="rounded-full border border-plineStrong bg-psurface px-2.5 py-1 text-[11px] font-bold text-pfg cursor-pointer active:scale-95"
            >
              {tr.label}
            </button>
          ))}
        </div>
      </div>
    </BrilliantEndstateShell>
  )
}

/** 12) Level Insertion Acceptance + OnDemand + Master Loaders */
function InsertionAndLoadersMvp({
  ctx,
  mode,
}: {
  ctx: ExtraMvpCtx
  mode: 'level-insertion-acceptance' | 'ondemand-loader' | 'master-loader'
}) {
  const { lang, dark, nonce, colorVariant, onEvent, onReplay, onClose } = ctx
  const [topic, setTopic] = useState(0)

  if (mode === 'level-insertion-acceptance') {
    return (
      <BrilliantEndstateShell
        primaryLabel={lang === 'ru' ? 'Повторить' : 'Qayta ko‘rish'}
        secondaryLabel={lang === 'ru' ? 'Закрыть' : 'Yopish'}
        onPrimaryClick={onReplay}
        onSecondaryClick={onClose}
      >
        <div className="mx-auto mt-8 h-[410px] w-full max-w-[350px] rounded-2xl overflow-hidden border border-pline bg-pcard/40 p-2">
          <MvpRiveStage
            file="level-insertion-acceptance.0b247613.riv"
            artboard="levelInsertion_Animation"
            stateMachine="State Machine 1"
            viewModel="ICPLevelInsertion"
            booleans={{ darkMode: dark }}
            numbers={{ lessonCount: 5, levelNumber: 2, revealProgress: 100 }}
            vmTriggers={['playInsertion', 'revealHeader', 'revealNodes']}
            dark={dark}
            nonce={nonce}
            label="Level Insertion Acceptance"
            className="size-full"
            onRiveEvent={onEvent}
          />
        </div>
        <BrilliantCopyContainer>
          <h1 className="text-[22px] font-extrabold text-pfg">
            {lang === 'ru' ? 'Встраивание уроков в карту' : 'Darslarni xaritaga qo‘shish'}
          </h1>
          <p className="text-[14px] text-pmuted">level-insertion-acceptance.0b247613.riv · ICPLevelInsertion</p>
        </BrilliantCopyContainer>
      </BrilliantEndstateShell>
    )
  }

  if (mode === 'ondemand-loader') {
    return (
      <BrilliantEndstateShell
        primaryLabel={lang === 'ru' ? 'Запустить Entry' : 'Qayta yuklash'}
        secondaryLabel={lang === 'ru' ? 'Назад' : 'Orqaga'}
        onPrimaryClick={onReplay}
        onSecondaryClick={onClose}
      >
        <div className="mx-auto flex flex-1 flex-col items-center justify-center gap-6 px-4">
          <div className="w-[140px] h-[140px]">
            <MvpRiveStage
              file="ondemand-gamified.e9b9a0f3.riv"
              artboard="On Demand"
              stateMachine="endstate_complete"
              smBooleans={{ completeNode: false }}
              smNumbers={{ Color: colorVariant }}
              smTriggers={['Entry']}
              dark={dark}
              nonce={nonce}
              label="On Demand Gamified"
              className="size-full"
              onRiveEvent={onEvent}
            />
          </div>
          <p className="max-w-[200px] text-center text-[17px] font-semibold text-pmuted">
            {lang === 'ru' ? 'Готовим интерактивный курс…' : 'Interaktiv kurs tayyorlanmoqda…'}
          </p>
        </div>
      </BrilliantEndstateShell>
    )
  }

  return (
    <BrilliantEndstateShell
      primaryLabel={lang === 'ru' ? 'Следующая тема' : 'Keyingi mavzu'}
      secondaryLabel={lang === 'ru' ? 'Назад' : 'Orqaga'}
      onPrimaryClick={() => {
        setTopic((t) => (t + 1) % 3)
        onReplay()
      }}
      onSecondaryClick={onClose}
    >
      <div className="mx-auto mt-8 size-[310px] sm:size-[350px] rounded-3xl overflow-hidden border border-plineStrong shadow-2xl">
        <MvpRiveStage
          file="nux_loaders.51875c1e.riv"
          artboard="MasterLoader"
          stateMachine="Loader"
          viewModel="ShowTopicVM"
          booleans={{ darkMode: dark }}
          numbers={{ learningTopic: topic }}
          vmTriggers={['playLoader']}
          dark={dark}
          nonce={nonce}
          label="Master Loader"
          className="size-full"
          onRiveEvent={onEvent}
        />
      </div>
      <BrilliantCopyContainer>
        <h1 className="text-[22px] font-extrabold text-pfg">
          NUX MasterLoader ({['Matematika', 'CS / AI', 'Mantiq'][topic]})
        </h1>
        <p className="text-[14px] text-pmuted">nux_loaders.51875c1e.riv · ShowTopicVM</p>
      </BrilliantCopyContainer>
    </BrilliantEndstateShell>
  )
}

/** 13) HabitScreen (`MAIN_KojiSpeech`, `2nvyvzv5p2e6h.js`) */
function HabitScreenMvp({ ctx }: { ctx: ExtraMvpCtx }) {
  const { lang, dark, nonce, onEvent, onClose } = ctx
  const [selected, setSelected] = useState<number | null>(null)
  const [entered, setEntered] = useState(false)
  const [pulseVm, setPulseVm] = useState<{ name: string; seq: number }>({ name: 'speechThree', seq: 1 })

  useEffect(() => {
    setEntered(false)
    const t = setTimeout(() => setEntered(true), 600)
    return () => clearTimeout(t)
  }, [nonce])

  const choices = [
    { idx: 0, label: '5 min / kun', power: 'powerupOne', sub: lang === 'ru' ? 'Лёгкий старт' : 'Yengil start' },
    { idx: 1, label: '10 min / kun', power: 'powerupTwo', sub: lang === 'ru' ? 'Оптимально' : 'Eng qulay' },
    { idx: 2, label: '15 min / kun', power: 'powerupThree', sub: lang === 'ru' ? 'Интенсив' : 'Tezkor o‘sish' },
  ]

  return (
    <BrilliantEndstateShell
      primaryLabel={lang === 'ru' ? 'Продолжить' : 'Saqlash va davom etish'}
      secondaryLabel={lang === 'ru' ? 'Закрыть' : 'Yopish'}
      onPrimaryClick={onClose}
      onSecondaryClick={onClose}
    >
      <div className="mx-auto flex w-full max-w-[440px] flex-1 flex-col items-center justify-center gap-4 px-4 pt-6">
        <div className="size-[190px] sm:size-[220px]">
          <MvpRiveStage
            file="koji_speech_apr_22_26.riv"
            artboard="MAIN_KojiSpeech"
            stateMachine="KojiSpeech"
            viewModel="KojiSpeechVM"
            booleans={{ entered: false, darkMode: dark }}
            vmTriggers={['speechThree']}
            liveBooleans={{ entered, darkMode: dark }}
            pulseVmTrigger={pulseVm}
            dark={dark}
            nonce={nonce}
            label="Habit KojiSpeech"
            className="size-full"
            onRiveEvent={onEvent}
          />
        </div>
        <h1 className="text-[22px] sm:text-[26px] font-extrabold text-pfg text-center">
          {lang === 'ru' ? 'Сколько времени в день удобно?' : 'Kuniga necha daqiqa ajratasiz?'}
        </h1>
        <div className="w-full space-y-2.5">
          {choices.map((c) => (
            <button
              key={c.idx}
              type="button"
              onClick={() => {
                setSelected(c.idx)
                setPulseVm((p) => ({ name: c.power, seq: p.seq + 1 }))
                playSound('click')
                haptics.impact('light')
              }}
              className={cn(
                'w-full flex items-center justify-between rounded-2xl border-2 px-4 py-3.5 text-left transition-colors cursor-pointer',
                selected === c.idx
                  ? 'border-[#3557ff] bg-[#3557ff]/12 text-pfg'
                  : 'border-plineStrong bg-pcard text-pfg',
              )}
            >
              <span className="font-extrabold text-[15px]">{c.label}</span>
              <span className="text-[12px] font-semibold text-pmuted">{c.sub}</span>
            </button>
          ))}
        </div>
      </div>
    </BrilliantEndstateShell>
  )
}

/** 14) 3-Step Carousel & KnowledgeGraph (`nux-refresh.62cd2c8c.riv` + `nux_revamp.d192d940.riv`) */
function KojiSpeechStepsMvp({ ctx }: { ctx: ExtraMvpCtx }) {
  const { lang, dark, nonce, onEvent, onClose } = ctx
  const [step, setStep] = useState<'playOne' | 'playTwo' | 'playThree'>('playOne')
  const [speechStep, setSpeechStep] = useState<'play_speech-one' | 'play_speech-two' | 'play_speech-three'>('play_speech-one')

  return (
    <BrilliantEndstateShell
      primaryLabel={lang === 'ru' ? 'Закрыть' : 'Yopish'}
      onPrimaryClick={onClose}
    >
      <div className="mx-auto flex w-full max-w-[440px] flex-1 flex-col items-center justify-center gap-5 px-4 pt-10">
        {/* Carousel 3 segments */}
        <div className="bg-pcard w-full rounded-2xl p-4 space-y-3 text-center">
          <div className="mx-auto size-[180px]">
            <MvpRiveStage
              file="nux-refresh.62cd2c8c.riv"
              artboard="MAIN_ValuePropsCarousel"
              stateMachine="ValuePropsCarousel [3 segments]"
              viewModel="ValuePropsCarouselVM"
              booleans={{ darkMode: dark }}
              vmTriggers={[step]}
              pulseVmTrigger={{ name: step, seq: step.length + nonce }}
              dark={dark}
              nonce={nonce}
              label="ValuePropsCarousel"
              className="size-full"
              onRiveEvent={onEvent}
            />
          </div>
          <div className="flex justify-center gap-1.5">
            {(['playOne', 'playTwo', 'playThree'] as const).map((s, idx) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  setStep(s)
                  playSound('click')
                }}
                className={cn(
                  'rounded-full px-3 py-1 text-[12px] font-bold border cursor-pointer',
                  step === s ? 'border-pprimary bg-[#3557ff]/15 text-pfg' : 'border-pline text-pmuted',
                )}
              >
                {idx + 1}-qadam
              </button>
            ))}
          </div>
        </div>

        {/* 150x150 PostCheckout Koji Speech + Knowledge Graph */}
        <div className="grid grid-cols-2 gap-3 w-full">
          <div
            onClick={() => {
              setSpeechStep((p) =>
                p === 'play_speech-one'
                  ? 'play_speech-two'
                  : p === 'play_speech-two'
                    ? 'play_speech-three'
                    : 'play_speech-one',
              )
            }}
            className="bg-pcard rounded-2xl p-3 flex flex-col items-center gap-1 cursor-pointer"
          >
            <div className="size-[130px]">
              <MvpRiveStage
                file="nux_revamp.d192d940.riv"
                artboard="MAIN_Koji-speech"
                stateMachine="NUX_Koji-speech"
                smTriggers={[speechStep]}
                pulseSmTrigger={{ name: speechStep, seq: speechStep.length + nonce }}
                dark={dark}
                nonce={nonce}
                label="NUX Koji Speech"
                className="size-full"
              />
            </div>
            <span className="text-[11px] font-bold text-pmuted">MAIN_Koji-speech (Tap)</span>
          </div>

          <div className="bg-pcard rounded-2xl p-3 flex flex-col items-center gap-1">
            <div className="size-[130px]">
              <MvpRiveStage
                file="nux-refresh.62cd2c8c.riv"
                artboard="MAIN_KnowledgeGraph"
                stateMachine="KnowledgeGraph"
                dark={dark}
                nonce={nonce}
                label="Knowledge Graph"
                className="size-full"
              />
            </div>
            <span className="text-[11px] font-bold text-pmuted">KnowledgeGraph</span>
          </div>
        </div>
      </div>
    </BrilliantEndstateShell>
  )
}

/** 15) NUX Survey Reactions & Course Cards (`nux_koji_reactions_v2`, `nux-koji`, `onboarding-koji`) */
function NuxReactionsMvp({ ctx }: { ctx: ExtraMvpCtx }) {
  const { lang, dark, nonce, onClose } = ctx
  const [ab, setAb] = useState('Koji Reaction Daily Habit')
  const abs = [
    'Koji Reaction Daily Habit',
    'Koji Reaction Goal Selector',
    'Koji Reaction Focus Selector',
    'Koji Reaction Topic Selector',
  ]
  return (
    <BrilliantEndstateShell
      primaryLabel={lang === 'ru' ? 'Закрыть' : 'Yopish'}
      onPrimaryClick={onClose}
    >
      <div className="mx-auto flex w-full max-w-[440px] flex-1 flex-col items-center justify-center gap-4 px-4 pt-12">
        <div className="size-[220px] bg-pcard rounded-3xl p-4">
          <MvpRiveStage
            file="nux_koji_reactions_v2.c14662ad.riv"
            artboard={ab}
            stateMachine="Questions Main"
            dark={dark}
            nonce={nonce}
            label={ab}
            className="size-full"
          />
        </div>
        <div className="flex flex-wrap justify-center gap-1.5">
          {abs.map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => setAb(a)}
              className={cn(
                'rounded-full border px-3 py-1 text-[11px] font-bold cursor-pointer',
                ab === a ? 'border-pprimary bg-[#3557ff]/15 text-pfg' : 'border-pline text-pmuted',
              )}
            >
              {a.replace('Koji Reaction ', '')}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3 w-full">
          <div className="bg-pcard rounded-2xl p-3 flex flex-col items-center">
            <div className="size-[110px]">
              <MvpRiveStage
                file="nux-koji.2611eb62.riv"
                artboard="koji"
                stateMachine="koji"
                smBooleans={{ Loop: true }}
                dark={dark}
                nonce={nonce}
                label="NUX Koji"
                className="size-full"
              />
            </div>
            <span className="text-[11px] font-bold text-pmuted">nux-koji (Course cards)</span>
          </div>
          <div className="bg-pcard rounded-2xl p-3 flex flex-col items-center">
            <div className="size-[110px]">
              <MvpRiveStage
                file="nux-koji-onboarding.6a89f9a2.riv"
                artboard="MAIN_KojiOnboarding"
                stateMachine="KojiOnboarding"
                dark={dark}
                nonce={nonce}
                label="Koji Onboarding"
                className="size-full"
              />
            </div>
            <span className="text-[11px] font-bold text-pmuted">MAIN_KojiOnboarding</span>
          </div>
        </div>
      </div>
    </BrilliantEndstateShell>
  )
}

/** 16) RUX Reactivation (`rux_short_apr_22_26.riv` / `rux_long_apr_22_26.riv` — `1yx7xrh_iegvh.js` 390x390 hero!) */
function RuxReactivationMvp({ ctx }: { ctx: ExtraMvpCtx }) {
  const { lang, dark, nonce, onClose } = ctx
  const [variant, setVariant] = useState<'book' | 'briefcase'>('book')

  return (
    <BrilliantEndstateShell
      primaryLabel={lang === 'ru' ? 'Вернуться к уроку' : 'Darsga qaytish'}
      secondaryLabel={variant === 'book' ? '30-kunlik (Briefcase) ni ko‘rish' : '4-kunlik (Book) ni ko‘rish'}
      onPrimaryClick={onClose}
      onSecondaryClick={() => setVariant((v) => (v === 'book' ? 'briefcase' : 'book'))}
    >
      {/* 1yx7xrh_iegvh.js: Box height 390px, width 390px (oq cheti kesilmasligi uchun keng container) */}
      <div className="mx-auto mt-6 h-[340px] w-full max-w-[376px] px-2">
        {variant === 'book' ? (
          <MvpRiveStage
            file="rux_short_apr_22_26.riv"
            artboard="MAIN_RUXKojiBook"
            stateMachine="RUXKojiBook"
            viewModel="RUXKojiBookVM"
            booleans={{ darkMode: dark }}
            vmTriggers={['playAnimation']}
            dark={dark}
            nonce={nonce}
            label="RUX Book"
            className="size-full"
          />
        ) : (
          <MvpRiveStage
            file="rux_long_apr_22_26.riv"
            artboard="MAIN_RUXKojiBriefcase"
            stateMachine="RUXKojiBriefcase"
            viewModel="RUXKojiBriefcaseVM"
            booleans={{ darkMode: dark }}
            vmTriggers={['playAnimation']}
            dark={dark}
            nonce={nonce}
            label="RUX Briefcase"
            className="size-full"
          />
        )}
      </div>
      <BrilliantCopyContainer>
        <h1 className="text-[24px] font-extrabold text-pfg">
          {variant === 'book'
            ? lang === 'ru'
              ? 'С возвращением! Продолжим?'
              : 'Xush kelibsiz! Davom etamizmi?'
            : lang === 'ru'
              ? 'Давно не виделись!'
              : 'Ancha bo‘ldi ko‘rishmaganimizga!'}
        </h1>
        <p className="text-[14px] text-pmuted">
          {variant === 'book' ? 'rux_short_apr_22_26.riv (Book)' : 'rux_long_apr_22_26.riv (Briefcase)'}
        </p>
      </BrilliantCopyContainer>
    </BrilliantEndstateShell>
  )
}

/** 17) Marketing Landing Hero (`lohp-cta-koji-rive` & `lohp_koji_entrance`) */
function LohpHeroMvp({ ctx }: { ctx: ExtraMvpCtx }) {
  const { lang, dark, nonce, onClose } = ctx
  return (
    <BrilliantEndstateShell
      primaryLabel={lang === 'ru' ? 'Закрыть' : 'Yopish'}
      onPrimaryClick={onClose}
    >
      <div className="mx-auto flex w-full max-w-[440px] flex-1 flex-col items-center justify-center gap-4 px-4 pt-10">
        <div className="bg-pcard w-full rounded-2xl p-4 flex flex-col items-center gap-0 overflow-hidden">
          <div className="w-full h-[180px]">
            <MvpRiveStage
              file="lohp-cta-koji-rive.ad3fb542.riv"
              artboard="LOHP_TOP"
              stateMachine="LOHP_TOP-A-Synced"
              smTriggers={['play_watchShine']}
              dark={dark}
              nonce={nonce}
              label="LOHP Top Hero"
              className="size-full"
            />
          </div>
          <Button variant="primary" block onClick={onClose}>
            {lang === 'ru' ? 'Начать обучение' : 'Bepul boshlash'}
          </Button>
          <span className="mt-2.5 text-[12px] font-bold text-pmuted">lohp-cta-koji-rive (LOHP_TOP Hero)</span>
        </div>

        <div className="bg-pcard w-full rounded-2xl p-4 flex flex-col items-center gap-2">
          <div className="w-full h-[210px]">
            <MvpRiveStage
              file="lohp_koji_entrance.344647d5.riv"
              artboard="MAIN_KojiEntrance"
              stateMachine="KojiEntrance"
              viewModel="KojiEntranceVM"
              booleans={{ darkMode: dark }}
              vmTriggers={['playAnimation']}
              dark={dark}
              nonce={nonce}
              label="LOHP Koji Entrance"
              className="size-full"
            />
          </div>
          <span className="text-[12px] font-bold text-pmuted">lohp_koji_entrance (MeetKojiSection)</span>
        </div>
      </div>
    </BrilliantEndstateShell>
  )
}

export function renderExtraMvpScreen(id: ExtraMvpScreenId, ctx: ExtraMvpCtx) {
  switch (id) {
    case 'opt-in':
      return <OptInMvp ctx={ctx} />
    case 'premium-bar':
      return <PremiumChartNudgeMvp ctx={ctx} variant="bar" />
    case 'premium-line':
      return <PremiumChartNudgeMvp ctx={ctx} variant="line" />
    case 'personalized-practice':
      return <PersonalizedPracticeFullscreenMvp ctx={ctx} />
    case 'practice-nudge-modal':
      return <PersonalizedPracticeModalMvp ctx={ctx} />
    case 'sale-promo':
      return <SalePromoMvp ctx={ctx} />
    case 'review-complete':
    case 'level-check-transition':
    case 'assessment-intro':
    case 'warm-up':
      return <LevelCheckExtraMvp ctx={ctx} mode={id} />
    case 'practice-tray':
      return <PracticeTrayMvp ctx={ctx} />
    case 'in-lesson-lightning':
      return <InLessonLightningMvp ctx={ctx} />
    case 'koji-speech-bubble':
      return <KojiSpeechBubbleMvp ctx={ctx} />
    case 'ask-koji-ai':
      return <AskKojiAiMvp ctx={ctx} />
    case 'icp-node':
      return <IcpNodeMvp ctx={ctx} />
    case 'level-insertion-acceptance':
    case 'ondemand-loader':
    case 'master-loader':
      return <InsertionAndLoadersMvp ctx={ctx} mode={id} />
    case 'habit-screen':
      return <HabitScreenMvp ctx={ctx} />
    case 'koji-speech-steps':
      return <KojiSpeechStepsMvp ctx={ctx} />
    case 'nux-reactions':
      return <NuxReactionsMvp ctx={ctx} />
    case 'rux-reactivation':
      return <RuxReactivationMvp ctx={ctx} />
    case 'lohp-hero':
      return <LohpHeroMvp ctx={ctx} />
  }
}

export const EXTRA_ICONS = { Flame, Lock }
