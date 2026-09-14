/**
 * Kutubxona PDF'larini Cloudflare R2'ga (yoki S3-mos storage'ga) yuklash.
 *
 * Nima uchun: PDF'lar jami ~3GB — repo/Vercel/Neon'ga sig'maydi. Ilova ularni
 * `VITE_LIBRARY_PDF_BASE_URL` + `book.file` orqali ochadi. Bu skript faqat BIR
 * MARTA (kontent yangilanganda) ishga tushiriladi.
 *
 * Env (R2 dashboard → Manage R2 API Tokens):
 *   R2_ACCOUNT_ID=...
 *   R2_ACCESS_KEY_ID=...
 *   R2_SECRET_ACCESS_KEY=...
 *   R2_BUCKET=kivvi-library
 *   R2_PREFIX=kutubxona/pdf          # ixtiyoriy (default shu)
 *   R2_CONCURRENCY=4                 # ixtiyoriy
 *   R2_FORCE=1                       # mavjud fayllarni ham qayta yuklash
 *
 * Ishlatish:
 *   node scripts/upload-library-to-r2.mjs
 *
 * Keyin Vercel/Render env'ga qo'ying (build-time, Vite):
 *   VITE_LIBRARY_PDF_BASE_URL=https://<public-domain>/kutubxona/pdf
 *
 * Skript S3 SigV4'ni `node:crypto` bilan o'zi imzolaydi — qo'shimcha paket kerak emas.
 */

import { createHash, createHmac } from 'node:crypto'
import { readFileSync, existsSync, statSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const LIBRARY_JSON = path.join(ROOT, 'src', 'content', 'library.json')
const SOURCE_DIR = path.join(ROOT, 'content-banks', 'testmakon', 'kutubxona')

const {
  R2_ACCOUNT_ID,
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  R2_BUCKET,
  R2_PREFIX = 'kutubxona/pdf',
  R2_CONCURRENCY = '4',
  R2_FORCE,
} = process.env

for (const [name, value] of Object.entries({
  R2_ACCOUNT_ID,
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  R2_BUCKET,
})) {
  if (!value) {
    console.error(`Env yetishmayapti: ${name}`)
    process.exit(1)
  }
}

const HOST = `${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
const ENDPOINT = `https://${HOST}`
const REGION = 'auto'
const SERVICE = 's3'

const sha256hex = (data) => createHash('sha256').update(data).digest('hex')
const hmac = (key, data) => createHmac('sha256', key).update(data).digest()

/** Bitta so'rov uchun SigV4 imzo header'lari (path-style: /<bucket>/<key>). */
function signedHeaders(method, objectKey, payloadHash, now = new Date()) {
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '')
  const dateStamp = amzDate.slice(0, 8)
  const canonicalUri = '/' + [R2_BUCKET, ...objectKey.split('/')]
    .map((seg) => encodeURIComponent(seg))
    .join('/')

  const canonicalHeaders =
    `host:${HOST}\n` +
    `x-amz-content-sha256:${payloadHash}\n` +
    `x-amz-date:${amzDate}\n`
  const signedHeaderNames = 'host;x-amz-content-sha256;x-amz-date'

  const canonicalRequest = [
    method,
    canonicalUri,
    '',
    canonicalHeaders,
    signedHeaderNames,
    payloadHash,
  ].join('\n')

  const scope = `${dateStamp}/${REGION}/${SERVICE}/aws4_request`
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    scope,
    sha256hex(canonicalRequest),
  ].join('\n')

  const kDate = hmac(`AWS4${R2_SECRET_ACCESS_KEY}`, dateStamp)
  const kRegion = hmac(kDate, REGION)
  const kService = hmac(kRegion, SERVICE)
  const kSigning = hmac(kService, 'aws4_request')
  const signature = createHmac('sha256', kSigning).update(stringToSign).digest('hex')

  return {
    host: HOST,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amzDate,
    authorization: `AWS4-HMAC-SHA256 Credential=${R2_ACCESS_KEY_ID}/${scope}, SignedHeaders=${signedHeaderNames}, Signature=${signature}`,
  }
}

