/**
 * Boss Battle repository — haftalik jamoaviy jang DB qatlami.
 *
 * ATOMIKLIK:
 *  - Boss yaratish: periodKey UNIQUE + ON CONFLICT DO NOTHING (lazy yaratish
 *    parallel so'rovlarda xavfsiz).
 *  - Zarar: UPDATE ... WHERE status='active' (row lock) — parallel zararlar
 *    serialize; HP GREATEST(0) bilan chegaralanadi, 'defeated'ga FAQAT bitta
 *    zarar o'tkazadi. Damage ledger (boss_damage) esa HOLDAN tashkil topgan
 *    mukofot uchun doim yoziladi (boss o'lganidan KEYIN berilgan zarar ham
 *    ishtirok hisobiga kiradi — adolat uchun).
 *  - Rollov mukofotlari: ledger `reason='boss_reward'`, ref='boss:<id>:<user>'
 *    UNIQUE + rewardsDistributed bayrog'i — retry/replay'da ikki marta
 *    berilmaydi (tournament-prize pattern'i).
 */
import { sql } from 'drizzle-orm'
import { executeRows } from '../../db/connection'
import { BOSS_REWARDS, bossForPeriod } from '../../../shared/boss-battle'

export interface BossStateRow {
  bossId: number
  bossKey: string
  hpTotal: number
  hpLeft: number
  status: 'active' | 'defeated' | 'escaped'
  myDamage: number
  totalDamage: number
  top: { userId: string; firstName: string; photoUrl: string | null; hasCustomAvatar: boolean; damage: number }[]
}

