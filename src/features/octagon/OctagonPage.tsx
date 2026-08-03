import { useEffect, useReducer, useCallback, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sword, X, Loader2, WifiOff, RefreshCw } from 'lucide-react'
import { useAppStore }    from '../../shared/store/useAppStore'
import { useT }           from '../../shared/i18n'
import { useQuestionsStore } from '../../store/useQuestionsStore'
import { getOctagonSocket, destroyOctagonSocket, type OctagonMsg, type ConnStatus } from '../../shared/lib/octagon-ws'
import { config }         from '../../config'

type Phase = 'idle' | 'searching' | 'matched' | 'in_round' | 'match_end'

interface State {
  phase: Phase; matchId: string | null; opponentName: string | null
  roundCount: number; roundIndex: number; currentQuestionId: number | null
  yourScore: number; oppScore: number
  selected: string | null; ackCorrect: boolean | null; oppAnswered: boolean
  result: 'win' | 'lose' | 'draw' | null; toastMsg: string | null
}

type Action =
  | { type: 'SEARCHING' }
  | { type: 'CANCEL' }
  | { type: 'MATCHED';      matchId: string; opponentName: string; roundCount: number }
  | { type: 'START_ROUND';  index: number; questionId: number }
  | { type: 'SELECT';       optionId: string }
  | { type: 'ANSWER_ACK';   correct: boolean }
  | { type: 'OPP_ANSWERED' }
  | { type: 'ROUND_RESULT'; yourScore: number; oppScore: number }
  | { type: 'MATCH_END';    yourScore: number; oppScore: number; result: 'win' | 'lose' | 'draw' }
  | { type: 'OPP_DISCONNECTED' }
  | { type: 'TOAST';        msg: string }
  | { type: 'CLEAR_TOAST' }

const INIT: State = {
  phase: 'idle', matchId: null, opponentName: null,
  roundCount: 0, roundIndex: 0, currentQuestionId: null,
  yourScore: 0, oppScore: 0,
  selected: null, ackCorrect: null, oppAnswered: false,
  result: null, toastMsg: null,
}

function reducer(s: State, a: Action): State {
  switch (a.type) {
    case 'SEARCHING':        return { ...INIT, phase: 'searching' }
    case 'CANCEL':           return { ...INIT }
    case 'MATCHED':          return { ...s, phase: 'matched', matchId: a.matchId, opponentName: a.opponentName, roundCount: a.roundCount }
    case 'START_ROUND':      return { ...s, phase: 'in_round', roundIndex: a.index, currentQuestionId: a.questionId, selected: null, ackCorrect: null, oppAnswered: false }
    case 'SELECT':           return { ...s, selected: a.optionId }
    case 'ANSWER_ACK':       return { ...s, ackCorrect: a.correct }
    case 'OPP_ANSWERED':     return { ...s, oppAnswered: true }
    case 'ROUND_RESULT':     return { ...s, yourScore: a.yourScore, oppScore: a.oppScore }
    case 'MATCH_END':        return { ...s, phase: 'match_end', yourScore: a.yourScore, oppScore: a.oppScore, result: a.result }
    case 'OPP_DISCONNECTED': return { ...s, phase: 'match_end', result: 'win', toastMsg: "Raqib uzildi — g'alaba sizniki!" }
    case 'TOAST':            return { ...s, toastMsg: a.msg }
    case 'CLEAR_TOAST':      return { ...s, toastMsg: null }
    default: return s
  }
}

