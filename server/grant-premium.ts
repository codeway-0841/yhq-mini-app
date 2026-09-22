/**
 * Foydalanuvchiga Premium berish yoki muddatini uzaytirish:
 *   npx tsx server/grant-premium.ts                              — premium foydalanuvchilar ro'yxati
 *   npx tsx server/grant-premium.ts <user_id|username> [days]    — kun qo'shish (default: 30 kun)
 *   npx tsx server/grant-premium.ts <user_id|username> lifetime  — umrbod premium (tariff='premium')
 *   npx tsx server/grant-premium.ts <user_id|username> free      — bekor qilish (tariff='free')
 */
import 'dotenv/config'
import { executeRows } from './db/connection'
import { sql } from 'drizzle-orm'

const [, , targetArg, daysOrModeArg] = process.argv

if (!targetArg) {
  const rows = await executeRows<{
    id: string
    first_name: string
    username: string
    tariff: string
    premium_until: string | null
  }>(sql`
    SELECT id, first_name, username, tariff, premium_until
    FROM users
    WHERE tariff = 'premium' OR (premium_until IS NOT NULL AND premium_until > now())
    ORDER BY COALESCE(premium_until, '2099-01-01'::timestamp) DESC
    LIMIT 20
  `)

  console.log('Faol Premium foydalanuvchilar (oxirgi 20 ta):')
  if (rows.length === 0) {
    console.log("  (Hozircha premium foydalanuvchilar yo'q)")
  }
  for (const r of rows) {
    const until = r.tariff === 'premium' ? 'Umrbod (lifetime)' : (r.premium_until || '-')
    console.log(
      `  ${String(r.id).padEnd(14)} ${(r.first_name || '').padEnd(16)} @${(r.username || '-').padEnd(18)} tariff=${r.tariff.padEnd(8)} until=${until}`
    )
  }
  console.log('\nFoydalanish:')
  console.log('  npx tsx server/grant-premium.ts <user_id|username> [days]    (masalan: 30)')
  console.log('  npx tsx server/grant-premium.ts <user_id|username> lifetime')
  console.log('  npx tsx server/grant-premium.ts <user_id|username> free')
  process.exit(0)
}

const cleanTarget = targetArg.replace(/^@/, '')

const [user] = await executeRows<{
  id: string
  first_name: string
  username: string
  tariff: string
  premium_until: string | null
}>(sql`
  SELECT id, first_name, username, tariff, premium_until
  FROM users
  WHERE id = ${targetArg} OR username ILIKE ${cleanTarget}
  LIMIT 1
`)

if (!user) {
  console.error(`❌ Foydalanuvchi topilmadi: ${targetArg}`)
  process.exit(1)
}

const mode = (daysOrModeArg ?? '30').toLowerCase()

if (mode === 'free') {
  await executeRows(sql`
    UPDATE users
    SET tariff = 'free', premium_until = NULL, updated_at = now()
    WHERE id = ${user.id}
  `)
} else if (mode === 'lifetime') {
  await executeRows(sql`
    UPDATE users
    SET tariff = 'premium', premium_until = NULL, updated_at = now()
    WHERE id = ${user.id}
  `)
} else {
  const days = parseInt(mode, 10)
  if (!Number.isFinite(days) || days <= 0) {
    console.error("❌ Kunlar soni musbat butun son bo'lishi kerak (yoki 'lifetime' / 'free')")
    process.exit(1)
  }

  // C-1 qoidasi: muddatli grant tariff'ga TEGMAYDI — premium_until yetarli
  await executeRows(sql`
    UPDATE users
    SET
      premium_until = GREATEST(COALESCE(premium_until, now()), now()) + make_interval(days => ${days}::int),
      updated_at = now()
    WHERE id = ${user.id}
  `)
}

const [updated] = await executeRows<{
  id: string
  first_name: string
  username: string
  tariff: string
  premium_until: string | null
}>(sql`
  SELECT id, first_name, username, tariff, premium_until
  FROM users
  WHERE id = ${user.id}
`)

if (!updated) {
  console.error("❌ Yangilangan foydalanuvchi ma'lumotlarini o'qib bo'lmadi")
  process.exit(1)
}

const statusText =
  updated.tariff === 'premium'
    ? 'Umrbod (lifetime)'
    : updated.premium_until
      ? `${updated.premium_until} gacha`
      : "Yo'q (free)"

console.log(`✅ Premium muvaffaqiyatli saqlandi!`)
console.log(`   Foydalanuvchi: ${updated.first_name} (@${updated.username || '-'}) [ID: ${updated.id}]`)
console.log(`   Tariff:        ${updated.tariff}`)
console.log(`   Muddat:        ${statusText}`)

