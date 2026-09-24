import { createHash } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { db } from '../../db/connection'
import { questionBanks } from '../../schema'
import type { QuestionBankProvider, QuestionRow, TopicRow } from '../../providers/QuestionBankProvider'

/**
 * Bank kontent VERSIYASI — client persist-keshining (IndexedDB) ishonch manbai.
 *
 * EGRESS (2026-09-24, Neon overage fix): ilgari versiya BUTUN bankni
 * (0.6–11.8MB) SELECT * qilib md5 olardi — har sovuq lambda + har 30daq
 * TTL expiry'da, javob esa ~40 bayt edi. Bu 1.95GB/3kun overage'ning
 * ikkinchi eng katta manbai edi (AUDIT-NEON-EGRESS.md #2).
 *
 * Endi versiya = `question_banks.content_version` counter'i (YAGONA QATOR,
 * ~50 bayt o'qish). Admin CRUD uni atomik oshiradi
 * (admin.repository.ts bumpContentVersion) — client kesh-invalidation
 * semantikasi O'ZGARMAYDI: kontent o'zgarsa → counter oshadi → `v` o'zgaradi
 * → client bankni qayta tortadi. `v` client uchun opaque string.
 *
 * PER-LAMBDA KESH YO'Q (2026-09-24, deploy-oldi review): o'qish endi bitta
 * integer (PK lookup) bo'lgani uchun keshning foydasi ~nol, zarari esa bor —
 * Vercel'da bir necha issiq lambda bo'lishi mumkin va admin CRUD
 * `invalidateCache()` FAQAT mutatsiyani serve qilgan instance'ning xotirasini
 * tozalaydi; boshqa instance eski versiyani TTL tugaguncha qaytarardi
 * (stale kesh → client yangi kontentni ko'rmas edi). To'g'rilik > kesh.
 * Haqiqiy kesh qatlami — CDN (`s-maxage=60`, questions.router VERSION_CACHE).
 *
 * ESKI xatti-harakatdan farqi: javob kaliti (correctAnswer) tahriri ham
 * versiyani oshiradi (counter matn/kalit farqini bilmaydi) — bu xavfsiz
 * tomonga og'ish (ko'proq invalidatsiya), noto'g'ri kesh xizmati XAVFI YO'Q.
 */

/**
 * Public kontentning barqaror fingerprint'i (md5).
 * ESLATMA: endi runtime versiya endpoint'ida ISHLATILMAYDI (content_version
 * counter uni almashtirdi) — faqat testlar va lokal diagnostika uchun saqlanadi.
 */
export function hashBankContent(rows: QuestionRow[], topicRows: TopicRow[]): string {
  const hash = createHash('md5')
  for (const q of rows) {
    hash.update(String(q.id))
    hash.update('')
    hash.update(q.externalId ?? '')
    hash.update('')
    hash.update(q.questionUz ?? '')
    hash.update('')
    hash.update(q.questionRu ?? '')
    hash.update('')
    hash.update(JSON.stringify(q.optionsUz))
    hash.update('')
    hash.update(JSON.stringify(q.optionsRu))
    hash.update('')
    hash.update(q.image ?? '')
    hash.update('')
    hash.update(String(q.topicId ?? ''))
    hash.update('\x1e') // record separator
  }
  hash.update('\x1f') // topics bo'limi
  for (const t of topicRows) {
    hash.update(String(t.id))
    hash.update('')
    hash.update(t.nameUz ?? '')
    hash.update('')
    hash.update(t.nameRu ?? '')
    hash.update('')
    hash.update(t.slug ?? '')
    hash.update('\x1e')
  }
  return hash.digest('hex')
}

/**
 * Provider bank'ining joriy kontent versiyasi.
 * EGRESS: FAQAT `question_banks.content_version` yagona-qator o'qishi (~50B) —
 * butun bank (0.6–11.8MB) HECH QACHON tortilmaydi.
 * KESH'SIZ (ataylab): har so'rov yangi counter'ni qaytaradi — multi-instance
 * Vercel'da admin tahriri barcha lambda'larga darhol ko'rinadi.
 */
export async function bankContentVersion(provider: QuestionBankProvider): Promise<string> {
  const rows = await db
    .select({ v: questionBanks.contentVersion })
    .from(questionBanks)
    .where(eq(questionBanks.id, provider.sourceId))
  return `cv${rows[0]?.v ?? 1}`
}

/**
 * Admin CRUD'dan keyin — questionsRepository.invalidateCache() ichidan chaqiriladi.
 * NO-OP (2026-09-24): versiya keshi olib tashlandi (yuqoridagi izoh) — funksiya
 * chaqiriq nuqtalari o'zgarmasligi uchun SAQLANADI.
 */
export function invalidateBankVersions(): void {
  // Versiya endi har so'rovda DB'dan o'qiladi — tozalashga hojat yo'q.
}
