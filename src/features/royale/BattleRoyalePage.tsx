import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Crown, Shield, ShieldOff, Users, Clock3, Layers, Trophy, Eye, Zap, CheckCircle2, XCircle, RotateCcw,
} from 'lucide-react'
import { useAppStore } from '../../shared/store/useAppStore'
import { useSubjectStore } from '../../shared/store/useSubjectStore'
import { useT } from '../../shared/i18n'
import { config } from '../../shared/config'
import { getInitData } from '../../platform/telegram'
import { getSessionToken } from '../../shared/lib/session'
import { haptics } from '../../platform/haptics'
import { playSound } from '../../shared/lib/sounds'
import { goBack } from '../../shared/lib/navigation'
import { getOctagonSocket, type ConnStatus, type DuelQuestion, type OctagonMsg } from '../../shared/lib/octagon-ws'
import { PageHeader } from '../../shared/components/ui/page-header'
import { Button } from '../../shared/components/ui/button'
import MathText from '../../shared/components/MathText'
import {
  ROYALE_FREE_SHIELDS,
  ROYALE_QUESTION_SECONDS,
  ROYALE_ROUNDS,
  secondsUntilNextDailyShow,
  type RoyaleFinishedPayload,
  type RoyaleLobbySnapshot,
  type RoyalePhase,
  type RoyalePlayerStatus,
  type RoyaleRevealPayload,
} from '../../../shared/battle-royale'

function wsAuthFields(): { initData?: string; sessionToken?: string } {
  const sessionToken = getSessionToken()
  if (sessionToken) return { sessionToken }
  const initData = getInitData()
  return initData ? { initData } : {}
}

function formatClock(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec))
  const hh = Math.floor(s / 3600)
  const mm = Math.floor((s % 3600) / 60)
  const ss = s % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return hh > 0 ? `${pad(hh)}:${pad(mm)}:${pad(ss)}` : `${pad(mm)}:${pad(ss)}`
}

