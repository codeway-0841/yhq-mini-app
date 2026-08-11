/**
 * Duel WebSocket ulanishi + barcha o'yin aksiyalari.
 * UI'dan to'liq ajratilgan: state machine (duel-reducer) + server efektlari shu yerda.
 */
import { useEffect, useReducer, useCallback, useRef, useState } from 'react'
import { useLocation, useParams } from 'react-router-dom'
import { useSubjectStore } from '../../../shared/store/useSubjectStore'
import { getOctagonSocket, destroyOctagonSocket, type OctagonMsg, type ConnStatus } from '../../../shared/lib/octagon-ws'
import { config }         from '../../../shared/config'
import { track }          from '../../../shared/lib/analytics'
import { playSound }      from '../../../shared/lib/sounds'
import { getInitData }    from '../../../platform/telegram'
import { getSessionToken } from '../../../shared/lib/session'
import { duelReducer, DUEL_INIT } from '../duel-reducer'

interface DuelUser { id: string; firstName: string }

/** WS auth credential: initData (Mini App) USTUVOR, bo'lmasa Bearer sessiya tokeni. */
function wsAuthFields(): { initData?: string; sessionToken?: string } {
  const initData = getInitData()
  if (initData) return { initData }
  const sessionToken = getSessionToken()
  return sessionToken ? { sessionToken } : {}
}

