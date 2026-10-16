import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PgDialect } from 'drizzle-orm/pg-core'

const executeRows = vi.hoisted(() => vi.fn(async () => [] as unknown[]))
vi.mock('../../../server/db/connection', () => ({ executeRows }))

import { liveRepository } from '../../../server/modules/live/live.repository'

const dialect = new PgDialect()
const queryText = () => executeRows.mock.calls.map(([query]) => dialect.sqlToQuery(query).sql)

beforeEach(() => executeRows.mockReset().mockResolvedValue([]))

describe('live repository regressions', () => {
  it('revoke approved hand state and participant permission in one statement', async () => {
    await liveRepository.revokeSpeaker(4, 'student')
    expect(executeRows).toHaveBeenCalledTimes(1)
    expect(queryText()[0]).toContain("UPDATE live_hand_raises SET status = 'rejected'")
    expect(queryText()[0]).toContain('UPDATE live_participants SET can_speak = false')
  })

  it('creates a deterministic room name in one atomic insert', async () => {
    executeRows.mockResolvedValueOnce([{ id: 42 }]).mockResolvedValueOnce([{ id: 42 }])
    await liveRepository.createRoom({ subjectId: 'matematika', teacherId: 'teacher', title: 'Dars', description: null, scheduledAt: null })
    expect(executeRows).toHaveBeenCalledTimes(2) // INSERT + getRoom; no UPDATE placeholder
    expect(queryText()[0]).toContain("nextval(pg_get_serial_sequence('live_rooms', 'id'))")
    expect(queryText()[0]).toContain("'live_' || next_id.id::text")
    expect(queryText()[0]).not.toContain("'pending:'")
  })

  it('rejoin recalculates microphone permission instead of retaining stale true', async () => {
    await liveRepository.joinRoom(4, 'student', 'student')
    expect(queryText()[0]).toContain('can_speak = EXCLUDED.can_speak')
    expect(queryText()[0]).not.toContain('live_participants.can_speak OR EXCLUDED.can_speak')
    expect(queryText()[0]).toContain("r.status = 'live' OR (")
    expect(queryText()[0]).toContain("r.status = 'scheduled'")
  })

  it('archived lessons are hidden and only active participants are counted', async () => {
    await liveRepository.getRoom(4)
    await liveRepository.listRooms({ limit: 20 })
    for (const query of queryText()) {
      expect(query).toContain('r.archived_at IS NULL')
      expect(query).toContain('p.left_at IS NULL')
    }
  })

  it('late webhook cannot close a newer attendance interval', async () => {
    await liveRepository.leaveRoomFromWebhook(4, 'student', 1000)
    expect(queryText()[0]).toContain('joined_at <= to_timestamp(')
    expect(queryText()[0]).toContain('left_at IS NULL')
  })

  it('database blocks scheduled room start before its UTC instant', async () => {
    await liveRepository.startRoom(4)
    expect(queryText()[0]).toContain('scheduled_at <= now()')
  })

  it('hides recordings when their lesson is archived', async () => {
    await liveRepository.listRecordings(20)
    expect(queryText()[0]).toContain('r.archived_at IS NULL')
  })

  it('only one serverless reconciler claims a stale recording', async () => {
    await liveRepository.claimStaleRecording(9)
    expect(queryText()[0]).toContain("status IN ('starting', 'started', 'stopping')")
    expect(queryText()[0]).toContain("updated_at < now() - interval '60 seconds'")
  })
})
