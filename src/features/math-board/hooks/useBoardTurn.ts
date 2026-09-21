/**
 * Math Board — turn-aware action'lar (Faza 2/6).
 *
 * Sahifa to'g'ridan-to'g'ri store action'lar o'rniga SHU hook'dan foydalanadi:
 * har accept/undo/select turn tarixiga yoziladi. Typed accept typed MathBlock
 * yaratadi (overlay/uniformlik uchun; grading manbai `steps`). P1-2: draw-blok
 * confirm'dan kelgan accept (`sourceBlockId`) alohida typed blok YARATMAYDI —
 * grading aynan shu blokka yoziladi, accepted step shu blockId bilan bog'lanadi.
 * P1-3: undo accepted step + unga tegishli blokni atomik o'chiradi (store'da).
 */

import { useCallback } from 'react'
import { useBoardSession } from './useBoardSession'
import { createTurn } from '../lib/board-revisions'
import { createTypedBlock, toBlockGrading } from '../lib/board-model'
import type { CheckResult } from '../../../shared/math-engine'

function snapshot() {
  const st = useBoardSession.getState()
  return {
    st,
    rev: {
      problemId: st.problemId,
      sessionRevision: st.sessionRevision,
      userInkRevision: st.userInkRevision,
      recognitionRevision: st.recognitionRevision,
      acceptedStepsRevision: st.acceptedStepsRevision,
    },
  }
}

export function useBoardTurn() {
  const accept = useCallback((latex: string, ascii: string, result: CheckResult, solved: boolean, sourceBlockId?: string): void => {
    const { st, rev } = snapshot()
    const stepId = st.nextId
    // P1-2: confirm qilingan draw-blok hali mavjud bo'lsa — unga bog'lanadi
    // (duplicate typed blok yo'q); topilmasa oddiy typed blok yaratiladi.
    const existing = sourceBlockId
      ? (st.blocksByProblem[rev.problemId] ?? []).find((b) => b.id === sourceBlockId)
      : undefined
    const blockId = existing ? existing.id : `t:${rev.problemId}:${rev.sessionRevision}:${stepId}`
    st.acceptStep(latex, ascii, result, solved, blockId)
    const after = useBoardSession.getState()
    if (existing) {
      after.updateBlock(rev.problemId, existing.id, {
        grading: { status: toBlockGrading(result.status), detail: result.detail },
      })
    } else {
      // Typed MathBlock (write-once) — overlay uchun
      const block = createTypedBlock({
        id: blockId,
        order: 1000 + stepId,
        latex,
        ascii,
        status: result.status,
        detail: result.detail,
      })
      after.setBlocks(rev.problemId, [...(after.blocksByProblem[rev.problemId] ?? []), block])
    }
    after.logTurn(createTurn({
      ...rev,
      acceptedStepIds: after.steps.map((s) => s.id),
      changedBlockIds: [blockId],
    }))
  }, [])

  const undo = useCallback((): void => {
    const { st, rev } = snapshot()
    const removed = st.steps[st.steps.length - 1]
    st.undoLast()
    const after = useBoardSession.getState()
    after.logTurn(createTurn({
      ...rev,
      acceptedStepIds: after.steps.map((s) => s.id),
      // P1-3: HAQIQIY o'chirilgan blockId (oldingi `step:<id>` soxta edi —
      // bunday id'li blok mavjud emas edi)
      changedBlockIds: removed?.blockId ? [removed.blockId] : [],
    }))
  }, [])

  const select = useCallback((problemId: string): void => {
    const { st, rev } = snapshot()
    st.selectProblem(problemId)
    useBoardSession.getState().logTurn(createTurn({
      ...rev,
      problemId,
      acceptedStepIds: [],
      changedBlockIds: [],
    }))
  }, [])

  return { accept, undo, select }
}
