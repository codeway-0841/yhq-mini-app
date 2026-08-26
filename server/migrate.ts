import 'dotenv/config'
import fs from 'node:fs'
import { neon }    from '@neondatabase/serverless'
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-http'
import { migrate as migrateNeon } from 'drizzle-orm/neon-http/migrator'
import postgres   from 'postgres'
import { drizzle as drizzlePg } from 'drizzle-orm/postgres-js'
import { migrate as migratePg } from 'drizzle-orm/postgres-js/migrator'
import { config }  from './config'
import { isNeonUrl } from './db/connection'

// ── Pre-flight jurnal guard (AGENTS.md qoida #5 — 2026-08-21 drift incident) ──
// drizzle migrator FAQAT `folderMillis(meta/_journal.when) > DB max(created_at)`
// bo'lgan yozuvlarni qo'llaydi: jurnal `when` tartibsizligi keyingi migratsiyalarni
// "Migrations done" deb JIMGINA SKIP qiladi (0001_add_phone incident'i kabi).
// Migrate'dan OLDIN qattiq tekshiruv — buzilgan jurnal bilan HECH QACHON ishlamaymiz.
interface JournalEntry { idx: number; tag: string; when: number }
const journal = JSON.parse(
  fs.readFileSync('migrations/meta/_journal.json', 'utf8'),
) as { entries: JournalEntry[] }
for (let i = 0; i < journal.entries.length; i++) {
  const e = journal.entries[i]!
  if (i > 0 && e.when <= journal.entries[i - 1]!.when) {
    throw new Error(
      `Jurnal monoton EMAS: '${e.tag}' (when=${e.when}) <= '${journal.entries[i - 1]!.tag}' (when=${journal.entries[i - 1]!.when}). ` +
      `Avval meta/_journal.json dagi 'when' qiymatlarini normallashtiring (AGENTS.md qoida #5).`,
    )
  }
  const snapshot = `migrations/meta/${String(e.idx).padStart(4, '0')}_snapshot.json`
  if (!fs.existsSync(snapshot)) {
    throw new Error(`Snapshot SEO'YQ: ${snapshot} ('${e.tag}') — db:generate bazasi buziladi. Snapshot'ni tiklang.`)
  }
}

// Neon HTTP driver faqat Neon endpoint'larda ishlaydi — CI'dagi lokal
// PostgreSQL'ga TCP driver (postgres-js) orqali ulanamiz.
// (Eslatma: pg_advisory_lock Neon HTTP'da ishonchsiz — har so'rov alohida sessiya;
//  parallel-deploy himoyasi vercel-build'dagi VERCEL_ENV=production gate'da.)
if (isNeonUrl(config.db.url)) {
  await migrateNeon(drizzleNeon(neon(config.db.url)), { migrationsFolder: './migrations' })
} else {
  const client = postgres(config.db.url)
  await migratePg(drizzlePg(client), { migrationsFolder: './migrations' })
  await client.end()
}
console.log('Migrations done')
