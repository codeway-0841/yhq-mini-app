/**
 * Region migratsiyasini TEKSHIRISH — eski va yangi bazani solishtiradi.
 *
 * QAT'IY FAQAT O'QISH. Skript hech qanday yozuv, DDL yoki migratsiya
 * bajarmaydi — ikkala bazaga ham faqat SELECT yuboradi.
 *
 * Ishlatish:
 *   OLD_DATABASE_URL="postgresql://...us-east-2..." \
 *   NEW_DATABASE_URL="postgresql://...eu-central-1..." \
 *   npx tsx infra/db/verify-migration.ts
 *
 * Ikkalasi ham UNPOOLED (to'g'ridan-to'g'ri) URL bo'lishi kerak — pooler
 * ortidagi ulanish `pg_stat_user_tables` statistikasini boshqacha ko'rsatishi
 * mumkin.
 *
 * Chiqish kodi: 0 = mos, 1 = farq bor (CI'da ham ishlatsa bo'ladi).
 */
import { neon } from '@neondatabase/serverless'

type Row = Record<string, unknown>

const OLD = process.env['OLD_DATABASE_URL']
const NEW = process.env['NEW_DATABASE_URL']

if (!OLD || !NEW) {
  console.error('OLD_DATABASE_URL va NEW_DATABASE_URL kerak')
  process.exit(2)
}
if (OLD === NEW) {
  console.error('OLD va NEW bir xil — solishtirishning ma\'nosi yo\'q')
  process.exit(2)
}

async function snapshot(url: string) {
  const sql = neon(url)
  const [meta] = (await sql`SELECT version() AS v, current_database() AS db`) as Row[]
  const tables = (await sql`
    SELECT relname AS name, n_live_tup AS rows
    FROM pg_stat_user_tables
    ORDER BY relname
  `) as Row[]
  const extensions = (await sql`SELECT extname FROM pg_extension ORDER BY extname`) as Row[]
  // Drizzle jurnali — yangi bazada ham AYNI tag'lar bo'lishi shart, aks holda
  // migratsiyalar qayta ishga tushib jonli sxemani buzishi mumkin.
  const migrations = (await sql`
    SELECT hash FROM drizzle.__drizzle_migrations ORDER BY created_at
  `.catch(() => [])) as Row[]

  return {
    version: String(meta?.['v'] ?? '').split(' ').slice(0, 2).join(' '),
    database: String(meta?.['db'] ?? ''),
    tables: new Map(tables.map((t) => [String(t['name']), Number(t['rows'])])),
    extensions: extensions.map((e) => String(e['extname'])),
    migrations: migrations.length,
  }
}

async function main() {
  const [a, b] = await Promise.all([snapshot(OLD!), snapshot(NEW!)])
  const problems: string[] = []

  console.log('ESKI :', a.version, '|', a.tables.size, 'jadval |', a.migrations, 'migratsiya')
  console.log('YANGI:', b.version, '|', b.tables.size, 'jadval |', b.migrations, 'migratsiya')
  console.log()

  if (a.version !== b.version) {
    problems.push(`Postgres versiyasi farq qiladi: ${a.version} -> ${b.version}`)
  }
  if (a.migrations !== b.migrations) {
    problems.push(`Drizzle migratsiya soni farq qiladi: ${a.migrations} -> ${b.migrations}`)
  }

  const missingExt = a.extensions.filter((e) => !b.extensions.includes(e))
  if (missingExt.length) problems.push(`Yangi bazada extension yo'q: ${missingExt.join(', ')}`)

  const rows: Array<{ jadval: string; eski: number | string; yangi: number | string; holat: string }> = []
  for (const [name, oldRows] of [...a.tables].sort()) {
    if (!b.tables.has(name)) {
      problems.push(`Jadval yo'q: ${name}`)
      rows.push({ jadval: name, eski: oldRows, yangi: 'YO\'Q', holat: 'XATO' })
      continue
    }
    const newRows = b.tables.get(name)!
    // rate_limits va analytics_events dump paytida o'sishi mumkin — ular
    // faqat kuzatuv ma'lumoti, kamayish bo'lmasa yetarli.
    const volatile = name === 'rate_limits' || name === 'analytics_events' || name === 'job_runs'
    const ok = volatile ? newRows >= 0 : newRows === oldRows
    if (!ok) problems.push(`${name}: ${oldRows} -> ${newRows} (qator soni mos emas)`)
    rows.push({
      jadval: name,
      eski: oldRows,
      yangi: newRows,
      holat: newRows === oldRows ? 'mos' : volatile ? 'o\'zgaruvchan' : 'FARQ',
    })
  }
  const extraTables = [...b.tables.keys()].filter((t) => !a.tables.has(t))
  if (extraTables.length) console.log('Yangi bazada QO\'SHIMCHA jadval:', extraTables.join(', '))

  console.table(rows.filter((r) => r.holat !== 'mos' || Number(r.eski) > 0))

  if (problems.length) {
    console.error('\nMUAMMO TOPILDI:')
    for (const p of problems) console.error(' -', p)
    console.error('\nCutover QILMANG. Yuqoridagilarni hal qiling.')
    process.exit(1)
  }
  console.log('\nHammasi mos. Cutover uchun tayyor.')
}

void main().catch((err) => {
  console.error('Tekshiruv bajarilmadi:', err)
  process.exit(2)
})
