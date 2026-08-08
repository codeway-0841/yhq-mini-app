/**
 * Admin huquqini boshqarish:
 *   npx tsx server/set-admin.ts                 — foydalanuvchilar ro'yxati
 *   npx tsx server/set-admin.ts <user_id>       — true qilish (TG raqam id yoki 'p_<digits>')
 *   npx tsx server/set-admin.ts <user_id> false — o'chirish
 */
import 'dotenv/config'
import { db } from './db/connection'
import { users } from './schema'
import { eq, desc } from 'drizzle-orm'

const [, , idArg, flagArg] = process.argv

if (!idArg) {
  // Ro'yxat — oxirgi 10 foydalanuvchi
  const rows = await db
    .select({ id: users.id, firstName: users.firstName, username: users.username, isAdmin: users.isAdmin, tariff: users.tariff })
    .from(users)
    .orderBy(desc(users.createdAt))
    .limit(10)
  console.log('Oxirgi 10 foydalanuvchi:')
  for (const r of rows) {
    console.log(`  ${String(r.id).padEnd(12)} ${(r.firstName || '').padEnd(15)} @${(r.username || '-').padEnd(18)} admin=${r.isAdmin} tariff=${r.tariff}`)
  }
  console.log("\nFoydalanish: npx tsx server/set-admin.ts <user_id> [true|false]")
  process.exit(0)
}

const uid = idArg   // canonical TEXT id (Telegram raqam-string yoki 'p_<digits>')
const flag = flagArg !== 'false'   // default true

const [updated] = await db
  .update(users)
  .set({ isAdmin: flag })
  .where(eq(users.id, uid))
  .returning({ id: users.id, firstName: users.firstName, isAdmin: users.isAdmin })

if (!updated) {
  console.error(`❌ Foydalanuvchi topilmadi: ${idArg}`)
  process.exit(1)
}
console.log(`✅ ${updated.firstName} (${String(updated.id)}) — is_admin = ${updated.isAdmin}`)
process.exit(0)
