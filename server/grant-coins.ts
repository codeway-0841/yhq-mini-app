/**
 * Test uchun coin berish (admin/grant) — ledger bilan:
 *   npx tsx server/grant-coins.ts                 — admin'lar ro'yxati
 *   npx tsx server/grant-coins.ts <user_id> <summa>
 *
 * user_coins balans upsert + coin_transactions qatori (reason='admin')
 * BITTA atomik CTE'da (neon-http transaction'siz, connection.ts qoidasiga mos).
 * Har chaqiriq noyob ref bilan — qayta ishlatsangiz YANA qo'shiladi
 * (test grant'lar uchun ataylab; fix miqdor emas, +delta).
 */
import 'dotenv/config'
import { executeRows } from './db/connection'
import { sql } from 'drizzle-orm'

const [, , idArg, amountArg] = process.argv

if (!idArg) {
  const rows = await executeRows<{ id: string; first_name: string; username: string; balance: number | null }>(sql`
    SELECT id, first_name, username,
           (SELECT balance FROM user_coins WHERE user_id = users.id) AS balance
    FROM users WHERE is_admin = true
    ORDER BY created_at DESC
  `)
  console.log("Admin'lar:")
  for (const r of rows) {
    console.log(`  ${String(r.id).padEnd(12)} ${(r.first_name || '').padEnd(15)} @${(r.username || '-').padEnd(18)} balance=${r.balance ?? 0}`)
  }
  console.log('\nFoydalanish: npx tsx server/grant-coins.ts <user_id> <summa>')
  process.exit(0)
}

const amount = parseInt(amountArg ?? '', 10)
if (!Number.isFinite(amount) || amount <= 0) {
  console.error("❌ Summa musbat butun son bo'lishi kerak (masalan: 100000)")
  process.exit(1)
}

const uid = idArg
const ref = `grant-${Date.now()}`

// Balans upsert + ledger — bitta atomik CTE (FK: user users jadvalida bo'lishi SHART)
await executeRows(sql`
  WITH upd AS (
    INSERT INTO user_coins (user_id, balance, updated_at)
    VALUES (${uid}, ${amount}, now())
    ON CONFLICT (user_id) DO UPDATE
    SET balance = user_coins.balance + ${amount}, updated_at = now()
    RETURNING user_id
  )
  INSERT INTO coin_transactions (user_id, delta, reason, ref_id, created_at)
  SELECT user_id, ${amount}, 'admin', ${ref}, now() FROM upd
`)

const [row] = await executeRows<{ balance: number }>(sql`
  SELECT balance::int AS balance FROM user_coins WHERE user_id = ${uid}
`)

if (!row) {
  console.error(`❌ Balans o'qilmadi (user borligini tekshiring): ${uid}`)
  process.exit(1)
}
console.log(`✅ ${uid} → +${amount.toLocaleString('ru-RU')} coin. Yangi balans: ${Number(row.balance).toLocaleString('ru-RU')}`)
process.exit(0)
