/**
 * Asset Migration Script — Uploads local assets (badges, covers, test images) to Cloudflare R2
 *
 * Usage:
 *   npx tsx scripts/migrate-assets-to-r2.ts [--dry-run] [--upload]
 */

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { R2StorageProvider } from '../server/modules/storage/r2-client'
import { validateImageBuffer } from '../server/modules/storage/image-validator'
import { processImage } from '../server/modules/storage/image-processor'
import type { ImageType } from '../server/modules/storage/storage.types'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

// Load .env or .env.r2 if present
for (const envName of ['.env.r2', '.env.local', '.env']) {
  const envPath = path.join(ROOT, envName)
  if (existsSync(envPath)) {
    for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
      if (line.trim().startsWith('#')) continue
      const match = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/)
      if (!match) continue
      const [, key, rawValue] = match
      if (process.env[key] === undefined) {
        process.env[key] = rawValue.replace(/^(['"])(.*)\1$/, '$2')
      }
    }
  }
}

const {
  CLOUDFLARE_ACCOUNT_ID,
  CLOUDFLARE_R2_ACCESS_KEY_ID,
  CLOUDFLARE_R2_SECRET_ACCESS_KEY,
  CLOUDFLARE_R2_BUCKET,
  CLOUDFLARE_PUBLIC_URL,
} = process.env

const isUpload = process.argv.includes('--upload')

const SCAN_DIRS: { dir: string; type: ImageType; name: string }[] = [
  { dir: path.join(ROOT, 'public', 'badges'), type: 'badge', name: 'Badges' },
  { dir: path.join(ROOT, 'public', 'courses', 'covers'), type: 'book_cover', name: 'Course Covers' },
  { dir: path.join(ROOT, 'public', 'images'), type: 'test_image', name: 'Test Images' },
]

async function main() {
  console.log('=== Cloudflare R2 Asset Migration Tool ===\n')

  let provider: R2StorageProvider | null = null
  if (isUpload) {
    if (!CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_R2_ACCESS_KEY_ID || !CLOUDFLARE_R2_SECRET_ACCESS_KEY || !CLOUDFLARE_R2_BUCKET) {
      console.error('Error: Cloudflare R2 credentials missing in environment (.env or .env.r2).')
      process.exit(1)
    }
    provider = new R2StorageProvider({
      accountId: CLOUDFLARE_ACCOUNT_ID,
      accessKeyId: CLOUDFLARE_R2_ACCESS_KEY_ID,
      secretAccessKey: CLOUDFLARE_R2_SECRET_ACCESS_KEY,
      bucket: CLOUDFLARE_R2_BUCKET,
      publicUrl: CLOUDFLARE_PUBLIC_URL,
    })
    console.log(`Connected to R2 Bucket: ${CLOUDFLARE_R2_BUCKET}\n`)
  } else {
    console.log('Running in DRY-RUN mode. (Pass --upload to actually upload to Cloudflare R2)\n')
  }

  const manifest: Record<string, { hash: string; type: string; key: string; publicUrl: string; variants: any }> = {}
  let totalScanned = 0
  let totalProcessed = 0
  let totalErrors = 0

  for (const { dir, type, name } of SCAN_DIRS) {
    if (!existsSync(dir)) {
      console.log(`Directory not found: ${dir} (Skipping)`)
      continue
    }

    const files = readdirSync(dir).filter((f) => /\.(png|jpe?g|webp)$/i.test(f))
    console.log(`Scanning ${name} (${files.length} files in ${path.relative(ROOT, dir)})...`)

    for (const file of files) {
      totalScanned++
      const filePath = path.join(dir, file)
      const relPath = path.relative(ROOT, filePath).replace(/\\/g, '/')

      try {
        const buffer = readFileSync(filePath)
        const validation = await validateImageBuffer(buffer, undefined, { type })
        if (!validation.valid) {
          console.warn(`  [SKIP] ${relPath}: ${validation.error}`)
          totalErrors++
          continue
        }

        const resolver = (key: string) => provider?.getPublicUrl(key) || `https://cdn.kivvi.uz/${key}`
        const processed = await processImage(buffer, type, resolver)

        manifest[relPath] = {
          hash: processed.hash,
          type: processed.type,
          key: processed.key,
          publicUrl: processed.publicUrl,
          variants: processed.variants,
        }

        if (provider) {
          for (const [key, variantBuffer] of processed.bufferMap.entries()) {
            await provider.uploadObject(key, variantBuffer, 'image/webp', 'public, max-age=31536000, immutable')
          }
          console.log(`  ✓ [UPLOADED] ${relPath} -> ${processed.publicUrl}`)
        } else {
          console.log(`  ✓ [VALID] ${relPath} (hash: ${processed.hash.slice(0, 12)}...)`)
        }

        totalProcessed++
      } catch (err: any) {
        console.error(`  ✗ [ERROR] ${relPath}: ${err.message}`)
        totalErrors++
      }
    }
  }

  const manifestPath = path.join(ROOT, 'storage-migration-manifest.json')
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8')
  console.log(`\nManifest saved to ${manifestPath}`)

  console.log('\n==========================================')
  console.log(`Total scanned:   ${totalScanned}`)
  console.log(`Total processed: ${totalProcessed}`)
  console.log(`Total errors:    ${totalErrors}`)
  console.log('==========================================')
}

main().catch((err) => {
  console.error('Migration failed:', err)
  process.exit(1)
})
