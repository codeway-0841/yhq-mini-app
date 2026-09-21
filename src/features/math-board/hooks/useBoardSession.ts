/**
 * Math Board — sessiya store (Faza 3).
 *
 * Qadamlar localStorage'da (`yhq-math-board`) — sahifa yopilib ochilganda
 * davom etadi. Masala almashsa eski qadamlar tozalanadi. Account switch'da
 * ACCOUNT_STORAGE_KEYS orqali tozalanadi. Jonli tekshirish (debounce +
 * revisionId) `useStepCheck` hook'ida — bu store faqat holat saqlaydi.
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { onAccountReset } from '../../../shared/lib/account-events'
import type { CheckResult } from '../../../shared/math-engine'
import { appendTurn } from '../lib/board-revisions'
import type { BoardTurn, MathBlock } from '../lib/board-model'

export interface AcceptedStep {
  id: number
  latex: string
  ascii: string
  result: CheckResult
  at: number
  /** P1-3: qadam bog'langan MathBlock id (undo invariant — atomik o'chirish) */
  blockId?: string
}

interface BoardSessionState {
  problemId: string
  steps: AcceptedStep[]
  inputLatex: string
  solved: boolean
  nextId: number
  /** StepInput remount kaliti — accept/select/reset'da bump (P2: vizual tozalash) */
  inputKey: number
  /** P1-2: joriy input qaysi draw-blokdan confirm qilingan (accept shu blokka bog'lanadi;
   *  qo'lda tahrir `setInput` bu bog'lanishni tozalaydi) */
  inputBlockId: string | null
  /** P0-D revisionlar (stale-guard konteksti) — monotonik, persist qilinadi */
  sessionRevision: number
  userInkRevision: number
  recognitionRevision: number
  acceptedStepsRevision: number
  /** Faza 2: masala-bazali bloklar + turn tarixi (append-only, 50 cap) */
  blocksByProblem: Record<string, MathBlock[]>
  turns: BoardTurn[]
  selectProblem: (problemId: string) => void
  setInput: (latex: string) => void
  /** P1-2: draw-blok confirm — input shu blokka bog'lanadi (duplicate typed blok yo'q) */
  setInputFromBlock: (blockId: string, latex: string) => void
  /** Chizma o'zgarganda (BoardCanvas) — userInkRevision++ */
  bumpInk: () => void
  /** Recognition boshlanganda — recognitionRevision++ */
  bumpRecognition: () => void
  acceptStep: (latex: string, ascii: string, result: CheckResult, solved: boolean, blockId?: string) => void
  undoLast: () => void
  reset: () => void
  setBlocks: (problemId: string, blocks: MathBlock[]) => void
  updateBlock: (problemId: string, id: string, patch: Partial<MathBlock>) => void
  clearProblemBlocks: (problemId: string) => void
  logTurn: (turn: BoardTurn) => void
}