export default function OctagonPage() {
  const navigate = useNavigate()
  const { user, settings } = useAppStore()
  const questions = useQuestionsStore((s) => s.questions)
  const tt = useT(settings.language)
  const [s, dispatch] = useReducer(reducer, INIT)
  const [conn, setConn] = useState<ConnStatus>('connecting')
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showToast = useCallback((msg: string) => {
    dispatch({ type: 'TOAST', msg })
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => dispatch({ type: 'CLEAR_TOAST' }), 3000)
  }, [])

  const handleMsg = useCallback((msg: OctagonMsg) => {
    switch (msg.type) {
      case 'matched':          dispatch({ type: 'MATCHED',      matchId: msg.matchId, opponentName: msg.opponentName, roundCount: msg.roundCount }); break
      case 'question':         dispatch({ type: 'START_ROUND',  index: msg.index, questionId: msg.questionId }); break
      case 'answer_ack':       dispatch({ type: 'ANSWER_ACK',   correct: msg.correct }); break
      case 'opp_answered':     dispatch({ type: 'OPP_ANSWERED' }); break
      case 'round_result':     dispatch({ type: 'ROUND_RESULT', yourScore: msg.yourScore, oppScore: msg.oppScore }); break
      case 'match_end':        dispatch({ type: 'MATCH_END',    yourScore: msg.yourScore, oppScore: msg.oppScore, result: msg.result }); break
      case 'opp_disconnected': dispatch({ type: 'OPP_DISCONNECTED' }); break
      case 'error':
        showToast(msg.message)
        if (msg.message === 'queue_timeout') dispatch({ type: 'CANCEL' })
        break
    }
  }, [showToast])

  const [attempt, setAttempt] = useState(0)
  const userRef  = useRef(user)
  userRef.current  = user
  const phaseRef = useRef(s.phase)
  phaseRef.current = s.phase

  useEffect(() => {
    const sock = getOctagonSocket(config.wsUrl)
    const offMsg    = sock.on(handleMsg)
    const offStatus = sock.onStatus((st) => {
      setConn(st)
      // Server drops the queue entry when the old socket dies — rejoin silently.
      const u = userRef.current
      if (st === 'open' && phaseRef.current === 'searching' && u) {
        try {
          const initData = (window as { Telegram?: { WebApp?: { initData?: string } } })
            .Telegram?.WebApp?.initData
          sock.send({
            type: 'join_queue',
            userId: u.id,
            name: u.firstName,
            ...(initData ? { initData } : {}),
          })
        } catch { /* next status change retries */ }
      }
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

  const joinQueue = useCallback(() => {
    if (!user) return
    dispatch({ type: 'SEARCHING' })
    try {
      const initData = (window as { Telegram?: { WebApp?: { initData?: string } } })
        .Telegram?.WebApp?.initData
      getOctagonSocket(config.wsUrl).send({
        type: 'join_queue',
        userId: user.id,
        name: user.firstName,
        ...(initData ? { initData } : {}),
      })
    } catch {
      dispatch({ type: 'CANCEL' })
      showToast("Ulanishda xato. Qayta urinib ko'ring.")
    }
  }, [user, showToast])

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
        <button onClick={() => navigate(-1)} className="text-muted p-1"><X size={20} /></button>
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
            <button onClick={joinQueue} disabled={conn === 'failed'}
              className="bg-purple-600 text-white font-bold px-8 py-3.5 rounded-xl text-base disabled:opacity-50 disabled:cursor-not-allowed transition-opacity">
              {tt('findOpponent')}
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
            <button onClick={leaveQueue}
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
            <p className="text-xs text-muted mb-1 text-center">
              {tt('round')} {s.roundIndex + 1} / {s.roundCount}
              {s.oppAnswered && !s.selected && (
                <span className="ml-2 text-orange-400">• Raqib javob berdi</span>
              )}
            </p>
            <p className="text-base font-semibold text-center mb-5 leading-snug">{currentQ.text}</p>
            {currentQ.image && (
              <div className="rounded-xl overflow-hidden mb-4 border border-line">
                <img src={currentQ.image} alt="savol" className="w-full object-cover max-h-48" />
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
              <button onClick={joinQueue} className="flex-[2] py-3 rounded-xl bg-purple-600 text-white font-bold">
                Qayta o'ynash
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
