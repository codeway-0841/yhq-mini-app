/**
 * Math Board — yagona board data model (Faza 2).
 *
 * Arxitektura qarori (duplikatsiyaga qarshi):
 * - `MathBlock[]` — chizish tomoni pipeline (segment → recognition →
 *   confirm → accept). Qabul qilingan blok accepted step'ga aylanadi.
 * - Typed kiritish accept paytida typed MathBlock ham yaratadi
 *   (source=user, strokes=[], recognition=confirmed) — overlay/uniformlik
 *   uchun; grading tarixi manbai `steps`ligicha qoladi (StepList, hint).
 *   Blok write-once (qabuldan keyin tahrirlanmaydi) — divergent state yo'q.
 * - `BoardTurn` — append-only tarix (50 cap): accept/undo/select/hint.
 */

import type { CheckDetail, CheckStatus } from '../../../shared/math-engine'
import type { RecognitionProvider } from '../recognition/types'

export type { RecognitionProvider }
export type BlockSource = 'user' | 'tutor'
export type BlockType = 'equation' | 'text' | 'picture'
export type RecognitionState =
  | 'unrecognized'
  | 'recognizing'
  | 'needs_review'
  | 'confirmed'
  | 'failed'

export interface BoardRect {
  x: number
  y: number
  width: number
  height: number
}

export interface BlockRecognition {
  state: RecognitionState
  confidence?: number
  alternatives?: string[]
  provider?: RecognitionProvider
  revision: number
}

export type BlockGradingStatus =
  | 'pending'
  | 'checking'
  | 'correct'
  | 'probably_correct'
  | 'uncertain'
  | 'wrong'
  | 'invalid_transition'
  | 'domain_error'
  | 'syntax_error'
  | 'unknown'

export interface MathBlock {
  id: string
  order: number
  type: BlockType
  source: BlockSource
  rect?: BoardRect
  strokeIds: string[]
  latex: string | null
  ascii: string | null
  recognition: BlockRecognition
  grading: {
    status: BlockGradingStatus
    detail?: CheckDetail
  }
  createdAt: number
  updatedAt: number
}

export interface BoardTurn {
  id: string
  problemId: string
  timestamp: number
  sessionRevision: number
  userInkRevision: number
  recognitionRevision: number
  acceptedStepIds: number[]
  changedBlockIds: string[]
  hint?: {
    question: string
    highlightBlockId?: string
    source: 'local' | 'ai'
  }
}

/** CheckStatus → block grading (1:1; probably saqlanadi — tarixiy aniqlik) */
export function toBlockGrading(status: CheckStatus): BlockGradingStatus {
  return status
}

/** Typed formula → darhol confirmed blok (stroke'siz) */
export function createTypedBlock(args: {
  id: string
  order: number
  latex: string
  ascii: string
  status: CheckStatus
  detail?: CheckDetail
  now?: number
}): MathBlock {
  const at = args.now ?? Date.now()
  return {
    id: args.id,
    order: args.order,
    type: 'equation',
    source: 'user',
    strokeIds: [],
    latex: args.latex,
    ascii: args.ascii,
    recognition: { state: 'confirmed', provider: 'manual', revision: 0 },
    grading: { status: toBlockGrading(args.status), detail: args.detail },
    createdAt: at,
    updatedAt: at,
  }
}

/** Segmentdan chizma blok (latex/ascii keyin — needs_review'dan so'ng) */
export function createDrawBlock(args: {
  id: string
  order: number
  strokeIds: string[]
  rect: BoardRect
  now?: number
}): MathBlock {
  const at = args.now ?? Date.now()
  return {
    id: args.id,
    order: args.order,
    type: 'equation',
    source: 'user',
    rect: args.rect,
    strokeIds: args.strokeIds,
    latex: null,
    ascii: null,
    recognition: { state: 'unrecognized', revision: 0 },
    grading: { status: 'pending' },
    createdAt: at,
    updatedAt: at,
  }
}
