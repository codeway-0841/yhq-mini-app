import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, Undo2, Trophy, Keyboard, PenLine } from 'lucide-react'
import { useAppStore } from '../../shared/store/useAppStore'
import { useT } from '../../shared/i18n'
import { PageHeader } from '../../shared/components/ui/page-header'
import { Card } from '../../shared/components/ui/card'
import { Button } from '../../shared/components/ui/button'
import { haptics } from '../../platform/haptics'
import { playSound } from '../../shared/lib/sounds'
import { api } from '../../shared/api'
import { useBoardSession } from './hooks/useBoardSession'
import { useStepCheck } from './hooks/useStepCheck'
import { useOnline } from './hooks/useOnline'
import { useBoardBlocks } from './hooks/useBoardBlocks'
import { useBoardTurn } from './hooks/useBoardTurn'
import { latexToAscii } from './lib/latex-to-ascii'
import { isSolvedStep } from './lib/solve'
import { captureContext, sameContext, strokeMarker, type BoardRevisions } from './lib/request-guard'
import { recognitionErrorKey } from './lib/recognize-errors'
import { FALLBACK_HINT_KEY, localHintKey, shouldOfferLlmHint } from './lib/hints'
import { createTurn } from './lib/board-revisions'
import { renderBlockToDataUrl, strokesForBlock } from './lib/snapshot'
import { BOARD_PROBLEMS, boardProblemById } from './lib/problems'
import { recognizeBlocks } from './recognition/adapters'
import type { DrawingStroke } from '../test'
import StepInput from './components/StepInput'
import BoardCanvas from './components/BoardCanvas'
import HintCard from './components/HintCard'
import MathBlockOverlay from './components/MathBlockOverlay'
import BoardActionFab from './components/BoardActionFab'
import RecognitionReviewSheet from './components/RecognitionReviewSheet'
import SolutionSheet from './components/SolutionSheet'
import Confetti from '../../shared/components/Confetti'
import StepList, { CheckingBadge, Latex, StepStatusBadge } from './components/StepList'

/**
 * Math Board (`/doska`) — Faza 4: typed MVP + chizish/recognition.
 *
 * Ikki rejim: Yozish (MathLive → jonli check → Qabul) va Chizish (canvas →
 * "Tanish" (server Gemini proxy, FAQAT tugmada) → editable confirmation →
 * kiritishga o'tkazish). Noto'g'ri qadam qabul qilinmaydi (invariant).
 */
