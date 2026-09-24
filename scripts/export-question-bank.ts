/**
 * export-question-bank.ts — Neon → PRIVATE R2 savol banki publish CLI'si.
 *
 * FAZO 1: faqat fizika (QBANK_SUBJECTS'dagi fanlar).
 *
 * Ishlatish:
 *   npm run export:qbank -- --subject=fizika            # bitta fan publish
 *   npm run export:qbank -- --all                       # BARCHA fanlar (ketma-ket)
 *   npm run export:qbank -- --subject=fizika --dry-run  # faqat validatsiya (R2'ga yozmaydi)
 *
 * ATOMIK PUBLISH: barcha chunk/rasm/manifest yuklanib HEAD bilan tekshirilgach
 * `published.json` markeri yoziladi — client'lar faqat tekshirilgan versiyani
 * ko'radi. --dry-run hech narsa yozmaydi (Neon faqat o'qiladi).
 *
 * Kerakli env (.env): DATABASE_URL, CLOUDFLARE_ACCOUNT_ID,
 * CLOUDFLARE_R2_ACCESS_KEY_ID, CLOUDFLARE_R2_SECRET_ACCESS_KEY,
 * CLOUDFLARE_R2_QBANK_BUCKET.
 */
import 'dotenv/config'
import fs from 'node:fs/promises'
import path from 'node:path'
import { authRepository } from '../server/modules/auth/auth.repository'
import {
  QBANK_SUBJECTS,
  getQbankStorage,
  isQbankSubject,
  makeNeonPublishDeps,
  publishQuestionBank,
  type QbankSubjectId,
  type PublishReport,
} from '../server/modules/content/qbank-publish'

const args = process.argv.slice(2)
const isDryRun = args.includes('--dry-run')
const subjectArg = args.find((a) => a === '--subject' || a.startsWith('--subject='))
let subjectId: string | undefined
if (subjectArg?.startsWith('--subject=')) {
  subjectId = subjectArg.slice('--subject='.length)
} else if (subjectArg === '--subject') {
  subjectId = args[args.indexOf('--subject') + 1]
}

function fail(message: string): never {
  console.error(`❌ ${message}`)
  process.exit(1)
}

/**
 * DB rasm yo'li (`/physics-print/x.webp`) → lokal fayl bytes.
 * Manba: repo'dagi `public/` static fayllar (Vercel'da ham xizmatda).
 * Topilmasa null — publish eski yo'lni saqlab qoladi (graceful).
 */
async function loadImageFromPublic(dbPath: string): Promise<Buffer | null> {
  // Path traversal himoyasi: faqat bitta segmentli xavfsiz nomlar
  const rel = dbPath.replace(/^\/+/, '')
  if (rel.includes('..') || rel.includes('\0')) return null
  const filePath = path.resolve(process.cwd(), 'public', rel)
  if (!filePath.startsWith(path.resolve(process.cwd(), 'public'))) return null
  try {
    return await fs.readFile(filePath)
  } catch {
    return null
  }
}

async function publishOne(subject: QbankSubjectId, storage: NonNullable<ReturnType<typeof getQbankStorage>>): Promise<PublishReport> {
  const deps = makeNeonPublishDeps(subject, storage, loadImageFromPublic)
  return publishQuestionBank(subject, deps, {
    dryRun: isDryRun,
    log: (msg) => console.log(msg),
  })
}

