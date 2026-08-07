/**
 * League single-source consistency.
 *
 * `LEAGUE_ORDER` server/schema.ts'da yaratiladi (progress.league CHECK
 * constraint shuga bog'langan). leaderboard.repository faqat re-export qiladi —
 * bu test desync (masalan, migration boshqa qiymatlar bilan yozilib qolishi)
 * holatida crack bo'ladi.
 */
import { describe, it, expect } from 'vitest'
import { LEAGUE_ORDER as SCHEMA_LEAGUE_ORDER } from '../../../server/schema'
import { LEAGUE_ORDER as REPO_LEAGUE_ORDER } from '../../../server/modules/leaderboard/leaderboard.repository'

describe('league — single source', () => {
  it('schema va repository bir xil (re-export)', () => {
    expect([...REPO_LEAGUE_ORDER]).toEqual([...SCHEMA_LEAGUE_ORDER])
  })

  it("bronze'dan platinum'ga ko'tariluvchi tartib", () => {
    expect([...SCHEMA_LEAGUE_ORDER]).toEqual(['bronze', 'silver', 'gold', 'platinum'])
  })

  it('idempotent: qiymatlar unikal', () => {
    expect(new Set(SCHEMA_LEAGUE_ORDER).size).toBe(SCHEMA_LEAGUE_ORDER.length)
  })
})
