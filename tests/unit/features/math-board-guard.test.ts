/**
 * Math Board — request stale-guard (P0-D full context).
 *
 * problemId, sessionRevision, userInkRevision, recognitionRevision,
 * acceptedStepsRevision, candidate, requestId — bittasi farq qilsa stale.
 */
import { describe, it, expect } from 'vitest'
import {
  captureContext, sameContext, strokeMarker,
  type BoardRevisions,
} from '../../../src/features/math-board/lib/request-guard'

const REV: BoardRevisions = {
  problemId: 'log-1',
  sessionRevision: 3,
  userInkRevision: 7,
  recognitionRevision: 1,
  acceptedStepsRevision: 2,
}

describe('request-guard full context', () => {
  it('bir xil kontekst → true', () => {
    expect(sameContext(
      captureContext(REV, 'a|b', 1),
      captureContext(REV, 'a|b', 1),
    )).toBe(true)
  })

  it.each([
    ['problemId', { ...REV, problemId: 'log-2' }],
    ['sessionRevision', { ...REV, sessionRevision: 4 }],
    ['userInkRevision', { ...REV, userInkRevision: 8 }],
    ['recognitionRevision', { ...REV, recognitionRevision: 2 }],
    ['acceptedStepsRevision', { ...REV, acceptedStepsRevision: 3 }],
  ])('%s o‘zgarsa → false', (_name, rev) => {
    expect(sameContext(
      captureContext(REV, 'a', 1),
      captureContext(rev, 'a', 1),
    )).toBe(false)
  })

  it('candidate farqi → false (yangi kiritish)', () => {
    expect(sameContext(
      captureContext(REV, 'y+|syntax', 1),
      captureContext(REV, 'q+|syntax', 1),
    )).toBe(false)
  })

  it('requestId farqi → false (yangi so‘rov eskisini bekor qiladi)', () => {
    expect(sameContext(
      captureContext(REV, 'a', 1),
      captureContext(REV, 'a', 2),
    )).toBe(false)
  })

  it('strokeMarker: bo‘sh, o‘sish, oxirgi nuqta', () => {
    expect(strokeMarker([])).toBe('0:-')
    const one = [{ points: [{ x: 0.1, y: 0.2 }] }]
    const two = [...one, { points: [{ x: 0.5, y: 0.5 }] }]
    expect(strokeMarker(one)).not.toBe(strokeMarker(two))
    expect(strokeMarker(one)).toBe(strokeMarker([{ points: [{ x: 0.1, y: 0.2 }] }]))
  })
})
