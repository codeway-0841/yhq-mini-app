/**
 * KIVVI statik media fayllarini (`public/brilliant`, `darslik-map`, `images/signs`,
 * `images/authors`, `images/onboarding`, `badges`, `leagues`, `lessons`, `pdfjs`,
 * `fan-*.webp`) Cloudflare R2 (`kivvi-library` / `CLOUDFLARE_R2_BUCKET`) ga yuklaydi.
 *
 * Skript S3 SigV4 imzosini `node:crypto` bilan yaratadi (qo'shimcha paket kerak emas)
 * va mavjud obyektlarning hajmini `HEAD` orqali tekshirib, o'zgarmaganlarini o'tkazib yuboradi.
 *
 * Ishlatish:
 *   node scripts/upload-media-to-r2.mjs [--dry-run] [--force] [--set-cors]
 */

import { createHash, createHmac } from 'node:crypto'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const PUBLIC_DIR = path.join(ROOT, 'public')

for (const envName of ['.env', '.env.r2']) {
  const envFile = path.join(ROOT, envName)
  if (!existsSync(envFile)) continue
  for (const line of readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith('#')) continue
    const match = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/)
    if (!match) continue
    const [, key, rawValue] = match
    if (process.env[key] === undefined) {
      process.env[key] = rawValue.replace(/^(['"])(.*)\1$/, '$2')
    }
  }
}

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID || process.env.CLOUDFLARE_ACCOUNT_ID
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || process.env.CLOUDFLARE_R2_ACCESS_KEY_ID
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY
const R2_BUCKET = process.env.R2_BUCKET || process.env.CLOUDFLARE_R2_BUCKET
const CONCURRENCY = Math.max(1, Number(process.env.R2_CONCURRENCY || '8'))
const DRY_RUN = process.argv.includes('--dry-run')
const FORCE = process.argv.includes('--force') || process.env.R2_FORCE === '1'

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

function signedHeaders(method, objectKey, payloadHash, now = new Date(), canonicalQuery = '') {
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '')
  const dateStamp = amzDate.slice(0, 8)
  const canonicalUri = objectKey === ''
    ? `/${R2_BUCKET}`
    : '/' + [R2_BUCKET, ...objectKey.split('/')].map((seg) => encodeURIComponent(seg)).join('/')

  const canonicalHeaders =
    `host:${HOST}\n` +
    `x-amz-content-sha256:${payloadHash}\n` +
    `x-amz-date:${amzDate}\n`
  const signedHeaderNames = 'host;x-amz-content-sha256;x-amz-date'
  const canonicalRequest = [method, canonicalUri, canonicalQuery, canonicalHeaders, signedHeaderNames, payloadHash].join('\n')
  const scope = `${dateStamp}/${REGION}/${SERVICE}/aws4_request`
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256hex(canonicalRequest)].join('\n')
  const kDate = hmac(`AWS4${R2_SECRET_ACCESS_KEY}`, dateStamp)
  const kRegion = hmac(kDate, REGION)
  const kService = hmac(kRegion, SERVICE)
  const kSigning = hmac(kService, 'aws4_request')
  const signature = hmac(kSigning, stringToSign).toString('hex')

  return {
    host: HOST,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amzDate,
    authorization: `AWS4-HMAC-SHA256 Credential=${R2_ACCESS_KEY_ID}/${scope}, SignedHeaders=${signedHeaderNames}, Signature=${signature}`,
  }
}

const MIME_BY_EXT = {
  '.riv': 'application/octet-stream',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg',
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.wasm': 'application/wasm',
  '.bcmap': 'application/octet-stream',
  '.pfb': 'application/octet-stream',
  '.properties': 'text/plain; charset=utf-8',
}

function contentTypeOf(filePath) {
  return MIME_BY_EXT[path.extname(filePath).toLowerCase()] || 'application/octet-stream'
}

function cacheControlOf(objectKey) {
  if (objectKey.endsWith('.html')) return 'public, max-age=3600, stale-while-revalidate=86400'
  if (objectKey.endsWith('.riv') || objectKey.startsWith('badges/') || objectKey.startsWith('brilliant/')) {
    return 'public, max-age=31536000, immutable'
  }
  return 'public, max-age=604800, stale-while-revalidate=2592000'
}

function walkFiles(dir, out = []) {
  if (!existsSync(dir)) return out
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walkFiles(full, out)
    else out.push(full)
  }
  return out
}

