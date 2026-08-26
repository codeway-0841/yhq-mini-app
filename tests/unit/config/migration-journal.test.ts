import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

/**
 * AGENTS.md qoida #5 regression-guard (2026-08-21 drift + 0001_add_phone incident'lar):
 * drizzle migrator FAQAT `folderMillis(meta/_journal.when) > DB max(created_at)`
 * bo'lgan yozuvlarni qo'llaydi — jurnal `when` tartibsizligi keyingi migratsiyalarni
 * "Migrations done" deb JIMGINA SKIP qiladi. Har entry'ga meta snapshot ham shart
 * (aks holda drizzle-kit generate diff bazasini topolmaydi).
 * (server/migrate.ts dagi pre-flight guard bilan bir xil tekshiruv — CI darajasi.)
 */
describe('migrations jurnal intizomi (AGENTS qoida #5)', () => {
  const root = process.cwd() // vitest doimo repo root'dan ishga tushadi
  const metaDir = path.join(root, 'migrations', 'meta')
  const journal = JSON.parse(
    fs.readFileSync(path.join(metaDir, '_journal.json'), 'utf8'),
  ) as { entries: { idx: number; tag: string; when: number }[] }

  it("har bir journal entry uchun .sql fayl mavjud", () => {
    expect(journal.entries.length).toBeGreaterThan(0)
    for (const e of journal.entries) {
      const sqlPath = path.join(root, 'migrations', `${e.tag}.sql`)
      expect(fs.existsSync(sqlPath), `yetishmaydi: ${e.tag}.sql`).toBe(true)
    }
  })

  it('har bir journal entry uchun meta snapshot mavjud', () => {
    for (const e of journal.entries) {
      const snap = path.join(metaDir, `${String(e.idx).padStart(4, '0')}_snapshot.json`)
      expect(fs.existsSync(snap), `yetishmaydi: ${e.tag} → ${snap}`).toBe(true)
    }
  })

  it("'when' qiymatlari QATTIQ monoton o'suvchi (silent-skip himoyasi)", () => {
    for (let i = 1; i < journal.entries.length; i++) {
      const prev = journal.entries[i - 1]!
      const curr = journal.entries[i]!
      expect(
        curr.when,
        `'${curr.tag}' when (${curr.when}) <= '${prev.tag}' when (${prev.when}) — migratsiya SKIP bo'ladi!`,
      ).toBeGreaterThan(prev.when)
    }
  })
})