async function main(): Promise<void> {
  console.log('=== QBANK EXPORT: Neon → PRIVATE R2 ===\n')
  const isAll = args.includes('--all')
  let subjects: QbankSubjectId[]
  if (isAll) {
    subjects = Object.keys(QBANK_SUBJECTS) as QbankSubjectId[]
  } else if (subjectId && isQbankSubject(subjectId)) {
    subjects = [subjectId]
  } else {
    fail(`--subject=<id> yoki --all kerak. Fanlar: ${Object.keys(QBANK_SUBJECTS).join(', ')}. Berilgan: ${subjectId ?? 'yo\'q'}`)
  }

  const storage = getQbankStorage()
  if (!storage) {
    fail('R2 sozlanmagan: CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_R2_ACCESS_KEY_ID / CLOUDFLARE_R2_SECRET_ACCESS_KEY / CLOUDFLARE_R2_QBANK_BUCKET env kerak.')
  }

  // --all: har bir fan alohida publish (biri yiqilsa qolganlari davom etadi,
  // yakunda yig'ma hisobot + non-zero exit).
  if (subjects.length > 1) {
    const failed: string[] = []
    for (const subject of subjects) {
      try {
        await publishOne(subject, storage)
      } catch (err) {
        console.error(`\n❌ ${subject}: ${err instanceof Error ? err.message : err}`)
        failed.push(subject)
      }
    }
    console.log(`\n=== YIG'MA: ${subjects.length - failed.length}/${subjects.length} publish OK${failed.length > 0 ? ` (yiqildi: ${failed.join(', ')})` : ''} ===`)
    if (failed.length > 0) process.exit(1)
    return
  }
  const report: PublishReport = await publishOne(subjects[0] as QbankSubjectId, storage)

  console.log('\n=== HISOBOT ===')
  console.log(`  fan:              ${report.subject} (${report.pathSegment})`)
  console.log(`  versiya:          cv${report.version}${report.dryRun ? ' (DRY-RUN — yozilmadi)' : ' PUBLISHED'}`)
  console.log(`  savollar:         ${report.questionCount}`)
  console.log(`  mavzular:         ${report.topicCount}`)
  console.log(`  chunk'lar:        ${report.chunkCount} (${(report.chunkBytes / 1024).toFixed(1)} KB)`)
  console.log(`  rasmlar:          ${report.imageCount} (${(report.imageBytes / 1024).toFixed(1)} KB), skip=${report.skippedImages}, yo'q=${report.missingImages}`)
  if (!report.dryRun) {
    console.log(`  yuklangan obj:    ${report.uploadedObjects}`)
    console.log(`  tekshirilgan:     ${report.verifiedObjects}`)
    if (report.deletedOldVersions.length > 0) {
      console.log(`  tozalangan:       v${report.deletedOldVersions.join(', v')}`)
    }
  }
  console.log(`  davomiylik:       ${(report.durationMs / 1000).toFixed(1)}s`)

  if (report.missingImages > 0) {
    console.warn(`\n⚠️  ${report.missingImages} ta rasm public/'dan topilmadi — ular ESKI (Vercel static) yo'lda qoldi.`)
  }

  if (!report.dryRun) {
    await authRepository.createAuditLog({
      action: 'qbank_publish',
      resourceType: 'question_bank',
      resourceId: `${report.pathSegment}:cv${report.version}`,
      changes: {
        subject: report.subject,
        version: report.version,
        questionCount: report.questionCount,
        chunkCount: report.chunkCount,
        chunkBytes: report.chunkBytes,
        imageCount: report.imageCount,
        missingImages: report.missingImages,
        durationMs: report.durationMs,
      },
    }).catch((err) => console.warn('⚠️  audit log yozilmadi:', err))
    console.log('\n✅ PUBLISH YAKUNLANDI — client\'lar endi yangi versiyani ko\'radi (≤60s CDN).')
  } else {
    console.log('\n✅ DRY-RUN OK — validatsiya o\'tdi, R2\'ga hech narsa yozilmadi.')
  }
}

// Neon HTTP driver stateless — yopiladigan ulanish yo'q; jarayon shu yerda tugaydi.
main()
  .then(() => { process.exit(0) })
  .catch((err) => {
    console.error('\n❌ PUBLISH XATOSI:', err instanceof Error ? err.message : err)
    console.error('   Marker yozilMADI — avvalgi versiya xizmatda qoladi (atomik publish).')
    process.exit(1)
  })