export const useBoardSession = create<BoardSessionState>()(
  persist(
    (set) => ({
      problemId: 'log-1',
      steps: [],
      inputLatex: '',
      solved: false,
      nextId: 1,
      inputKey: 0,
      inputBlockId: null,
      sessionRevision: 0,
      userInkRevision: 0,
      recognitionRevision: 0,
      acceptedStepsRevision: 0,
      blocksByProblem: {},
      turns: [],

      selectProblem: (problemId) =>
        set((s) => (s.problemId === problemId
          ? s
          : {
            problemId, steps: [], inputLatex: '', inputBlockId: null, solved: false, nextId: 1,
            inputKey: s.inputKey + 1, sessionRevision: s.sessionRevision + 1,
          })),

      setInput: (inputLatex) => set((s) => ({ inputLatex, inputBlockId: null, userInkRevision: s.userInkRevision + 1 })),

      setInputFromBlock: (blockId, latex) =>
        set((s) => ({ inputLatex: latex, inputBlockId: blockId, userInkRevision: s.userInkRevision + 1 })),

      bumpInk: () => set((s) => ({ userInkRevision: s.userInkRevision + 1 })),

      bumpRecognition: () => set((s) => ({ recognitionRevision: s.recognitionRevision + 1 })),

      acceptStep: (latex, ascii, result, solved, blockId) =>
        set((s) => ({
          steps: [...s.steps, { id: s.nextId, latex, ascii, result, at: Date.now(), blockId }],
          nextId: s.nextId + 1,
          inputLatex: '',
          inputBlockId: null,
          inputKey: s.inputKey + 1,
          acceptedStepsRevision: s.acceptedStepsRevision + 1,
          solved: s.solved || solved,
        })),
      undoLast: () =>
        set((s) => {
          const removed = s.steps[s.steps.length - 1]
          // ATOMIK undo (round-3 P1-2 invariant):
          // - TYPED accepted blok (stroke'siz) — step bilan birga O'CHADI.
          // - DRAW accepted blok — stroke'lari canvasda qolgani uchun blok
          //   O'CHIRILMAYDI: recognition=confirmed saqlanadi, grading=pending'ga
          //   qaytariladi, accepted step olib tashlanadi. Input tiklanadi —
          //   draw qadam undo'dan keyin qayta check/accept qilinishi mumkin.
          // Barchasi BITTA set'da — acceptedSteps va bloklar desync bo'lmaydi.
          let blocksByProblem = s.blocksByProblem
          let inputRestore: {
            inputLatex: string
            inputBlockId: string
            inputKey: number
            userInkRevision: number
          } | null = null
          if (removed?.blockId) {
            const list = s.blocksByProblem[s.problemId]
            const block = list?.find((b) => b.id === removed.blockId)
            if (block) {
              if (block.strokeIds.length > 0) {
                blocksByProblem = {
                  ...s.blocksByProblem,
                  [s.problemId]: list.map((b) => (b.id === block.id
                    ? { ...b, grading: { status: 'pending' as const }, updatedAt: Date.now() }
                    : b)),
                }
                inputRestore = {
                  inputLatex: removed.latex,
                  inputBlockId: block.id,
                  inputKey: s.inputKey + 1,
                  userInkRevision: s.userInkRevision + 1,
                }
              } else {
                blocksByProblem = {
                  ...s.blocksByProblem,
                  [s.problemId]: list.filter((b) => b.id !== block.id),
                }
              }
            }
          }
          return {
            steps: s.steps.slice(0, -1),
            // Oxirgi qadam o'chsa solved qayta hisoblanadi (sodda: false; keyingi
            // accept'ta yana true bo'ladi — tarixiy solved bayrog'i saqlanmaydi)
            solved: false,
            acceptedStepsRevision: s.acceptedStepsRevision + 1,
            blocksByProblem,
            ...(inputRestore ?? {}),
          }
        }),

      reset: () => set((s) => ({
        steps: [], inputLatex: '', inputBlockId: null, solved: false, nextId: 1, inputKey: s.inputKey + 1,
        sessionRevision: s.sessionRevision + 1,
        blocksByProblem: {},
        turns: [],
      })),

      setBlocks: (problemId, blocks) =>
        set((s) => ({ blocksByProblem: { ...s.blocksByProblem, [problemId]: blocks } })),

      updateBlock: (problemId, id, patch) =>
        set((s) => ({
          blocksByProblem: {
            ...s.blocksByProblem,
            [problemId]: (s.blocksByProblem[problemId] ?? []).map((b) =>
              b.id === id ? { ...b, ...patch, updatedAt: Date.now() } : b,
            ),
          },
        })),

      clearProblemBlocks: (problemId) =>
        set((s) => {
          if (!s.blocksByProblem[problemId]) return s
          const next = { ...s.blocksByProblem }
          delete next[problemId]
          return { blocksByProblem: next }
        }),

      logTurn: (turn) => set((s) => ({ turns: appendTurn(s.turns, turn) })),
    }),
    {
      name: 'yhq-math-board',
      version: 3,
      // Eski/buzuq snapshot app'ni crash qilmasin: blocks/turns shakli
      // tekshiriladi, yaroqsiz bo'lsa default (qadamlar saqlanadi).
      migrate: (persisted: unknown, version: number) => {
        const p = (persisted ?? {}) as Record<string, unknown>
        if (p.blocksByProblem !== undefined
          && (typeof p.blocksByProblem !== 'object' || p.blocksByProblem === null || Array.isArray(p.blocksByProblem))) {
          delete p.blocksByProblem
        }
        if (p.turns !== undefined && !Array.isArray(p.turns)) delete p.turns
        // P2-1 (round-3): v2 AcceptedStep'larda blockId YO'Q — undo invarianti
        // uchun xavfsiz mapping imkonsiz (typed blockId = t:<problemId>:
        // <sessionRevision>:<stepId> — revision qayta qurilmaydi). Legacy
        // session IZCHIL RESET: steps+blocks+turns birgalikda tozalanadi —
        // step va blok divergent holatda qoldirilmaydi.
        if (version < 3) {
          const hasSteps = Array.isArray(p.steps) && p.steps.length > 0
          const hasBlocks = typeof p.blocksByProblem === 'object' && p.blocksByProblem !== null
            && Object.keys(p.blocksByProblem as object).length > 0
          if (hasSteps || hasBlocks) {
            p.steps = []
            p.solved = false
            p.inputLatex = ''
            p.inputBlockId = null
            p.blocksByProblem = {}
            p.turns = []
          }
        }
        return p
      },
    },
  ),
)

// P1-6: account switch'da xotiradagi sessiya ham tozalanadi (modul bir marta
// yuklanganda obuna — persist rehydrate'dan keyin ham ishlaydi, chunki reset
// hozirgi state'ni tozalaydi; localStorage snapshot account.ts'da o'chadi).
onAccountReset(() => {
  useBoardSession.getState().reset()
})
