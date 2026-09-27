import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'

const BADGES_DIR = path.resolve('public/badges')

async function convertBadges() {
  const files = fs.readdirSync(BADGES_DIR).filter((f) => f.endsWith('.png'))
  console.log(`Boshlandi: ${files.length} ta PNG nishonni WebP formatga o'tkazish...`)

  let totalPngBytes = 0
  let totalWebpBytes = 0

  for (const file of files) {
    const pngPath = path.join(BADGES_DIR, file)
    const webpName = file.replace(/\.png$/, '.webp')
    const webpPath = path.join(BADGES_DIR, webpName)

    const pngStat = fs.statSync(pngPath)
    totalPngBytes += pngStat.size

    // Retina 512x512 sifat saqlangan holda WebP ga o'tkazish (quality 80, effort 6)
    await sharp(pngPath)
      .resize(512, 512, { fit: 'inside' })
      .webp({
        quality: 80,
        effort: 6,
      })
      .toFile(webpPath)

    const webpStat = fs.statSync(webpPath)
    totalWebpBytes += webpStat.size

    const savingsPct = ((1 - webpStat.size / pngStat.size) * 100).toFixed(1)
    console.log(
      `✓ ${file} (${(pngStat.size / 1024).toFixed(0)} KB) → ${webpName} (${(webpStat.size / 1024).toFixed(0)} KB) [tejaldi: ${savingsPct}%]`
    )
  }

  console.log('\n────────────────────────────────────────────────')
  console.log(`Jami PNG hajmi:  ${(totalPngBytes / 1024 / 1024).toFixed(2)} MB`)
  console.log(`Jami WebP hajmi: ${(totalWebpBytes / 1024 / 1024).toFixed(2)} MB`)
  console.log(`Umumiy tejalgan: ${((1 - totalWebpBytes / totalPngBytes) * 100).toFixed(1)}% (juda tez yuklanadi!)`)
  console.log('────────────────────────────────────────────────')
}

convertBadges().catch((err) => {
  console.error('Xatolik:', err)
  process.exit(1)
})