/** R2'da obyekt bormi? (HEAD — mavjudini qayta yuklamaslik uchun) */
async function objectExists(objectKey) {
  const headers = signedHeaders('HEAD', objectKey, sha256hex(''))
  const res = await fetch(`${ENDPOINT}/${R2_BUCKET}/${objectKey.split('/').map(encodeURIComponent).join('/')}`, {
    method: 'HEAD',
    headers,
  })
  if (res.status === 200) return true
  if (res.status === 404) return false
  throw new Error(`HEAD ${objectKey} → ${res.status} ${res.statusText}`)
}

async function uploadObject(objectKey, filePath) {
  const body = await readFile(filePath)
  const payloadHash = sha256hex(body)
  const headers = {
    ...signedHeaders('PUT', objectKey, payloadHash),
    'content-type': 'application/pdf',
    'content-length': String(body.byteLength),
  }
  const res = await fetch(`${ENDPOINT}/${R2_BUCKET}/${objectKey.split('/').map(encodeURIComponent).join('/')}`, {
    method: 'PUT',
    headers,
    body,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`PUT ${objectKey} → ${res.status} ${res.statusText} ${text.slice(0, 200)}`)
  }
}

function human(bytes) {
  return bytes >= 1e9 ? `${(bytes / 1e9).toFixed(2)} GB` : `${(bytes / 1e6).toFixed(1)} MB`
}

async function main() {
  if (!existsSync(LIBRARY_JSON)) {
    console.error(`library.json topilmadi: ${LIBRARY_JSON} — avval python scripts/build-library-catalog.py`)
    process.exit(1)
  }

  const { books } = JSON.parse(readFileSync(LIBRARY_JSON, 'utf8'))
  const prefix = R2_PREFIX.replace(/^\/+|\/+$/g, '')
  const concurrency = Math.max(1, Number(R2_CONCURRENCY) || 4)

  const jobs = books.map((book) => ({
    key: `${prefix}/${book.file}`,
    filePath: path.join(SOURCE_DIR, book.file),
  }))

  const missing = jobs.filter((job) => !existsSync(job.filePath))
  if (missing.length > 0) {
    console.error(`Manba PDF topilmadi (${missing.length} ta):`)
    for (const job of missing.slice(0, 10)) console.error(`  - ${job.filePath}`)
    process.exit(1)
  }

  const totalBytes = jobs.reduce((sum, job) => sum + statSync(job.filePath).size, 0)
  console.log(`Kutubxona yuklanmoqda: ${jobs.length} ta PDF, ${human(totalBytes)}`)
  console.log(`Bucket: ${R2_BUCKET} | Prefix: ${prefix} | Concurrency: ${concurrency}\n`)

  let cursor = 0
  let uploaded = 0
  let skipped = 0
  let failed = 0
  const startedAt = Date.now()

  async function worker() {
    while (cursor < jobs.length) {
      const index = cursor++
      const job = jobs[index]
      const label = `[${index + 1}/${jobs.length}] ${job.key}`
      try {
        if (!R2_FORCE && await objectExists(job.key)) {
          skipped++
          console.log(`~ ${label} (mavjud, o'tkazib yuborildi)`)
          continue
        }
        await uploadObject(job.key, job.filePath)
        uploaded++
        console.log(`✓ ${label} (${human(statSync(job.filePath).size)})`)
      } catch (error) {
        failed++
        console.error(`✗ ${label}: ${error.message}`)
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, worker))

  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(0)
  console.log(`\nTugadi ${elapsed}s: yuklandi ${uploaded}, o'tkazildi ${skipped}, xato ${failed}`)
  if (failed > 0) process.exit(1)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