function collectMediaFiles() {
  const dirs = [
    'brilliant',
    'darslik-map',
    'images/signs',
    'images/authors',
    'images/onboarding',
    'badges',
    'leagues',
    'lessons',
    'pdfjs',
  ]
  const files = []
  for (const relDir of dirs) {
    for (const full of walkFiles(path.join(PUBLIC_DIR, relDir))) {
      files.push(full)
    }
  }
  for (const entry of readdirSync(PUBLIC_DIR, { withFileTypes: true })) {
    if (entry.isFile() && /^fan-.*\.webp$/.test(entry.name)) {
      files.push(path.join(PUBLIC_DIR, entry.name))
    }
  }
  return files.map((full) => ({
    full,
    key: path.relative(PUBLIC_DIR, full).split(path.sep).join('/'),
    size: statSync(full).size,
  }))
}

async function headSize(objectKey) {
  const res = await fetch(`${ENDPOINT}/${R2_BUCKET}/${objectKey.split('/').map(encodeURIComponent).join('/')}`, {
    method: 'HEAD',
    headers: signedHeaders('HEAD', objectKey, sha256hex('')),
  })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`HEAD ${objectKey} → ${res.status}`)
  const len = Number(res.headers.get('content-length'))
  return Number.isFinite(len) ? len : -1
}

async function putObject(objectKey, filePath) {
  const body = await readFile(filePath)
  const payloadHash = sha256hex(body)
  const res = await fetch(`${ENDPOINT}/${R2_BUCKET}/${objectKey.split('/').map(encodeURIComponent).join('/')}`, {
    method: 'PUT',
    headers: {
      ...signedHeaders('PUT', objectKey, payloadHash),
      'content-type': contentTypeOf(filePath),
      'cache-control': cacheControlOf(objectKey),
      'content-length': String(body.byteLength),
    },
    body,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`PUT ${objectKey} → ${res.status} ${text.slice(0, 160)}`)
  }
}

async function main() {
  if (process.argv.includes('--set-cors')) {
    const origins = ['https://localhost', 'https://app.kivvi.uz', 'https://kivvi.uz', 'https://www.kivvi.uz', 'http://localhost:5173']
    const xml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<CORSConfiguration>',
      '  <CORSRule>',
      ...origins.map((o) => `    <AllowedOrigin>${o}</AllowedOrigin>`),
      '    <AllowedMethod>GET</AllowedMethod>',
      '    <AllowedMethod>HEAD</AllowedMethod>',
      '    <AllowedHeader>*</AllowedHeader>',
      '    <ExposeHeader>Content-Length</ExposeHeader>',
      '    <ExposeHeader>ETag</ExposeHeader>',
      '    <MaxAgeSeconds>86400</MaxAgeSeconds>',
      '  </CORSRule>',
      '</CORSConfiguration>',
      '',
    ].join('\n')
    const body = Buffer.from(xml)
    const res = await fetch(`${ENDPOINT}/${R2_BUCKET}?cors`, {
      method: 'PUT',
      headers: {
        ...signedHeaders('PUT', '', sha256hex(body), new Date(), 'cors='),
        'content-type': 'application/xml',
        'content-md5': createHash('md5').update(body).digest('base64'),
      },
      body,
    })
    if (!res.ok) {
      console.error(`CORS xatosi (${res.status}): Cloudflare Dashboard → R2 → ${R2_BUCKET} → Settings → CORS Policy orqali qo'shing.`)
      process.exit(1)
    }
    console.log('✓ CORS muvaffaqiyatli o‘rnatildi.')
    return
  }

  const list = collectMediaFiles()
  const totalBytes = list.reduce((s, f) => s + f.size, 0)
  console.log(`R2 bucket: ${R2_BUCKET} | Jami media: ${list.length} fayl (${(totalBytes / 1e6).toFixed(2)} MB)`)

  if (DRY_RUN) {
    console.log('Dry-run yakunlandi (yuklanmadi).')
    return
  }

  let idx = 0
  let uploaded = 0
  let skipped = 0
  let uploadedBytes = 0

  async function worker() {
    while (idx < list.length) {
      const item = list[idx++]
      if (!FORCE) {
        const remoteSize = await headSize(item.key)
        if (remoteSize === item.size) {
          skipped++
          continue
        }
      }
      await putObject(item.key, item.full)
      uploaded++
      uploadedBytes += item.size
      if ((uploaded + skipped) % 50 === 0) {
        console.log(`Progress: ${uploaded + skipped}/${list.length} (yuklandi: ${uploaded}, o'tkazildi: ${skipped})`)
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()))
  console.log(`✓ Yakunlandi: ${uploaded} yuklandi (${(uploadedBytes / 1e6).toFixed(2)} MB), ${skipped} o'tkazildi (R2 da bor).`)
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