export const bossRepository = {
  /**
   * Joriy hafta bossini topish YOKI lazy yaratish (DETERMINISTIK roster
   * rotatsiyasi bilan) — parallel race'da ON CONFLICT DO NOTHING xavfsiz.
   */
  async ensureActiveBoss(periodKey: string): Promise<void> {
    const def = bossForPeriod(periodKey)
    await executeRows(sql`
      INSERT INTO boss_battles (period_key, boss_id, hp_total, hp_left)
      VALUES (${periodKey}, ${def.id}, ${def.hp}, ${def.hp})
      ON CONFLICT (period_key) DO NOTHING
    `)
  },

  /**
   * Fresh to'g'ri javob zarari — BITTA atomik statement:
   * lazy boss → HP kamayish (faqat active; 'defeated' bir marta) → user
   * damage ledger upsert (boss holatidan MUSTASQIL — o'ldirgach kelgan
   * zarar ham ishtirokka kiradi).
   * Returns: yangilangan holat (UI toast uchun) yoki null (boss yo'q/jarhoyot).
   */
  async applyDamage(userId: string, periodKey: string, damage: number): Promise<{ defeated: boolean } | null> {
    // NOTE (audit #6): ensureActiveBoss'ni shu CTE'ga INSERT sifatida qo'shib,
    // hot path'dagi 2-round-tripni 1taga tushirish SINALGAN edi — lekin
    // boss_battles'ga BIR WITH ichida IKKI marta yozish (ensured INSERT +
    // upd UPDATE, orasida to'g'ridan-to'g'ri bog'liqlik yo'q) natijasi
    // NOANIQ bo'lib chiqdi (Postgres docs: bir jadvalga sibling
    // data-modifying CTE'lar "unwise" — natija kafolatlanmagan). CI'da
    // reproduksiya qilindi (applyDamage kill-test yiqildi). Xavfsizlik
    // uchun ikki alohida statement saqlab qolindi.
    await this.ensureActiveBoss(periodKey)
    const rows = await executeRows<{ boss_id: number | null; defeated: boolean }>(sql`
      WITH boss AS (
        SELECT id FROM boss_battles WHERE period_key = ${periodKey} LIMIT 1
      ), upd AS (
        UPDATE boss_battles b SET
          hp_left = GREATEST(b.hp_left - ${damage}::int, 0),
          status  = CASE WHEN b.hp_left - ${damage}::int <= 0 THEN 'defeated' ELSE b.status END
        WHERE b.id = (SELECT id FROM boss)
          AND b.status = 'active'
        RETURNING b.id, b.status
      ), mine AS (
        -- Damage har doim yoziladi (boss o'lgan bo'lsa ham ishtirok hisobiga)
        INSERT INTO boss_damage (boss_id, user_id, damage, updated_at)
        SELECT (SELECT id FROM boss), ${userId}, ${damage}::int, now()
        WHERE EXISTS (SELECT 1 FROM boss)
        ON CONFLICT (boss_id, user_id) DO UPDATE SET
          damage     = boss_damage.damage + EXCLUDED.damage,
          updated_at = now()
        RETURNING user_id
      )
      SELECT (SELECT id    FROM upd) AS boss_id,
             EXISTS (SELECT 1 FROM upd WHERE status = 'defeated') AS defeated
    `)
    return rows[0]?.boss_id ? { defeated: rows[0].defeated } : { defeated: false }
  },

  /** Dashboard kartasi uchun to'liq holat (4 parallel arzon so'rov) */
  async getState(userId: string, periodKey: string): Promise<BossStateRow | null> {
    await this.ensureActiveBoss(periodKey)
    const [bossRows, mineRows, totalRows, topRows] = await Promise.all([
      executeRows<{ id: number; boss_id: string; hp_total: number; hp_left: number; status: string }>(sql`
        SELECT id, boss_id, hp_total, hp_left::int, status
        FROM boss_battles WHERE period_key = ${periodKey} LIMIT 1
      `),
      executeRows<{ d: number }>(sql`
        SELECT COALESCE(SUM(damage), 0)::int AS d FROM boss_damage bd
        JOIN boss_battles b ON b.id = bd.boss_id AND b.period_key = ${periodKey}
        WHERE bd.user_id = ${userId}
      `),
      executeRows<{ d: number }>(sql`
        SELECT COALESCE(SUM(damage), 0)::int AS d FROM boss_damage bd
        JOIN boss_battles b ON b.id = bd.boss_id AND b.period_key = ${periodKey}
      `),
      executeRows<{ user_id: string; first_name: string; photo_url: string | null; avatar_webp: string | null; d: number }>(sql`
        SELECT bd.user_id, u.first_name, u.photo_url, u.avatar_webp, bd.damage::int AS d
        FROM boss_damage bd
        JOIN boss_battles b ON b.id = bd.boss_id AND b.period_key = ${periodKey}
        JOIN users u ON u.id = bd.user_id
        ORDER BY bd.damage DESC, bd.user_id
        LIMIT 3
      `),
    ])
    const b = bossRows[0]
    if (!b) return null
    return {
      bossId: b.id,
      bossKey: b.boss_id,
      hpTotal: Number(b.hp_total),
      hpLeft: Number(b.hp_left),
      status: b.status as BossStateRow['status'],
      myDamage: Number(mineRows[0]?.d ?? 0),
      totalDamage: Number(totalRows[0]?.d ?? 0),
      top: topRows.map((r) => ({
        userId: r.user_id,
        firstName: r.first_name,
        photoUrl: r.photo_url,
        hasCustomAvatar: r.avatar_webp !== null,
        damage: Number(r.d),
      })),
    }
  },

  /**
   * Haftalik ROLLOVER (cron, retry-safe):
   *  prevPeriod boss'i: active → escaped; defeated && !distributed → atomik
   *  mukofot taqsimoti (ishtirok + top-3, ledger'idempotent).
   *  Returns: { escaped: boolean; awarded: number }
   */
  async weeklyRollover(prevPeriodKey: string): Promise<{ escaped: boolean; awarded: number; distributed: boolean }> {
    // 1) Hali yengilmagan faol bo'lsa — "qochib qutuldi"
    const esc = await executeRows<{ id: number }>(sql`
      UPDATE boss_battles SET status = 'escaped'
      WHERE period_key = ${prevPeriodKey} AND status = 'active'
      RETURNING id
    `)

    // 2) Maqsadni top: defeated va hali mukofot berilmagan
    const tgt = await executeRows<{ id: number }>(sql`
      SELECT id FROM boss_battles
      WHERE period_key = ${prevPeriodKey} AND status = 'defeated' AND rewards_distributed = false
      LIMIT 1
    `)
    const bossId = tgt[0]?.id
    if (bossId == null) {
      return { escaped: esc.length > 0, awarded: 0, distributed: false }
    }

    const [t1, t2, t3] = BOSS_REWARDS.topCoins
    const rows = await executeRows<{ awarded: number }>(sql`
      WITH winners AS (
        -- ROW_NUMBER (RANK emas): damage butun sondagi dag'al birlik (5 ballik
        -- qadam) — teng damage odatiy holat. RANK bo'lsa teng bo'lganlarning
        -- HAMMASI top-1 mukofot olardi (cheksiz coin mint xavfi).
        SELECT user_id, damage,
               ROW_NUMBER() OVER (ORDER BY damage DESC, user_id) AS rk
        FROM boss_damage WHERE boss_id = ${bossId}
      ), grants AS (
        SELECT user_id,
               (CASE WHEN damage >= ${BOSS_REWARDS.participationMinDamage}::int
                     THEN ${BOSS_REWARDS.participationCoins}::int ELSE 0 END
              + CASE WHEN damage >= ${BOSS_REWARDS.participationMinDamage}::int THEN
                  CASE rk WHEN 1 THEN ${t1}::int WHEN 2 THEN ${t2}::int WHEN 3 THEN ${t3}::int ELSE 0 END
                ELSE 0 END
               ) AS amt
        FROM winners
      ), ledger AS (
        -- LEDGER-FIRST (audit H-5): idempotency ('boss:<bossId>:<userId>' UNIQUE)
        -- AVVAL yoziladi, award FAQAT ledger'dan O'TGAN userlarga. Teskari tartibda
        -- (award → ledger) statement qayta ishga tushganda balans IKKI MARTA
        -- oshardi (claimTask bilan bir xil pattern).
        INSERT INTO coin_transactions (user_id, delta, reason, ref_id)
        SELECT user_id, amt, 'boss_reward', ${'boss:'} || ${String(bossId)} || ':' || user_id
        FROM grants WHERE amt > 0
        ON CONFLICT (user_id, reason, ref_id) DO NOTHING
        RETURNING user_id
      ), award AS (
        INSERT INTO user_coins (user_id, balance, updated_at)
        SELECT g.user_id, g.amt, now() FROM grants g
        WHERE g.amt > 0 AND EXISTS (SELECT 1 FROM ledger l WHERE l.user_id = g.user_id)
        ON CONFLICT (user_id) DO UPDATE SET
          balance = user_coins.balance + EXCLUDED.balance,
          updated_at = now()
        RETURNING user_id
      ), flag AS (
        UPDATE boss_battles SET rewards_distributed = true
        WHERE id = ${bossId}
        RETURNING id
      )
      SELECT (SELECT COUNT(*)::int FROM grants WHERE amt > 0) AS awarded
    `)
    return { escaped: esc.length > 0, awarded: Number(rows[0]?.awarded ?? 0), distributed: true }
  },
}
