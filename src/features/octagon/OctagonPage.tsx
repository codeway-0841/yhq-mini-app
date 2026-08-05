import { useEffect, useReducer, useCallback, useRef, useState } from 'react'
import { useNavigate, useLocation, useParams } from 'react-router-dom'
import { goBack } from '../../lib/navigation'
import { Sword, X, Loader2, WifiOff, RefreshCw, UserPlus, Share2 } from 'lucide-react'
import { useAppStore }    from '../../shared/store/useAppStore'
import { useT }           from '../../shared/i18n'
import { useQuestionsStore } from '../../store/useQuestionsStore'
import { useSubjectStore } from '../../store/useSubjectStore'
import { getOctagonSocket, destroyOctagonSocket, type OctagonMsg, type ConnStatus } from '../../shared/lib/octagon-ws'
import { config }         from '../../config'
import { track }          from '../../lib/analytics'
import { shareUrl }       from '../../lib/telegram'

type Phase = 'idle' | 'searching' | 'matched' | 'in_round' | 'match_end'

/** Server raund deadline'igacha bo'lgan qolgan soniyalar (null — raund yo'q). */
function useCountdown(deadline: number | null): number | null {
  const [left, setLeft] = useState<number | null>(null)
  useEffect(() => {
    if (!deadline) { setLeft(null); return }
    const tick = () => setLeft(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)))
    tick()
    const t = setInterval(tick, 250)
    return () => clearInterval(t)
  }, [deadline])
  return left
}