export function useDuelConnection(user: DuelUser | null | undefined) {
  const location = useLocation()
  const [s, dispatch] = useReducer(duelReducer, DUEL_INIT)
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
      case 'question':         dispatch({ type: 'START_ROUND',  index: msg.index, questionId: msg.questionId, timeLimit: msg.timeLimit }); break
      case 'answer_ack':       dispatch({ type: 'ANSWER_ACK',   correct: msg.correct, correctOptionId: msg.correctOptionId }); break
      case 'opp_answered':     dispatch({ type: 'OPP_ANSWERED' }); break
      case 'round_result':     dispatch({ type: 'ROUND_RESULT', yourScore: msg.yourScore, oppScore: msg.oppScore, correctOptionId: msg.correctOptionId }); break
      case 'match_end':        dispatch({ type: 'MATCH_END',    yourScore: msg.yourScore, oppScore: msg.oppScore, result: msg.result }); break
      case 'opp_disconnected': dispatch({ type: 'OPP_DISCONNECTED' }); break
      case 'opp_waiting':      dispatch({ type: 'OPP_WAIT', waitSeconds: msg.waitSeconds }); break
      case 'opp_reconnected':  dispatch({ type: 'OPP_BACK' }); showToast('Raqib qaytdi'); break
      case 'match_state':
        dispatch({ type: 'SYNC', matchId: msg.matchId, index: msg.index, questionId: msg.questionId,
                   timeLimit: msg.timeLimit,
                   roundCount: msg.roundCount, yourScore: msg.yourScore, oppScore: msg.oppScore,
                   opponentName: msg.opponentName, yourAnswer: msg.yourAnswer, oppAnswered: msg.oppAnswered,
                   correctOptionId: msg.correctOptionId })
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
      const auth = wsAuthFields()
      try {
        // Server drops the queue entry when the old socket dies — rejoin silently.
        if (phaseRef.current === 'searching') {
          sock.send({ type: 'join_queue', userId: u.id, name: u.firstName, subjectId: subjectRef.current, ...(duelCodeRef.current ? { duelCode: duelCodeRef.current } : {}), ...auth })
        } else if ((phaseRef.current === 'in_round' || phaseRef.current === 'matched') && matchIdRef.current) {
          // Mid-match reconnect within the server grace window — state resyncs.
          sock.send({ type: 'rejoin', matchId: matchIdRef.current, userId: u.id, name: u.firstName, ...auth })
        }
      } catch { /* next status change retries */ }
    })
    return () => { offMsg(); offStatus() }
  }, [handleMsg, attempt])

  const retryConnect = useCallback(() => {
    destroyOctagonSocket()
    setAttempt((a) => a + 1)
  }, [])

  // Render free tier "uxlashi"ga qarshi keep-alive: sahifa ochiq turganida
  // har 4 daqiqada /health ping — server uxlashga ulgurmaydi (bepl keep-alive).
  useEffect(() => {
    let ping: (() => void) | null = null
    try {
      const httpBase = config.wsUrl.replace(/^wss:/, 'https:').replace(/^ws:/, 'http:')
      ping = () => void fetch(new URL('/health', httpBase).toString()).catch(() => {})
    } catch { /* jim */ }
    if (!ping) return
    ping() // darhol uyg'otish
    const id = setInterval(() => {
      // faqat sahifa ko'rinayotganda (fonda battery tejash)
      if (document.visibilityState === 'visible') ping()
    }, 4 * 60 * 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    return () => {
      if (s.phase === 'searching' && user?.id) {
        try { getOctagonSocket(config.wsUrl).send({ type: 'leave_queue', userId: user.id }) }
        catch { /* socket may be closed */ }
      }
    }
  }, [s.phase, user?.id])

  // Sahifadan chiqish (unmount): o'yin tugagan/bo'sh holatda socket'ni butunlay
  // yopamiz — aks holda heartbeat (3s interval) + reconnect loop sahifa
  // yopilgach ham yurardi. O'yin DAVOMIDA chiqilsa — jonli qoladi (qayta
  // kirganda rejoin/grace oyna ishlaydi). Diqqat: bu effect leave_queue
  // effectidan KEYIN deklaratsiya qilingan — cleanup shu tartibda ishlaydi.
  useEffect(() => {
    return () => {
      const phase = phaseRef.current
      if (phase === 'idle' || phase === 'match_end') destroyOctagonSocket()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Ovoz effektlari: raqib topilganda + g'alaba/mag'lubiyat
  const prevPhaseRef = useRef(s.phase)
  useEffect(() => {
    if (s.phase !== prevPhaseRef.current) {
      if (s.phase === 'matched') playSound('match')
      if (s.phase === 'match_end' && s.result) playSound(s.result === 'win' ? 'win' : s.result === 'lose' ? 'error' : 'click')
      prevPhaseRef.current = s.phase
    }
  }, [s.phase, s.result])

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
      getOctagonSocket(config.wsUrl).send({
        type: 'join_queue',
        userId: user.id,
        name: user.firstName,
        subjectId: subjectRef.current,
        ...((withDuel ?? duelCodeRef.current) ? { duelCode: withDuel ?? duelCodeRef.current! } : {}),
        ...wsAuthFields(),
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

  /** Invite link — bot /start deep-link: bot "⚔️ Duelga qo'shilish" tugmasi
      bilan ilovaga o'tkazadi (`#/octagon/duel-xxxx`). Webhook ulangan davrda ishlaydi. */
  const duelLink = duelCode ? `https://t.me/kiwi_uz_bot?start=${duelCode}` : null

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

  const cancelSearch = useCallback(() => {
    setDuelCode(null)
    leaveQueue()
  }, [leaveQueue])

  const exitToIdle = useCallback(() => dispatch({ type: 'CANCEL' }), [])

  const sendAnswer = useCallback((optionId: string) => {
    if (!s.matchId || s.selected) return
    dispatch({ type: 'SELECT', optionId })
    try {
      getOctagonSocket(config.wsUrl).send({ type: 'answer', matchId: s.matchId, index: s.roundIndex, optionId })
    } catch {
      showToast("Javob yuborilmadi. Aloqa yo'q.")
    }
  }, [s.matchId, s.selected, s.roundIndex, showToast])

  return {
    state: s, conn, duelCode, duelLink,
    joinQueue, startDuel, cancelSearch, leaveQueue, sendAnswer, retryConnect, exitToIdle,
  }
}
