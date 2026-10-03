import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'

const YHQ_DIR = path.resolve('public/images/yhq')

async function main() {
  const files = fs.readdirSync(YHQ_DIR).filter(f => f.endsWith('.webp'))
  console.log(`Starting recompression of ${files.length} YHQ images in ${YHQ_DIR}...`)

  let totalOrig = 0
  let totalNew = 0
  let processed = 0
  let smallerCount = 0

  for (const file of files) {
    const filePath = path.join(YHQ_DIR, file)
    const inputBuf = fs.readFileSync(filePath)
    const origSize = inputBuf.length
    totalOrig += origSize

    try {
      const meta = await sharp(inputBuf).metadata()
      let pipeline = sharp(inputBuf)
      if (meta.width && meta.width > 800) {
        pipeline = pipeline.resize({ width: 800, withoutEnlargement: true })
      }
      const newBuf = await pipeline.webp({ quality: 75, effort: 5 }).toBuffer()

      // Only save if smaller
      if (newBuf.length < origSize) {
        fs.writeFileSync(filePath, newBuf)
        totalNew += newBuf.length
        smallerCount++
      } else {
        totalNew += origSize
      }
    } catch (err) {
      console.warn(`Failed on ${file}:`, err.message)
      totalNew += origSize
    }

    processed++
    if (processed % 100 === 0 || processed === files.length) {
      console.log(`Progress: ${processed}/${files.length} images processed...`)
    }
  }

  const origMB = (totalOrig / (1024 * 1024)).toFixed(2)
  const newMB = (totalNew / (1024 * 1024)).toFixed(2)
  const savedMB = ((totalOrig - totalNew) / (1024 * 1024)).toFixed(2)

  console.log('--- RECOMPRESSION COMPLETE ---')
  console.log(`Total Original: ${origMB} MB`)
  console.log(`Total New:      ${newMB} MB`)
  console.log(`Saved:          ${savedMB} MB (${Math.round((1 - totalNew / totalOrig) * 100)}% reduction)`)
  console.log(`Smaller files:  ${smallerCount}/${files.length}`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