export default function BattleRoyalePage() {
  const navigate = useNavigate()
  const user = useAppStore((s) => s.user)
  const lang = useAppStore((s) => s.settings.language)
  const subject = useSubjectStore((s) => s.subject)
  const tt = useT(lang)
  const ru = lang === 'ru'

  const [conn, setConn] = useState<ConnStatus>('connecting')
  const [joined, setJoined] = useState(false)
  const [phase, setPhase] = useState<RoyalePhase>('lobby')
  const [lobby, setLobby] = useState<RoyaleLobbySnapshot | null>(null)
  const [countdown, setCountdown] = useState<number>(3)
  const [round, setRound] = useState<number>(0)
  const [totalRounds, setTotalRounds] = useState<number>(ROYALE_ROUNDS)
  const [aliveCount, setAliveCount] = useState<number>(0)
  const [totalPlayers, setTotalPlayers] = useState<number>(0)
  const [yourStatus, setYourStatus] = useState<RoyalePlayerStatus>('alive')
  const [shieldsLeft, setShieldsLeft] = useState<number>(ROYALE_FREE_SHIELDS)
  const [question, setQuestion] = useState<DuelQuestion | null>(null)
  const [deadline, setDeadline] = useState<number | null>(null)
  const [timeLeft, setTimeLeft] = useState<number>(ROYALE_QUESTION_SECONDS)
  const [selectedOption, setSelectedOption] = useState<string | null>(null)
  const [reveal, setReveal] = useState<RoyaleRevealPayload | null>(null)
  const [finished, setFinished] = useState<RoyaleFinishedPayload | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [dailyShowSec, setDailyShowSec] = useState<number>(() => secondsUntilNextDailyShow())

  const joinedRef = useRef(false)
  joinedRef.current = joined

  // Kunlik 21:00 shou taymeri (har 1s)
  useEffect(() => {
    const id = window.setInterval(() => {
      setDailyShowSec(secondsUntilNextDailyShow())
    }, 1000)
    return () => window.clearInterval(id)
  }, [])

  // Savol taymeri
  useEffect(() => {
    if (phase !== 'question' || !deadline) return
    const tick = () => {
      const rem = Math.max(0, Math.ceil((deadline - Date.now()) / 1000))
      setTimeLeft(rem)
    }
    tick()
    const id = window.setInterval(tick, 200)
    return () => window.clearInterval(id)
  }, [phase, deadline])

  // Countdown (3..2..1)
  useEffect(() => {
    if (phase !== 'countdown') return
    const id = window.setInterval(() => {
      setCountdown((c) => Math.max(1, c - 1))
    }, 1000)
    return () => window.clearInterval(id)
  }, [phase])

  const sendJoin = useCallback(() => {
    if (!config.wsUrl || !user?.id) return
    const sock = getOctagonSocket(config.wsUrl)
    sock.send({
      type: 'royale_join',
      userId: user.id,
      name: user.firstName || "O'quvchi",
      subjectId: subject.id,
      ...wsAuthFields(),
    })
    setJoined(true)
    setErrorMsg(null)
    setFinished(null)
    setReveal(null)
    setSelectedOption(null)
  }, [user, subject.id])

  useEffect(() => {
    if (!config.wsUrl) {
      setConn('failed')
      return
    }
    const sock = getOctagonSocket(config.wsUrl)

    const unsubStatus = sock.onStatus((st) => {
      setConn(st)
      if (st === 'open') {
        sock.send({ type: 'royale_status', subjectId: subject.id })
        if (joinedRef.current && user?.id) {
          sock.send({
            type: 'royale_join',
            userId: user.id,
            name: user.firstName || "O'quvchi",
            subjectId: subject.id,
            ...wsAuthFields(),
          })
        }
      }
    })

    const unsubMsg = sock.on((msg: OctagonMsg) => {
      if (msg.type === 'royale_lobby') {
        setLobby(msg)
        setPhase(msg.phase)
        setAliveCount(msg.aliveCount)
        setTotalPlayers(msg.playerCount)
      } else if (msg.type === 'royale_state') {
        setPhase(msg.phase)
        setCountdown(msg.countdownSec)
        setTotalPlayers(msg.totalPlayers)
        setAliveCount(msg.aliveCount)
        setTotalRounds(msg.totalRounds)
        setReveal(null)
        setSelectedOption(null)
        playSound('click')
      } else if (msg.type === 'royale_question') {
        setPhase('question')
        setRound(msg.round)
        setTotalRounds(msg.totalRounds)
        setAliveCount(msg.aliveCount)
        setTotalPlayers(msg.totalPlayers)
        setYourStatus(msg.yourStatus)
        setShieldsLeft(msg.shieldsLeft)
        setQuestion(msg.question ?? null)
        setSelectedOption(null)
        setReveal(null)
        setTimeLeft(msg.timeLimit)
        setDeadline(Date.now() + msg.timeLimit * 1000)
      } else if (msg.type === 'royale_answer_ack') {
        setSelectedOption(msg.optionId)
      } else if (msg.type === 'royale_reveal') {
        setPhase('reveal')
        setReveal(msg)
        setAliveCount(msg.aliveCount)
        setTotalPlayers(msg.totalPlayers)
        setYourStatus(msg.yourStatus)
        setShieldsLeft(msg.shieldsLeft)
        setDeadline(null)
        if (msg.yourOutcome === 'correct') {
          playSound('correct')
          haptics.impact('light')
        } else if (msg.yourOutcome === 'shield_saved') {
          playSound('click')
          haptics.impact('medium')
        } else if (msg.yourOutcome === 'eliminated') {
          playSound('incorrect')
          haptics.impact('heavy')
        }
      } else if (msg.type === 'royale_finished') {
        setPhase('finished')
        setFinished(msg)
        setJoined(false)
        setDeadline(null)
        playSound('correct')
        haptics.impact('heavy')
      } else if (msg.type === 'error' && (msg.message === 'royale_full' || msg.message === 'questions_unavailable')) {
        setErrorMsg(
          msg.message === 'royale_full'
            ? (ru ? 'Арена заполнена (200/200)' : 'Arena to‘ldi (200/200)')
            : (ru ? 'Вопросы временно недоступны' : 'Savollar vaqtincha mavjud emas'),
        )
      }
    })

    sock.connect()

    return () => {
      unsubStatus()
      unsubMsg()
      if (joinedRef.current) {
        sock.send({ type: 'royale_leave' })
      }
    }
  }, [subject.id, user?.id, user?.firstName, ru])

  const handleLeave = () => {
    if (config.wsUrl && joined) {
      getOctagonSocket(config.wsUrl).send({ type: 'royale_leave' })
      setJoined(false)
    }
    goBack(navigate)
  }

  const handleStartNow = () => {
    if (!config.wsUrl) return
    haptics.impact('heavy')
    playSound('click')
    getOctagonSocket(config.wsUrl).send({ type: 'royale_start_now' })
  }

  const handleAnswer = (optionId: string) => {
    if (!config.wsUrl || phase !== 'question' || selectedOption || yourStatus !== 'alive') return
    haptics.impact('light')
    setSelectedOption(optionId)
    getOctagonSocket(config.wsUrl).send({
      type: 'royale_answer',
      round,
      optionId,
    })
  }

  const options = useMemo(() => {
    if (!question) return []
    const map = ru ? question.optionsRu : question.optionsUz
    return Object.entries(map)
  }, [question, ru])

  const questionText = question ? (ru ? question.textRu : question.textUz) : ''
  const alivePct = totalPlayers > 0 ? Math.max(4, Math.round((aliveCount / totalPlayers) * 100)) : 100

  return (
    <div className="min-h-full flex flex-col bg-pcanvas text-pfg">
      <PageHeader
        title={ru ? 'Battle Royale' : 'Battle Royale'}
        subtitle={ru ? 'Живой турнир на выбывание' : 'Jonli chiqarib yuborish turniri'}
        backLabel={tt('backWord')}
        onBack={handleLeave}
      />

      <main className="flex-1 w-full max-w-xl mx-auto px-4 pb-8 pt-2 flex flex-col gap-4">
        {errorMsg && (
          <div className="rounded-2xl border-2 border-pdanger bg-pcard px-4 py-3 text-[13px] font-bold text-pdanger">
            {errorMsg}
          </div>
        )}

        {/* ── LOBBY ── */}
        {phase === 'lobby' && (
          <>
            <section className="rounded-3xl border-2 border-pline bg-pcard p-5 shadow-[0_3px_0_var(--p-line)] flex flex-col gap-4">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[rgb(var(--p-primary-rgb)/0.14)] px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.06em] text-pprimary">
                  <Crown size={13} strokeWidth={2.4} />
                  {ru ? 'Живой турнир · 21:00' : 'Jonli turnir · 21:00'}
                </span>
                <span className="inline-flex items-center gap-1.5 text-[12px] font-bold tabular-nums text-pmuted">
                  <Clock3 size={14} />
                  {formatClock(dailyShowSec)}
                </span>
              </div>

              <div>
                <h2 className="font-display text-[22px] font-extrabold tracking-[-0.02em] text-pfg leading-tight">
                  {ru ? 'Турнир на выбывание — до последнего!' : 'Oxirgi g‘olibgacha — jonli arena!'}
                </h2>
                <p className="mt-1.5 text-[13px] font-medium text-pmuted leading-snug">
                  {ru
                    ? 'Без монет: только знания и скорость. 1 бесплатный щит спасает от первой ошибки.'
                    : 'Coinsiz: faqat bilim va tezlik. 1 ta bepul qalqon birinchi xatodan qutqaradi.'}
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-2xl border-2 border-pline bg-psurface px-3 py-2.5 text-center">
                  <Layers size={16} className="mx-auto text-pprimary mb-1" />
                  <p className="text-[14px] font-extrabold tabular-nums text-pfg">{ROYALE_ROUNDS}</p>
                  <p className="text-[11px] font-semibold text-pmuted">{ru ? 'вопросов' : 'savol'}</p>
                </div>
                <div className="rounded-2xl border-2 border-pline bg-psurface px-3 py-2.5 text-center">
                  <Clock3 size={16} className="mx-auto text-pprimary mb-1" />
                  <p className="text-[14px] font-extrabold tabular-nums text-pfg">{ROYALE_QUESTION_SECONDS}s</p>
                  <p className="text-[11px] font-semibold text-pmuted">{ru ? 'на ответ' : 'har savol'}</p>
                </div>
                <div className="rounded-2xl border-2 border-pline bg-psurface px-3 py-2.5 text-center">
                  <Shield size={16} className="mx-auto text-psuccess mb-1" />
                  <p className="text-[14px] font-extrabold tabular-nums text-pfg">{ROYALE_FREE_SHIELDS}</p>
                  <p className="text-[11px] font-semibold text-pmuted">{ru ? 'щит (беспл.)' : 'bepul qalqon'}</p>
                </div>
              </div>

              <div className="rounded-2xl border-2 border-pline bg-psurface p-3.5">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="inline-flex items-center gap-1.5 text-[12.5px] font-bold text-pfg">
                    <Users size={15} className="text-pprimary" />
                    {ru ? 'В лобби сейчас:' : 'Hozir lobbi ichida:'}{' '}
                    <strong className="tabular-nums">{lobby?.playerCount ?? 0}</strong> / {lobby?.maxPlayers ?? 200}
                  </span>
                  {lobby?.startsInSec !== null && lobby?.startsInSec !== undefined && (
                    <span className="rounded-full bg-pprimary px-2.5 py-0.5 text-[11px] font-extrabold tabular-nums text-white">
                      {ru ? `Старт: ${lobby.startsInSec}с` : `Start: ${lobby.startsInSec}s`}
                    </span>
                  )}
                </div>

                {lobby && lobby.players.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {lobby.players.map((p) => (
                      <span
                        key={p.userId}
                        className="rounded-full border-2 border-pline bg-pcard px-2.5 py-1 text-[11.5px] font-bold text-pfg"
                      >
                        {p.name}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-[12px] font-medium text-pmuted">
                    {conn === 'open'
                      ? (ru ? 'Будьте первым в арене — приглашайте друзей!' : 'Arenaga birinchi bo‘lib kiring — do‘stlar qo‘shilishi bilan start!')
                      : (ru ? 'Подключение к серверу…' : 'Serverga ulanmoqda…')}
                  </p>
                )}
              </div>

              {!joined ? (
                <Button
                  type="button"
                  variant="primary"
                  size="lg"
                  block
                  sheen
                  disabled={conn !== 'open' || !user?.id}
                  onClick={() => {
                    haptics.impact('heavy')
                    playSound('click')
                    sendJoin()
                  }}
                >
                  <Zap size={18} />
                  {ru ? 'Войти в арену' : 'Arenaga kirish'}
                </Button>
              ) : (
                <div className="flex flex-col gap-2.5">
                  <Button
                    type="button"
                    variant="primary"
                    size="lg"
                    block
                    sheen
                    onClick={handleStartNow}
                  >
                    <Zap size={18} />
                    {ru ? 'Начать сейчас' : 'Hozir boshlash'}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="default"
                    block
                    onClick={() => {
                      if (config.wsUrl) getOctagonSocket(config.wsUrl).send({ type: 'royale_leave' })
                      setJoined(false)
                    }}
                  >
                    {ru ? 'Покинуть лобби' : 'Lobbini tark etish'}
                  </Button>
                </div>
              )}
            </section>
          </>
        )}

        {/* ── COUNTDOWN (3..2..1) ── */}
        {phase === 'countdown' && (
          <section className="rounded-3xl border-2 border-pline bg-pcard p-10 text-center shadow-[0_3px_0_var(--p-line)] flex flex-col items-center gap-3">
            <span className="text-[12px] font-extrabold uppercase tracking-[0.08em] text-pprimary">
              {ru ? 'Приготовьтесь!' : 'Tayyorlaning!'}
            </span>
            <p className="font-display text-[72px] font-extrabold leading-none tabular-nums text-pfg">
              {countdown}
            </p>
            <p className="text-[14px] font-bold text-pmuted">
              {totalPlayers} {ru ? 'игроков в арене' : 'o‘yinchi arenada'}
            </p>
          </section>
        )}

        {/* ── QUESTION & REVEAL ── */}
        {(phase === 'question' || phase === 'reveal') && (
          <>
            {/* Live Survivor Bar */}
            <section className="rounded-2xl border-2 border-pline bg-pcard p-3.5 shadow-[0_2px_0_var(--p-line)]">
              <div className="flex items-center justify-between gap-2 text-[12.5px] font-extrabold">
                <span className="inline-flex items-center gap-1.5 text-pfg tabular-nums">
                  <Users size={15} className="text-pprimary" />
                  {ru ? 'В игре:' : 'Tiriklar:'} {aliveCount} / {totalPlayers}
                </span>
                <span className="tabular-nums text-pmuted">
                  {round + 1} / {totalRounds}
                </span>
                <span className="inline-flex items-center gap-1 tabular-nums">
                  {yourStatus === 'eliminated' ? (
                    <span className="inline-flex items-center gap-1 text-pmuted">
                      <Eye size={14} /> {ru ? 'Зритель' : 'Tomoshabin'}
                    </span>
                  ) : shieldsLeft > 0 ? (
                    <span className="inline-flex items-center gap-1 text-psuccess">
                      <Shield size={14} /> {shieldsLeft}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-pdanger">
                      <ShieldOff size={14} /> 0
                    </span>
                  )}
                </span>
              </div>

              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-psurface">
                <div
                  className="h-full rounded-full bg-pprimary transition-[width] duration-300"
                  style={{ width: `${alivePct}%` }}
                />
              </div>

              {phase === 'question' && (
                <div className="mt-2 flex items-center justify-between text-[12px] font-bold">
                  <span className="text-pmuted">
                    {yourStatus === 'eliminated'
                      ? (ru ? 'Вы выбыли — наблюдаете за финалом' : 'Siz chiqib ketdingiz — finalni kuzatyapsiz')
                      : (ru ? 'Выберите верный ответ' : 'To‘g‘ri javobni tanlang')}
                  </span>
                  <span className={`tabular-nums font-extrabold ${timeLeft <= 4 ? 'text-pdanger' : 'text-pfg'}`}>
                    {timeLeft}s
                  </span>
                </div>
              )}
            </section>

            {/* Reveal Outcome Banner */}
            {phase === 'reveal' && reveal && (
              <div
                className={`rounded-2xl border-2 p-3.5 flex items-center justify-between gap-3 ${
                  reveal.yourOutcome === 'correct'
                    ? 'border-psuccess bg-[rgb(var(--p-success-rgb)/0.12)] text-psuccess'
                    : reveal.yourOutcome === 'shield_saved'
                      ? 'border-pwarning bg-[rgb(var(--p-warning-rgb)/0.14)] text-pwarning'
                      : reveal.yourOutcome === 'eliminated'
                        ? 'border-pdanger bg-[rgb(var(--p-danger-rgb)/0.12)] text-pdanger'
                        : 'border-pline bg-pcard text-pmuted'
                }`}
              >
                <div className="flex items-center gap-2 text-[13.5px] font-extrabold">
                  {reveal.yourOutcome === 'correct' && <CheckCircle2 size={18} />}
                  {reveal.yourOutcome === 'shield_saved' && <Shield size={18} />}
                  {reveal.yourOutcome === 'eliminated' && <XCircle size={18} />}
                  {reveal.yourOutcome === 'spectator' && <Eye size={18} />}
                  <span>
                    {reveal.yourOutcome === 'correct' && (ru ? 'Верно! Вы в игре' : 'To‘g‘ri! Siz o‘yindasiz')}
                    {reveal.yourOutcome === 'shield_saved' && (ru ? 'Щит спас вас от выбывания!' : 'Qalqon sizni qutqarib qoldi!')}
                    {reveal.yourOutcome === 'eliminated' && (ru ? 'Вы выбыли — режим зрителя' : 'Chiqib ketdingiz — tomoshabin rejimi')}
                    {reveal.yourOutcome === 'spectator' && (ru ? 'Раунд завершён' : 'Raund yakunlandi')}
                  </span>
                </div>
                {reveal.eliminatedThisRound > 0 && (
                  <span className="shrink-0 rounded-full bg-pdanger px-2.5 py-0.5 text-[11px] font-extrabold text-white tabular-nums">
                    −{reveal.eliminatedThisRound}
                  </span>
                )}
              </div>
            )}

            {/* Question Card */}
            {question && (
              <section className="rounded-3xl border-2 border-pline bg-pcard p-4 shadow-[0_3px_0_var(--p-line)] flex flex-col gap-3">
                {question.image && (
                  <img
                    src={question.image}
                    alt=""
                    className="w-full max-h-48 object-contain rounded-2xl bg-psurface"
                  />
                )}
                <div className="text-[15.5px] font-bold leading-snug text-pfg">
                  <MathText text={questionText} />
                </div>

                <div className="flex flex-col gap-2.5 mt-1">
                  {options.map(([optId, optText]) => {
                    const isPicked = selectedOption === optId
                    const isCorrect = phase === 'reveal' && reveal?.correctOptionId === optId
                    const isWrongPick = phase === 'reveal' && isPicked && reveal?.correctOptionId !== optId

                    let stateCls = 'border-pline bg-pcard text-pfg hover:bg-psurface'
                    if (isCorrect) stateCls = 'border-psuccess bg-[rgb(var(--p-success-rgb)/0.14)] text-pfg'
                    else if (isWrongPick) stateCls = 'border-pdanger bg-[rgb(var(--p-danger-rgb)/0.14)] text-pfg'
                    else if (isPicked) stateCls = 'border-pprimary bg-[rgb(var(--p-primary-rgb)/0.12)] text-pfg'

                    return (
                      <button
                        key={optId}
                        type="button"
                        disabled={phase !== 'question' || Boolean(selectedOption) || yourStatus !== 'alive'}
                        onClick={() => handleAnswer(optId)}
                        className={`w-full rounded-2xl border-2 px-4 py-3 text-left text-[14px] font-bold transition-[transform,background-color,border-color] duration-100 active:translate-y-[1px] disabled:cursor-default ${stateCls}`}
                      >
                        <MathText text={optText} />
                      </button>
                    )
                  })}
                </div>
              </section>
            )}
          </>
        )}

        {/* ── PODIUM / FINISHED ── */}
        {phase === 'finished' && finished && (
          <section className="rounded-3xl border-2 border-pline bg-pcard p-5 shadow-[0_3px_0_var(--p-line)] flex flex-col gap-4 text-center">
            <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-[rgb(var(--p-warning-rgb)/0.16)] text-pwarning">
              <Trophy size={32} strokeWidth={2.2} />
            </div>

            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-pprimary">
                {ru ? 'Турнир завершён' : 'Turnir yakunlandi'}
              </p>
              <h2 className="mt-1 font-display text-[26px] font-extrabold text-pfg tabular-nums">
                #{finished.yourRank} / {finished.totalPlayers}
              </h2>
              <p className="mt-1 text-[13px] font-semibold text-pmuted">
                {ru
                  ? `Верных ответов: ${finished.yourCorrect} из ${finished.roundsPlayed}`
                  : `To‘g‘ri javoblar: ${finished.yourCorrect} / ${finished.roundsPlayed}`}
              </p>
            </div>

            <div className="flex flex-col gap-2 text-left">
              {finished.podium.map((entry, idx) => (
                <div
                  key={entry.userId}
                  className="flex items-center justify-between gap-3 rounded-2xl border-2 border-pline bg-psurface px-3.5 py-2.5"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-[18px]" aria-hidden="true">
                      {idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'}
                    </span>
                    <span className="truncate text-[14px] font-extrabold text-pfg">{entry.name}</span>
                  </div>
                  <span className="shrink-0 text-[12.5px] font-extrabold tabular-nums text-pprimary">
                    {entry.correctCount}/{finished.roundsPlayed}
                  </span>
                </div>
              ))}
            </div>

            <Button
              type="button"
              variant="primary"
              size="lg"
              block
              sheen
              onClick={() => {
                haptics.impact('light')
                setPhase('lobby')
                setFinished(null)
                sendJoin()
              }}
            >
              <RotateCcw size={17} />
              {ru ? 'Сыграть снова' : 'Yana o‘ynash'}
            </Button>
          </section>
        )}
      </main>
    </div>
  )
}