/** Silliq (60fps) raund progress 0..1 — progress bar uchun. */
function useRoundProgress(deadline: number | null): number {
  const [pct, setPct] = useState(1)
  useEffect(() => {
    if (!deadline) { setPct(1); return }
    const total = deadline - Date.now() || 1
    let raf = 0
    const step = () => {
      setPct(Math.max(0, Math.min(1, (deadline - Date.now()) / total)))
      if (Date.now() < deadline) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [deadline])
  return pct
}

interface State {
  phase: Phase; matchId: string | null; opponentName: string | null
  roundCount: number; roundIndex: number; currentQuestionId: number | null
  yourScore: number; oppScore: number
  selected: string | null; ackCorrect: boolean | null; oppAnswered: boolean
  oppWait: number | null; deadline: number | null
  result: 'win' | 'lose' | 'draw' | null; toastMsg: string | null
}

type Action =
  | { type: 'SEARCHING' }
  | { type: 'CANCEL' }
  | { type: 'MATCHED';      matchId: string; opponentName: string; roundCount: number }
  | { type: 'START_ROUND';  index: number; questionId: number; timeLimit: number }
  | { type: 'SELECT';       optionId: string }
  | { type: 'ANSWER_ACK';   correct: boolean }
  | { type: 'OPP_ANSWERED' }
  | { type: 'ROUND_RESULT'; yourScore: number; oppScore: number }
  | { type: 'MATCH_END';    yourScore: number; oppScore: number; result: 'win' | 'lose' | 'draw' }
  | { type: 'OPP_DISCONNECTED' }
  | { type: 'OPP_WAIT';     waitSeconds: number }
  | { type: 'OPP_BACK' }
  | { type: 'SYNC';         matchId: string; index: number; questionId: number | null
      timeLimit: number
      roundCount: number; yourScore: number; oppScore: number
      opponentName: string; yourAnswer: string | null; oppAnswered: boolean }
  | { type: 'TOAST';        msg: string }
  | { type: 'CLEAR_TOAST' }

const INIT: State = {
  phase: 'idle', matchId: null, opponentName: null,
  roundCount: 0, roundIndex: 0, currentQuestionId: null,
  yourScore: 0, oppScore: 0,
  selected: null, ackCorrect: null, oppAnswered: false, oppWait: null, deadline: null,
  result: null, toastMsg: null,
}

function reducer(s: State, a: Action): State {
  switch (a.type) {
    case 'SEARCHING':        return { ...INIT, phase: 'searching' }
    case 'CANCEL':           return { ...INIT }
    case 'MATCHED':          return { ...s, phase: 'matched', matchId: a.matchId, opponentName: a.opponentName, roundCount: a.roundCount }
    case 'START_ROUND':      return { ...s, phase: 'in_round', roundIndex: a.index, currentQuestionId: a.questionId, selected: null, ackCorrect: null, oppAnswered: false, deadline: Date.now() + a.timeLimit }
    case 'SELECT':           return { ...s, selected: a.optionId }
    case 'ANSWER_ACK':       return { ...s, ackCorrect: a.correct }
    case 'OPP_ANSWERED':     return { ...s, oppAnswered: true }
    case 'ROUND_RESULT':     return { ...s, yourScore: a.yourScore, oppScore: a.oppScore }
    case 'MATCH_END':        return { ...s, phase: 'match_end', yourScore: a.yourScore, oppScore: a.oppScore, result: a.result }
    case 'OPP_DISCONNECTED': return { ...s, phase: 'match_end', result: 'win', oppWait: null, toastMsg: "Raqib qaytmadi — g'alaba sizniki!" }
    case 'OPP_WAIT':         return { ...s, oppWait: a.waitSeconds }
    case 'OPP_BACK':         return { ...s, oppWait: null }
    case 'SYNC':             return { ...INIT, phase: 'in_round', matchId: a.matchId, opponentName: a.opponentName,
                                      roundCount: a.roundCount, roundIndex: a.index, currentQuestionId: a.questionId,
                                      yourScore: a.yourScore, oppScore: a.oppScore,
                                      selected: a.yourAnswer, oppAnswered: a.oppAnswered,
                                      deadline: Date.now() + a.timeLimit }
    case 'TOAST':            return { ...s, toastMsg: a.msg }
    case 'CLEAR_TOAST':      return { ...s, toastMsg: null }
    default: return s
  }
}

export default function OctagonPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, settings } = useAppStore()
  const questions = useQuestionsStore((s) => s.questions)
  const tt = useT(settings.language)
  const [s, dispatch] = useReducer(reducer, INIT)
  const [conn, setConn] = useState<ConnStatus>('connecting')
  const timeLeft = useCountdown(s.deadline)
  const roundPct = useRoundProgress(s.deadline)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showToast = useCallback((msg: string) => {
    dispatch({ type: 'TOAST', msg })
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => dispatch({ type: 'CLEAR_TOAST' }), 3000)
  }, [])

  const handleMsg = useCallback((msg: OctagonMsg) => {
    switch (msg.type) {
      case 'matched':          dispatch({ type: 'MATCHED',      matchId: msg.matchId, opponentName: msg.opponentName, roundCount: msg.roundCount }); break
      case 'question':         dispatch({ type: 'START_ROUND',  index: msg.index, questionId: msg.questionId, timeLimit: msg.timeLimit }); break
      case 'answer_ack':       dispatch({ type: 'ANSWER_ACK',   correct: msg.correct }); break
      case 'opp_answered':     dispatch({ type: 'OPP_ANSWERED' }); break
      case 'round_result':     dispatch({ type: 'ROUND_RESULT', yourScore: msg.yourScore, oppScore: msg.oppScore }); break
      case 'match_end':        dispatch({ type: 'MATCH_END',    yourScore: msg.yourScore, oppScore: msg.oppScore, result: msg.result }); break
      case 'opp_disconnected': dispatch({ type: 'OPP_DISCONNECTED' }); break
      case 'opp_waiting':      dispatch({ type: 'OPP_WAIT', waitSeconds: msg.waitSeconds }); break
      case 'opp_reconnected':  dispatch({ type: 'OPP_BACK' }); showToast('Raqib qaytdi'); break
      case 'match_state':
        dispatch({ type: 'SYNC', matchId: msg.matchId, index: msg.index, questionId: msg.questionId,
                   timeLimit: msg.timeLimit,
                   roundCount: msg.roundCount, yourScore: msg.yourScore, oppScore: msg.oppScore,
                   opponentName: msg.opponentName, yourAnswer: msg.yourAnswer, oppAnswered: msg.oppAnswered })
        break
      case 'error':
        showToast(msg.message)
        // 'searching' holatda HAR QANDAY server xatosi navbatni bekor qiladi —
        // aks holda spinner cheksiz aylanadi (server_full, auth_failed, already_in_match h.k.)
        if (phaseRef.current === 'searching') dispatch({ type: 'CANCEL' })
        break
    }
  }, [showToast])

  const [attempt, setAttempt] = useState(0)
  const userRef  = useRef(user)
  userRef.current  = user
  const phaseRef = useRef(s.phase)
  phaseRef.current = s.phase
  const matchIdRef = useRef(s.matchId)
  matchIdRef.current = s.matchId
  const subjectId = useSubjectStore((st) => st.subjectId)
  const subjectRef = useRef(subjectId)
  subjectRef.current = subjectId

  useEffect(() => {
    const sock = getOctagonSocket(config.wsUrl)
    const offMsg    = sock.on(handleMsg)
    const offStatus = sock.onStatus((st) => {
      setConn(st)
      // 5 ta urinishdan keyin ham ulanib bo'lmasa — server navbat entrysi allaqachon
      // o'chirilgan, "searching" spinnerini avtomatik to'xtatamiz.
      if (st === 'failed' && phaseRef.current === 'searching') dispatch({ type: 'CANCEL' })
      const u = userRef.current
      if (st !== 'open' || !u) return
      const initData = (window as { Telegram?: { WebApp?: { initData?: string } } })
        .Telegram?.WebApp?.initData
      try {
        // Server drops the queue entry when the old socket dies — rejoin silently.
        if (phaseRef.current === 'searching') {
          sock.send({ type: 'join_queue', userId: u.id, name: u.firstName, subjectId: subjectRef.current, ...(duelCodeRef.current ? { duelCode: duelCodeRef.current } : {}), ...(initData ? { initData } : {}) })
        } else if ((phaseRef.current === 'in_round' || phaseRef.current === 'matched') && matchIdRef.current) {
          // Mid-match reconnect within the server grace window — state resyncs.
          sock.send({ type: 'rejoin', matchId: matchIdRef.current, userId: u.id, name: u.firstName, ...(initData ? { initData } : {}) })
        }
      } catch { /* next status change retries */ }
    })
    return () => { offMsg(); offStatus() }
  }, [handleMsg, attempt])

  const retryConnect = useCallback(() => {
    destroyOctagonSocket()
    setAttempt((a) => a + 1)
  }, [])

  useEffect(() => {
    return () => {
      if (s.phase === 'searching' && user?.id) {
        try { getOctagonSocket(config.wsUrl).send({ type: 'leave_queue', userId: user.id }) }
        catch { /* socket may be closed */ }
      }
    }
  }, [s.phase, user?.id])

  const routeDuelCode = useParams().duelCode
  const [duelCode, setDuelCode] = useState<string | null>(
    routeDuelCode ?? (location.state as { duelCode?: string } | null)?.duelCode ?? null
  )
  const duelCodeRef = useRef(duelCode)
  duelCodeRef.current = duelCode

  const joinQueue = useCallback((withDuel?: string) => {
    if (!user) return
    if (withDuel) setDuelCode(withDuel)
    track('duel_start', { subject: subjectRef.current, duel: Boolean(withDuel || duelCodeRef.current) })
    dispatch({ type: 'SEARCHING' })
    try {
      const initData = (window as { Telegram?: { WebApp?: { initData?: string } } })
        .Telegram?.WebApp?.initData
      getOctagonSocket(config.wsUrl).send({
        type: 'join_queue',
        userId: user.id,
        name: user.firstName,
        subjectId: subjectRef.current,
        ...((withDuel ?? duelCodeRef.current) ? { duelCode: withDuel ?? duelCodeRef.current! } : {}),
        ...(initData ? { initData } : {}),
      })
    } catch {
      dispatch({ type: 'CANCEL' })
      showToast("Ulanishda xato. Qayta urinib ko'ring.")
    }
  }, [user, showToast])

  /** Do'st uchun duel link yaratish */
  const startDuel = useCallback(() => {
    const code = `duel-${Math.random().toString(36).slice(2, 10)}`
    joinQueue(code)
  }, [joinQueue])

  /** Invite link — bot /start deep-link (startapp'dan farqli har doim ishlaydi):
      bot duel tugmasi bilan ilova URL'ga o'tkazadi (`#/octagon/duel-xxxx`) */
  const duelLink = duelCode ? `https://t.me/prava_oson_bot?start=${duelCode}` : null

  /** Invite-link orqali kirgan — avtomatik duelga qo'shiladi */
  useEffect(() => {
    if (duelCode && user && s.phase === 'idle' && conn === 'open') joinQueue(duelCode)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duelCode, user, s.phase, conn])

  const leaveQueue = useCallback(() => {
    if (user) {
      try { getOctagonSocket(config.wsUrl).send({ type: 'leave_queue', userId: user.id }) }
      catch { /* ok */ }
    }
    dispatch({ type: 'CANCEL' })
  }, [user])

  const sendAnswer = useCallback((optionId: string) => {
    if (!s.matchId || s.selected) return
    dispatch({ type: 'SELECT', optionId })
    try {
      getOctagonSocket(config.wsUrl).send({ type: 'answer', matchId: s.matchId, index: s.roundIndex, optionId })
    } catch {
      showToast("Javob yuborilmadi. Aloqa yo'q.")
    }
  }, [s.matchId, s.selected, s.roundIndex, showToast])

  const currentQ = s.currentQuestionId !== null
    ? questions.find((q) => q.id === s.currentQuestionId) ?? null
    : null

  return (
    <div className="flex flex-col min-h-screen bg-canvas">
      <div className="flex items-center justify-between px-4 py-3 border-b border-line">
        <button onClick={() => goBack(navigate)} className="text-muted p-1"><X size={20} /></button>
        <div className="flex items-center gap-2">
          <Sword size={16} className="text-purple-400" />
          <span className="text-sm font-bold">{tt('octagonTitle')}</span>
        </div>
        {s.phase === 'in_round' ? (
          <div className="flex gap-1 text-xs text-muted">
            <span className="text-green-400 font-bold">{s.yourScore}</span>
            <span>:</span>
            <span className="text-red-400 font-bold">{s.oppScore}</span>
          </div>
        ) : <div className="w-8" />}
      </div>

      {s.toastMsg && (
        <div className="mx-4 mt-2 bg-orange-900/60 border border-orange-500/50 text-orange-200 text-xs font-semibold px-3 py-2 rounded-xl text-center">
          {s.toastMsg}
        </div>
      )}

      {conn === 'reconnecting' && s.phase !== 'idle' && (
        <div className="mx-4 mt-2 bg-yellow-900/50 border border-yellow-500/40 text-yellow-200 text-xs font-semibold px-3 py-2 rounded-xl flex items-center justify-center gap-2">
          <Loader2 size={14} className="animate-spin flex-shrink-0" />
          Aloqa uzildi — qayta ulanmoqda...
        </div>
      )}

      {s.oppWait !== null && s.phase === 'in_round' && (
        <div className="mx-4 mt-2 bg-yellow-900/50 border border-yellow-500/40 text-yellow-200 text-xs font-semibold px-3 py-2 rounded-xl flex items-center justify-center gap-2">
          <Loader2 size={14} className="animate-spin flex-shrink-0" />
          Raqib uzildi — {s.oppWait} soniya kutilmoqda
        </div>
      )}

      {conn === 'failed' && (
        <div className="mx-4 mt-2 bg-red-900/50 border border-red-500/40 text-red-200 text-xs font-semibold px-3 py-2 rounded-xl flex items-center justify-center gap-2">
          <WifiOff size={14} className="flex-shrink-0" />
          Serverga ulanib bo'lmadi
          <button onClick={retryConnect}
            className="flex items-center gap-1 underline underline-offset-2 hover:text-white transition-colors">
            <RefreshCw size={12} /> Qayta urinish
          </button>
        </div>
      )}

      <div className="flex-1 flex flex-col items-center justify-center px-4">
        {s.phase === 'idle' && (
          <div className="flex flex-col items-center gap-5 text-center">
            <Sword size={56} className="text-purple-400 opacity-80" />
            <div>
              <h2 className="text-xl font-black mb-1">{tt('octagonTitle')}</h2>
              <p className="text-sm text-muted">Haqiqiy vaqtda raqib bilan bellashuv</p>
            </div>
            <button onClick={() => joinQueue()} disabled={conn === 'failed'}
              className="bg-purple-600 text-white font-bold px-8 py-3.5 rounded-xl text-base shadow-[0_4px_0_0_#7c3aed,0_0_22px_rgba(139,92,246,0.45)] active:translate-y-1 active:shadow-[0_0_22px_rgba(139,92,246,0.45)] disabled:opacity-50 disabled:cursor-not-allowed transition-all">
              {tt('findOpponent')}
            </button>
            {/* Do'st bilan duel — invite link orqali */}
            <button onClick={startDuel} disabled={conn === 'failed'}
              className="flex items-center gap-2 border border-purple-500/50 text-purple-300 font-bold px-6 py-3 rounded-xl text-sm active:scale-95 transition-all disabled:opacity-50">
              <UserPlus size={16} />
              {tt('duelWithFriend')}
            </button>
          </div>
        )}

        {s.phase === 'searching' && (
          <div className="flex flex-col items-center gap-5 text-center">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-purple-500/30 animate-ping" />
              <div className="relative w-16 h-16 rounded-full bg-purple-900/60 border border-purple-500/40 flex items-center justify-center">
                <Sword size={26} className="text-purple-300" />
              </div>
            </div>
            <p className="text-base font-bold">{tt('searching')}</p>
            <p className="text-xs text-muted">
              Raqib qidirilmoqda
              <span className="inline-flex w-6 justify-start ml-0.5">
                <span className="animate-bounce" style={{ animationDelay: '0ms' }}>.</span>
                <span className="animate-bounce" style={{ animationDelay: '150ms' }}>.</span>
                <span className="animate-bounce" style={{ animationDelay: '300ms' }}>.</span>
              </span>
            </p>
            {/* Duel kutilmoqda — do'stga link ulashish */}
            {duelCode && duelLink && (
              <div className="card-neon p-4 flex flex-col items-center gap-2.5 max-w-xs">
                <p className="text-[11px] text-subtle font-semibold text-center">
                  {tt('duelInviteHint')}
                </p>
                <button onClick={() => shareUrl(duelLink, tt('duelInviteText'))}
                  className="flex items-center gap-2 bg-duo-blue text-white font-bold px-5 py-2.5 rounded-xl text-[13px] active:scale-95 transition-transform">
                  <Share2 size={15} />
                  {tt('duelShareBtn')}
                </button>
                <p className="text-[10px] text-muted font-mono break-all text-center px-2">{duelLink}</p>
              </div>
            )}
            <button onClick={() => { setDuelCode(null); leaveQueue() }}
              className="text-sm text-muted border border-line px-5 py-2.5 rounded-xl hover:text-fg transition-colors">
              {tt('cancel')}
            </button>
          </div>
        )}

        {s.phase === 'matched' && (
          <div className="flex flex-col items-center gap-4 text-center">
            <Sword size={36} className="text-purple-400" />
            <p className="text-lg font-black">VS</p>
            <p className="text-base font-bold text-purple-300">{s.opponentName}</p>
            <p className="text-xs text-muted animate-pulse">Tayyor bo'ling...</p>
          </div>
        )}

        {s.phase === 'in_round' && currentQ && (
          <div className="w-full max-w-md">
            {s.deadline && (
              <div className="w-full h-1.5 bg-line rounded-full overflow-hidden mb-2.5">
                <div
                  className="h-full rounded-full transition-colors duration-300"
                  style={{
                    width: `${roundPct * 100}%`,
                    background: roundPct > 0.5 ? '#58cc02' : roundPct > 0.25 ? '#ffc800' : '#ff4b4b',
                  }}
                />
              </div>
            )}
            <p className="text-xs text-muted mb-1 text-center">
              {tt('round')} {s.roundIndex + 1} / {s.roundCount}
              {timeLeft !== null && (
                <span className={`ml-2 font-bold ${timeLeft <= 5 ? 'text-red-400 animate-pulse' : 'text-duo-blue'}`}>
                  ⏱ {timeLeft}s
                </span>
              )}
              {s.oppAnswered && !s.selected && (
                <span className="ml-2 text-orange-400">• Raqib javob berdi</span>
              )}
            </p>
            <p className="text-base font-semibold text-center mb-5 leading-snug">{currentQ.text}</p>
            {currentQ.image && (
              <div className="rounded-xl overflow-hidden mb-4 border border-line flex items-center justify-center bg-elevated">
                <img src={currentQ.image} alt="savol" loading="lazy"
                  className="max-w-full max-h-[45vh] w-auto h-auto object-contain" />
              </div>
            )}
            {currentQ.options.map((opt) => {
              const answered    = !!s.selected
              const isSelected  = s.selected === opt.id
              const showCorrect = answered && s.ackCorrect !== null && opt.id === currentQ.correct
              const style =
                !answered      ? 'bg-surface border-line text-fg' :
                showCorrect    ? 'bg-green-900/40 border-green-600 text-white' :
                isSelected && s.ackCorrect  ? 'bg-green-900/60 border-green-500 text-white' :
                isSelected && !s.ackCorrect ? 'bg-red-900/60   border-red-500   text-white' :
                                              'bg-surface border-line text-muted'
              return (
                <button key={opt.id} disabled={answered} onClick={() => sendAnswer(opt.id)}
                  className={`w-full text-left rounded-xl border p-3.5 mb-2 transition-all active:scale-[0.98] ${style}`}>
                  <div className="flex items-center gap-3">
                    <span className="w-7 h-7 rounded-full border border-current/30 flex items-center justify-center text-xs font-bold opacity-60 flex-shrink-0">
                      {opt.id}
                    </span>
                    <span className="text-sm">{opt.text}</span>
                  </div>
                </button>
              )
            })}
          </div>
        )}

        {s.phase === 'in_round' && !currentQ && (
          <Loader2 size={28} className="text-purple-400 animate-spin" />
        )}

        {s.phase === 'match_end' && (
          <div className="flex flex-col items-center gap-5 text-center">
            <span className="text-6xl">
              {s.result === 'win' ? '🏆' : s.result === 'lose' ? '😔' : '🤝'}
            </span>
            <h2 className="text-2xl font-black">
              {s.result === 'win' ? tt('youWon') : s.result === 'lose' ? tt('youLost') : tt('draw')}
            </h2>
            <div className="flex gap-6 font-bold">
              <div className="text-center">
                <p className="text-green-400 text-3xl">{s.yourScore}</p>
                <p className="text-xs text-muted mt-1">Siz</p>
              </div>
              <div className="text-line text-3xl self-center">:</div>
              <div className="text-center">
                <p className="text-red-400 text-3xl">{s.oppScore}</p>
                <p className="text-xs text-muted mt-1">{s.opponentName}</p>
              </div>
            </div>
            <div className="flex gap-3 w-full max-w-xs">
              <button onClick={() => dispatch({ type: 'CANCEL' })}
                className="flex-1 py-3 rounded-xl bg-elevated text-sm font-semibold">
                Chiqish
              </button>
              <button onClick={() => joinQueue()} className="flex-[2] py-3 rounded-xl bg-purple-600 text-white font-bold shadow-[0_4px_0_0_#7c3aed,0_0_22px_rgba(139,92,246,0.45)] active:translate-y-1 active:shadow-[0_0_22px_rgba(139,92,246,0.45)] transition-all">
                Qayta o'ynash
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