export default function MathBoardPage() {
  const navigate = useNavigate()
  const language = useAppStore((s) => s.settings.language)
  const tt = useT(language)
  const online = useOnline()

  const problemId = useBoardSession((s) => s.problemId)
  const steps = useBoardSession((s) => s.steps)
  const inputLatex = useBoardSession((s) => s.inputLatex)
  const inputKey = useBoardSession((s) => s.inputKey)
  const solved = useBoardSession((s) => s.solved)
  const setInput = useBoardSession((s) => s.setInput)
  const setInputFromBlock = useBoardSession((s) => s.setInputFromBlock)
  const inputBlockId = useBoardSession((s) => s.inputBlockId)
  const bumpInk = useBoardSession((s) => s.bumpInk)
  const bumpRecognition = useBoardSession((s) => s.bumpRecognition)
  const logTurn = useBoardSession((s) => s.logTurn)
  const turn = useBoardTurn()

  /** Joriy revision snapshot (stale-guard konteksti uchun) */
  const revisionSnapshot = (): BoardRevisions => {
    const st = useBoardSession.getState()
    return {
      problemId: st.problemId,
      sessionRevision: st.sessionRevision,
      userInkRevision: st.userInkRevision,
      recognitionRevision: st.recognitionRevision,
      acceptedStepsRevision: st.acceptedStepsRevision,
    }
  }

  /** Joriy kiritish markeri (hint stale-guard uchun) */
  const currentAsciiMarker = (): string => {
    const st = useBoardSession.getState()
    const nowAscii = st.inputLatex.trim() ? latexToAscii(st.inputLatex) : ''
    return `${nowAscii}|${liveDetail}`
  }

  const [tab, setTab] = useState<'type' | 'draw'>('type')
  const [drawStrokes, setDrawStrokes] = useState<DrawingStroke[]>([])
  // Faza 2: chizma bloklari (segment → store sync; overlay Faza 3'da)
  const blocks = useBoardBlocks(problemId, drawStrokes)
  const [recognizing, setRecognizing] = useState(false)
  const [recogError, setRecogError] = useState<string | null>(null)
  const [reviewOpen, setReviewOpen] = useState(false)
  const updateBlock = useBoardSession((s) => s.updateBlock)

  // Faza 5: ketma-ket bir xil xato kuzatuvi (LLM taklif sharti uchun)
  const [errTrack, setErrTrack] = useState<{ detail: string; count: number }>({ detail: '', count: 0 })
  const [aiQuestion, setAiQuestion] = useState<string | null>(null)
  const [askingAi, setAskingAi] = useState(false)
  const [aiFailed, setAiFailed] = useState(false)
  // Faza 3/5: tutor highlight qilgan blok (overlay ramka)
  const [highlightBlockId, setHighlightBlockId] = useState<string | null>(null)
  const lastCountedAscii = useRef('')

  const board = boardProblemById(problemId)
  const previousAscii = steps.length > 0 ? steps[steps.length - 1].ascii : board.promptAscii
  const ascii = useMemo(() => (inputLatex.trim() ? latexToAscii(inputLatex) : ''), [inputLatex])
  const live = useStepCheck(ascii, board.problem, previousAscii, steps.length === 0)

  const canAccept = live.status === 'correct'
  // P0-A: probably_correct progression bazasiga KIRMAYDI (isbot talab).
  // Faqat exact-isbotlangan correct qabul qilinadi.
  // P1-3: `uncertain` progression bazasi EMAS — Qabul o'chiq qoladi.
  const isLiveError = live.status === 'wrong' || live.status === 'invalid_transition'
    || live.status === 'domain_error' || live.status === 'syntax_error' || live.status === 'unknown'
    || live.status === 'uncertain'
  const liveDetail = isLiveError ? live.detail : ''
  const localKey = isLiveError ? localHintKey(live) : null
  const offerAi = isLiveError && shouldOfferLlmHint({
    detail: liveDetail,
    consecutiveCount: errTrack.detail === liveDetail ? errTrack.count : 0,
    hasLocalHint: localKey !== null,
  })

  const resetHintState = useCallback(() => {
    lastCountedAscii.current = ''
    setErrTrack({ detail: '', count: 0 })
    setAiQuestion(null)
    setAiFailed(false)
  }, [])

  // Har xil kiritish — bir xil xato detail → count+1 (LLM 2-takrorda)
  useEffect(() => {
    if (!isLiveError || !ascii) {
      if (!ascii) {
        lastCountedAscii.current = ''
        setErrTrack({ detail: '', count: 0 })
      }
      return
    }
    if (ascii === lastCountedAscii.current) return
    lastCountedAscii.current = ascii
    const detail = (live as { detail: string }).detail
    setErrTrack((prev) => ({ detail, count: prev.detail === detail ? prev.count + 1 : 1 }))
    setAiQuestion(null)
    setAiFailed(false)
  }, [live, ascii, isLiveError])

  useEffect(() => {
    if (solved) playSound('win')
  }, [solved])

  // Faza 6: completion confetti — faqat false→true o'tishda, 3s (duplicate yo'q)
  const [showConfetti, setShowConfetti] = useState(false)
  const prevSolved = useRef(false)
  useEffect(() => {
    if (solved && !prevSolved.current) {
      setShowConfetti(true)
      const t = setTimeout(() => setShowConfetti(false), 3000)
      prevSolved.current = true
      return () => clearTimeout(t)
    }
    if (!solved) prevSolved.current = false
    return undefined
  }, [solved])

  const [solutionOpen, setSolutionOpen] = useState(false)

  /** Keyingi masala (katalog tartibida, oxirida boshiga) */
  const handleNextProblem = (): void => {
    const ids = BOARD_PROBLEMS.map((b) => b.problem.id)
    const next = ids[(ids.indexOf(problemId) + 1) % ids.length]
    handleSelectProblem(next)
    setSolutionOpen(false)
  }

  const strokesRef = useRef<DrawingStroke[]>([])
  const asciiRef = useRef('')
  asciiRef.current = ascii
  // P2-D: uzoq so'rovlar request-id bilan — stale settle (resolve/reject)
  // yangi holatga yozmaydi; loading flag faqat joriy so'rov o'chiradi.
  const recogReq = useRef(0)
  const hintReq = useRef(0)

  // Masala almashganda chizish holati tozalanadi
  useEffect(() => {
    // P2-2 (round-3): havodagi recognition DARHOL bekor qilinadi — yangi
    // masalada recognizing=false va "Tanish" kechikishsiz ishlaydi. Eski
    // request kechikkan javobi request-id + kontekst guard orqali tashlanadi
    // (yangi request/UI state'ga yozmaydi; bloklar guard'da qaytariladi).
    recogReq.current += 1
    setRecognizing(false)
    setReviewOpen(false)
    setRecogError(null)
    setHighlightBlockId(null)
    setSolutionOpen(false)
  }, [problemId])

  const handleStrokes = useCallback((s: DrawingStroke[]) => {
    setDrawStrokes(s)
    strokesRef.current = s
    bumpInk()
  }, [bumpInk])

  const handleAccept = (): void => {
    if (!canAccept) return
    haptics.impact('light')
    playSound('success')
    // P1-2: input draw-blok confirm'dan kelgan bo'lsa, accepted step aynan shu
    // blokka bog'lanadi (alohida duplicate typed blok yaratilmaydi).
    turn.accept(inputLatex, ascii, live, isSolvedStep(ascii, board.finalAnswer, board.targetVariable), inputBlockId ?? undefined)
    resetHintState()
    // P1-1 (round-3) NAVBAT: keyingi needs_review blok FAQAT check+accept'dan
    // KEYIN ochiladi — shu sabab keyingi confirm avvalgi (qabul qilinmagan)
    // inputni hech qachon bosib ketmaydi (accept inputni tozalagan).
    const nextReview = (useBoardSession.getState().blocksByProblem[problemId] ?? [])
      .some((b) => b.strokeIds.length > 0 && b.recognition.state === 'needs_review')
    if (nextReview) {
      setTab('draw')
      setReviewOpen(true)
    }
  }

  const handleUndo = (): void => {
    haptics.impact('light')
    turn.undo()
    resetHintState()
  }

  const handleSelectProblem = (id: string): void => {
    turn.select(id)
    resetHintState()
  }

  const handleAskAi = async (): Promise<void> => {
    if (askingAi || !isLiveError) return
    haptics.impact('light')
    setAskingAi(true)
    setAiFailed(false)
    // P0-D full context: problem/session/ink/recog/steps/candidate/requestId.
    // Undo, accept, problem change, clear — barchasi revision bump qiladi.
    const reqId = ++hintReq.current
    const candidate = `${asciiRef.current}|${liveDetail}`
    const ctx = captureContext(revisionSnapshot(), candidate, reqId)
    const isCurrent = (): boolean =>
      hintReq.current === reqId
      && sameContext(ctx, captureContext(revisionSnapshot(), currentAsciiMarker(), reqId))
    try {
      const res = await api.getBoardHint({
        problemId,
        promptLatex: board.displayLatex,
        assumptions: board.problem.assumptions,
        acceptedSteps: steps.map((s) => s.ascii),
        candidateStep: asciiRef.current,
        checkStatus: live.status,
        checkDetail: liveDetail,
        knownBlockIds: blocks.filter((b) => b.strokeIds.length > 0).map((b) => b.id),
        language,
      })
      if (!isCurrent()) return
      // Client-side shape guard (server allaqachon validate qilgan)
      if (typeof res.question !== 'string' || !res.question) {
        setAiFailed(true)
        return
      }
      setAiQuestion(res.question)
      const hl = typeof res.highlightBlockId === 'string'
        && blocks.some((b) => b.id === res.highlightBlockId)
        ? (res.highlightBlockId as string)
        : undefined
      if (hl) setHighlightBlockId(hl)
      logTurn(createTurn({
        ...revisionSnapshot(),
        acceptedStepIds: steps.map((s) => s.id),
        changedBlockIds: hl ? [hl] : [],
        hint: { question: res.question, highlightBlockId: hl, source: 'ai' },
      }))
    } catch {
      // P2-D: stale reject yangi kontekstga fallback yozmaydi
      if (!isCurrent()) return
      setAiFailed(true)
    } finally {
      if (hintReq.current === reqId) setAskingAi(false)
    }
  }

  const handleRecognize = async (): Promise<void> => {
    // Faza 4: FAQAT o'zgargan/unrecognized bloklar yuboriladi
    const pending = blocks.filter(
      (b) => b.strokeIds.length > 0 && b.rect
        && (b.recognition.state === 'unrecognized' || b.recognition.state === 'failed'),
    )
    if (recognizing || pending.length === 0 || !online) return
    const payload: { blockId: string; imageDataUrl: string }[] = []
    for (const b of pending) {
      if (!b.rect) continue
      const url = renderBlockToDataUrl(strokesForBlock(drawStrokes, b.strokeIds), b.rect)
      if (url) payload.push({ blockId: b.id, imageDataUrl: url })
    }
    if (payload.length === 0) {
      setRecogError(tt('mathBoardEmptyCanvas'))
      return
    }
    haptics.impact('light')
    setRecognizing(true)
    setRecogError(null)
    // P0-D full context (P2-D reqId bilan birga). Marker — chizma holati
    // (strokeMarker har ikki tomonda bir xil hisoblanadi).
    bumpRecognition()
    const marker = strokeMarker(strokesRef.current)
    const ctx = captureContext(revisionSnapshot(), marker, ++recogReq.current)
    const reqId = ctx.requestId
    const isCurrent = (): boolean =>
      recogReq.current === reqId
      && sameContext(ctx, captureContext(revisionSnapshot(), strokeMarker(strokesRef.current), reqId))
    // P1-1 REQUEST-OWNERSHIP: har blok shu request'da o'rnatilgan revision bilan
    // belgilanadi. Revert FAQAT token (state=recognizing + revision) mos kelsa
    // bajariladi — boshqa request/segmentation tegilgan blok hech qachon
    // recognizing'da yetim qolmaydi va begona blok qaytarilmaydi.
    const owned = new Map<string, number>()
    for (const b of pending) {
      const rev = b.recognition.revision + 1
      owned.set(b.id, rev)
      updateBlock(problemId, b.id, {
        recognition: { ...b.recognition, state: 'recognizing', revision: rev },
      })
    }
    /** Faqat shu request'ga tegishli, hali recognizing'da qolgan bloklarni qaytaradi */
    const revertOwned = (state: 'failed' | 'unrecognized', skip?: Set<string>): void => {
      const current = useBoardSession.getState().blocksByProblem[problemId] ?? []
      for (const b of current) {
        const rev = owned.get(b.id)
        if (rev === undefined || skip?.has(b.id)) continue
        if (b.recognition.state === 'recognizing' && b.recognition.revision === rev) {
          updateBlock(problemId, b.id, {
            recognition: { ...b.recognition, state, revision: Date.now() },
          })
        }
      }
    }
    try {
      const results = await recognizeBlocks(
        payload,
        { category: board.category, language },
      )
      if (!isCurrent()) {
        // P1-1 stale javob: natija tashlanadi, bloklar qayta tanishga tayyor
        revertOwned('unrecognized')
        return
      }
      const answered = new Set<string>()
      for (const r of results) {
        answered.add(r.blockId)
        if (!r.latex) {
          updateBlock(problemId, r.blockId, {
            recognition: { state: 'failed', revision: Date.now() },
          })
        } else {
          updateBlock(problemId, r.blockId, {
            type: r.type,
            latex: r.latex,
            ascii: null,
            recognition: {
              state: 'needs_review',
              confidence: r.confidence,
              alternatives: r.alternatives,
              provider: 'gemini',
              revision: Date.now(),
            },
          })
        }
      }
      // Server qaytarmagan bloklar — failed (recognizing'da yetim qolish YO'Q)
      revertOwned('failed', answered)
      setReviewOpen(true)
    } catch (e) {
      if (!isCurrent()) {
        // P1-1 stale reject: jim yutiladi, lekin bloklar yetim QOLMAYDI
        revertOwned('unrecognized')
        return
      }
      // P1-1: network reject/timeout — bloklar failed'ga qaytariladi,
      // shuning uchun "Tanish" qayta bosilganda request QAYTA ketadi.
      revertOwned('failed')
      setRecogError(tt(recognitionErrorKey(e)))
    } finally {
      if (recogReq.current === reqId) setRecognizing(false)
    }
  }

  const handleUseConfirm = (blockId: string, latex: string): void => {
    if (!latex.trim()) return
    haptics.impact('light')
    // P1-2: tasdiqlangan latex ORIGINAL draw-blok ichiga yoziladi (latex + ascii
    // + recognition.state=confirmed) — alohida typed blok yaratilmaydi.
    const block = (useBoardSession.getState().blocksByProblem[problemId] ?? [])
      .find((b) => b.id === blockId)
    if (block) {
      updateBlock(problemId, blockId, {
        latex,
        ascii: latexToAscii(latex),
        recognition: { ...block.recognition, state: 'confirmed', revision: block.recognition.revision + 1 },
      })
    }
    setInputFromBlock(blockId, latex)
    // P1-1 (round-3) NAVBAT: bitta blok confirm → sheet YOPILIB typed inputga
    // shu blok chiqadi. Qolgan needs_review bloklar yo'qolmaydi — keyingisi
    // FAQAT check+accept'dan KEYIN ochiladi (handleAccept), shuning uchun
    // keyingi confirm avvalgi (hali accept qilinmagan) inputni bosib ketmaydi.
    setReviewOpen(false)
    setTab('type')
  }

  /** STRICT QUEUE (round-4): sheet bir vaqtda FAQAT order bo'yicha BIRINCHI
   *  needs_review blokni ko'rsatadi — keyingi blok oldingisi correct accept
   *  bo'lmaguncha tanlanmaydi (confirm faqat navbatdagi blokda mumkin).
   *  Failed bloklar "Tanish" orqali qayta yuboriladi (navbatga kirmaydi). */
  const reviewBlocks = blocks
    .filter((b) => b.strokeIds.length > 0 && b.recognition.state === 'needs_review')
    .sort((a, b) => a.order - b.order)
    .slice(0, 1)
    .map((b) => ({
      id: b.id,
      order: 0,
      latex: b.latex ?? '',
      alternatives: b.recognition.alternatives ?? [],
      confidence: b.recognition.confidence ?? 0,
      failed: false,
    }))

  return (
    <div className="px-4 pb-20">
      <PageHeader
        title={tt('mathBoardTitle')}
        subtitle={tt('mathBoardSubtitle')}
        size="lg"
        onBack={() => navigate('/rejimlar')}
        className="-mx-4 mb-4"
      />

      {/* Masala tanlash */}
      <div className="mb-3 flex gap-2 overflow-x-auto pb-1" role="group" aria-label={tt('mathBoardProblem')}>
        {BOARD_PROBLEMS.map((b) => (
          <button
            key={b.problem.id}
            type="button"
            aria-pressed={b.problem.id === problemId}
            onClick={() => handleSelectProblem(b.problem.id)}
            className={`shrink-0 rounded-xl px-3 py-2 shadow-2xs transition-colors ${
              b.problem.id === problemId ? 'bg-pprimary text-white' : 'bg-pcard text-pfg'
            }`}
          >
            <Latex latex={b.displayLatex} />
          </button>
        ))}
      </div>

      {/* Qadamlar + ground truth */}
      <StepList problemLatex={board.displayLatex} steps={steps} statusLabel={tt} />

      {/* Solved banner (Faza 6: confetti + keyingi + yechim) */}
      {solved && (
        <>
          {showConfetti && <Confetti />}
          <Card className="mt-3 flex flex-col gap-3 p-4">
            <div className="flex items-center gap-3">
              <Trophy size={24} strokeWidth={1.75} className="shrink-0 text-pgold" />
              <div>
                <p className="text-[15px] font-bold text-pfg">{tt('mathBoardSolved')}</p>
                <p className="text-[13px] text-pmuted">{tt('mathBoardSolvedHint')}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="button" onClick={handleNextProblem} className="flex-1">
                {tt('mathBoardNext')}
              </Button>
              <Button type="button" variant="secondary" onClick={() => setSolutionOpen(true)} className="flex-1">
                {tt('mathBoardViewSolution')}
              </Button>
            </div>
          </Card>
          {solutionOpen && (
            <SolutionSheet
              problemLatex={board.displayLatex}
              steps={steps}
              title={tt('mathBoardSolutionTitle')}
              closeLabel={tt('mathBoardFabClose')}
              statusLabel={tt}
              onClose={() => setSolutionOpen(false)}
            />
          )}
        </>
      )}

      {/* Rejim tanlagich (segmented control) */}
      <div className="mt-3 flex gap-2" role="group" aria-label={`${tt('mathBoardTypeTab')} / ${tt('mathBoardDrawTab')}`}>
        <Button
          type="button"
          aria-pressed={tab === 'type'}
          variant={tab === 'type' ? 'default' : 'secondary'}
          onClick={() => setTab('type')}
          className="flex-1"
        >
          <Keyboard size={17} strokeWidth={1.75} />
          {tt('mathBoardTypeTab')}
        </Button>
        <Button
          type="button"
          aria-pressed={tab === 'draw'}
          variant={tab === 'draw' ? 'default' : 'secondary'}
          onClick={() => setTab('draw')}
          className="flex-1"
        >
          <PenLine size={17} strokeWidth={1.75} />
          {tt('mathBoardDrawTab')}
        </Button>
      </div>

      {tab === 'type' ? (
        /* Kiritish */
        <Card className="mt-3 flex flex-col gap-2.5 p-4">
          <div className="flex items-center justify-between gap-2">
            {/* P2-fix: tor ekranda LABEL truncate bo'ladi, badge HECH QACHON
                kesilmaydi (badge shrink-0 + label min-w-0/truncate). */}
            <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-pmuted">{tt('mathBoardInputLabel')}</span>
            {live.status === 'checking' ? (
              <CheckingBadge label={tt('mathBoardChecking')} />
            ) : live.status === 'idle' ? null : (
              <StepStatusBadge
                status={live.status}
                label={tt(
                  live.status === 'correct' ? 'mathBoardCorrect'
                  : live.status === 'probably_correct' ? 'mathBoardProbably'
                  : live.status === 'uncertain' ? 'mathBoardUncertain'
                  : live.status === 'wrong' ? 'mathBoardWrong'
                  : live.status === 'invalid_transition' ? 'mathBoardInvalid'
                  : live.status === 'domain_error' ? 'mathBoardDomain'
                  : live.status === 'syntax_error' ? 'mathBoardSyntax'
                  : 'mathBoardUnknown',
                )}
              />
            )}
          </div>
          <StepInput key={`${problemId}-${inputKey}`} value={inputLatex} onLatex={setInput} label={tt('mathBoardInputLabel')} />
          {live.status === 'probably_correct' && (
            <p className="text-[13px] text-pmuted" role="note">
              {tt('mathBoardNeedProof')}
            </p>
          )}
          {isLiveError && (
            <HintCard
              title={tt('mathBoardHint')}
              localHint={localKey ? tt(localKey) : null}
              offerAi={offerAi && online}
              askingAi={askingAi}
              aiQuestion={aiQuestion}
              aiTitle={tt('mathBoardAiHintTitle')}
              askLabel={tt('mathBoardAskAi')}
              askingLabel={tt('mathBoardAskingAi')}
              fallback={tt(FALLBACK_HINT_KEY)}
              showFallback={aiFailed}
              onAskAi={() => void handleAskAi()}
            />
          )}
          {!online && isLiveError && (
            <p className="text-[13px] text-pmuted" role="note">
              {tt('mathBoardOffline')}
            </p>
          )}
          <div className="flex gap-2">
            <Button type="button" onClick={handleAccept} disabled={!canAccept} className="flex-1">
              <Check size={17} strokeWidth={2} />
              {tt('mathBoardAccept')}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={handleUndo}
              disabled={steps.length === 0}
              aria-label={tt('mathBoardUndo')}
            >
              <Undo2 size={17} strokeWidth={1.75} />
            </Button>
          </div>
        </Card>
      ) : (
        /* Chizish + Tanish (Faza 3: overlay + FAB menyu) */
        <Card className="mt-3 flex flex-col gap-2.5 p-4">
          <span className="text-[13px] font-semibold text-pmuted">{tt('mathBoardDrawHint')}</span>
          <BoardCanvas
            problemId={problemId}
            onStrokes={handleStrokes}
            label={tt('mathBoardDrawTab')}
            clearLabel={tt('mathBoardUndo')}
            onKeyboard={() => setTab('type')}
            overlay={<MathBlockOverlay blocks={blocks} highlightBlockId={highlightBlockId} />}
          />
          <BoardActionFab
            recognizeLabel={tt('mathBoardRecognize')}
            helpLabel={tt('mathBoardHelp')}
            closeLabel={tt('mathBoardFabClose')}
            menuLabel={tt('mathBoardFabMenu')}
            recognizeDisabled={drawStrokes.length === 0 || recognizing || !online}
            onRecognize={() => void handleRecognize()}
            onHelp={() => setTab('type')}
          />
          {recognizing && (
            <p className="text-[13px] font-medium text-pmuted" role="status">
              {tt('mathBoardRecognizing')}
            </p>
          )}
          {!online && (
            <p className="text-[13px] text-pmuted" role="note">
              {tt('mathBoardOffline')}
            </p>
          )}
          {recogError && (
            <p className="text-[13px] font-medium text-pdanger" role="alert">
              {recogError}
            </p>
          )}
        </Card>
      )}

      {reviewOpen && reviewBlocks.length > 0 && (
        <RecognitionReviewSheet
          blocks={reviewBlocks}
          title={tt('mathBoardConfirmTitle')}
          failedLabel={tt('mathBoardBlockFailed')}
          useLabel={tt('mathBoardUseResult')}
          closeLabel={tt('mathBoardFabClose')}
          onClose={() => setReviewOpen(false)}
          onUse={handleUseConfirm}
        />
      )}
    </div>
  )
}
