/**
 * Yuklab olingan darsliklarni Cloudflare R2'ga yuklash skripti.
 *
 * Ishlatish:
 *   node scripts/upload-darsliklar-to-r2.mjs [sourceDir] [prefix] [--force] [--status]
 *
 * Misol:
 *   node scripts/upload-darsliklar-to-r2.mjs "C:\\Users\\PC\\Downloads\\Darsliklar" darsliklar
 */

import { createHash, createHmac } from 'node:crypto'
import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ENV_FILE = path.join(ROOT, '.env.r2')

if (existsSync(ENV_FILE)) {
  for (const line of readFileSync(ENV_FILE, 'utf8').split(/\r?\n/)) {
    if (line.trim().startsWith('#')) continue
    const match = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/)
    if (!match) continue
    const [, key, rawValue] = match
    if (process.env[key] === undefined) process.env[key] = rawValue.replace(/^(['"])(.*)\1$/, '$2')
  }
}

const {
  R2_ACCOUNT_ID,
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  R2_BUCKET = 'kivvi-library',
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
    console.error(`Env yetishmayapti: ${name} (.env.r2 faylini tekshiring)`)
    process.exit(1)
  }
}

const HOST = `${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
const ENDPOINT = `https://${HOST}`
const REGION = 'auto'
const SERVICE = 's3'

const sha256hex = (data) => createHash('sha256').update(data).digest('hex')
const hmac = (key, data) => createHmac('sha256', key).update(data).digest()

function signedHeaders(method, objectKey, payloadHash, now = new Date(), canonicalQuery = '') {
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '')
  const dateStamp = amzDate.slice(0, 8)
  const canonicalUri = objectKey === ''
    ? `/${R2_BUCKET}`
    : '/' + [R2_BUCKET, ...objectKey.split('/')].map(encodeURIComponent).join('/')

  const canonicalHeaders =
    `host:${HOST}\n` +
    `x-amz-content-sha256:${payloadHash}\n` +
    `x-amz-date:${amzDate}\n`
  const signedHeaderNames = 'host;x-amz-content-sha256;x-amz-date'

  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQuery,
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

async function withRetry(label, fn, attempts = 4) {
  let lastError
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      if (i < attempts) await new Promise((resolve) => setTimeout(resolve, i * 2000))
    }
  }
  throw new Error(`${label}: ${lastError.message}`)
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
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

function collectPdfFiles(dir) {
  const result = []
  const entries = readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      result.push(...collectPdfFiles(full))
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.pdf')) {
      result.push(full)
    }
  }
  return result
}

async function main() {
  const args = process.argv.slice(2).filter((a) => !a.startsWith('--'))
  const isStatus = process.argv.includes('--status')
  const isForce = process.argv.includes('--force') || R2_FORCE === '1'

  const sourceDir = args[0] || path.join(process.env.USERPROFILE || 'C:\\Users\\PC', 'Downloads', 'Darsliklar')
  const rawPrefix = args[1] || 'darsliklar'
  const prefix = rawPrefix.replace(/^\/+/g, '').replace(/\/+$/g, '')

  if (!existsSync(sourceDir)) {
    console.error(`Manba papka topilmadi: ${sourceDir}`)
    process.exit(1)
  }

  const pdfFiles = collectPdfFiles(sourceDir)
  if (pdfFiles.length === 0) {
    console.error(`Papka ichida PDF fayllar topilmadi: ${sourceDir}`)
    process.exit(1)
  }

  const jobs = pdfFiles.map((f) => {
    const rel = path.relative(sourceDir, f).replace(/\\/g, '/')
    const key = prefix ? `${prefix}/${rel}` : rel
    return { filePath: f, key, rel, size: statSync(f).size }
  })

  const totalBytes = jobs.reduce((acc, j) => acc + j.size, 0)
  console.log(`=== Cloudflare R2 yuklash ===`)
  console.log(`Bucket:     ${R2_BUCKET}`)
  console.log(`Prefix:     ${prefix}`)
  console.log(`Manba:      ${sourceDir}`)
  console.log(`Fayllar:    ${jobs.length} ta (${human(totalBytes)})\n`)

  if (isStatus) {
    console.log(`R2 tekshirilmoqda...`)
    let existsCount = 0
    let missingCount = 0
    let cursor = 0
    async function checkWorker() {
      while (cursor < jobs.length) {
        const job = jobs[cursor++]
        try {
          const exists = await objectExists(job.key)
          if (exists) existsCount++
          else missingCount++
        } catch (err) {
          missingCount++
        }
      }
    }
    await Promise.all(Array.from({ length: 8 }, checkWorker))
    console.log(`R2'da mavjud: ${existsCount}/${jobs.length}`)
    console.log(`R2'da yo'q:   ${missingCount}/${jobs.length}`)
    return
  }

  const concurrency = Math.max(1, Number(R2_CONCURRENCY) || 4)
  let cursor = 0
  let uploaded = 0
  let skipped = 0
  let failed = 0
  const startedAt = Date.now()

  async function worker(workerId) {
    while (cursor < jobs.length) {
      const index = cursor++
      const job = jobs[index]
      const label = `[${index + 1}/${jobs.length}] ${job.rel}`

      try {
        if (!isForce) {
          const exists = await withRetry(job.key, () => objectExists(job.key))
          if (exists) {
            skipped++
            console.log(`~ ${label} (mavjud, o'tkazib yuborildi)`)
            continue
          }
        }
        console.log(`-> ${label} (${human(job.size)})...`)
        await withRetry(job.key, () => uploadObject(job.key, job.filePath))
        uploaded++
        console.log(`✓  ${label}`)
      } catch (err) {
        failed++
        console.error(`✗  ${label} XATO: ${err.message}`)
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, (_, i) => worker(i + 1)))

  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(0)
  console.log(`\n========================================`)
  console.log(`=== YAKUNLANDI: R2 yuklash tugadi ===`)
  console.log(`========================================`)
  console.log(`Vaqt:        ${elapsed}s`)
  console.log(`Yuklandi:    ${uploaded}`)
  console.log(`O'tkazildi:  ${skipped}`)
  console.log(`Xatoliklar:  ${failed}`)
  console.log(`Public URL:  https://pub-959db3d04308444d93ae4013d976e0ec.r2.dev/${prefix}/`)
}

main().catch(console.error)
