// scripts/download-course-covers.mjs
import fs from 'node:fs'
import path from 'node:path'

const coursesPath = path.resolve('src/features/wonder-studio/data/scraped-courses.json')
const courses = JSON.parse(fs.readFileSync(coursesPath, 'utf-8'))
const targetDir = path.resolve('public/courses/covers')

if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true })
}

async function downloadImages() {
  console.log(`Downloading ${courses.length} course covers to ${targetDir}...`)

  for (const c of courses) {
    if (!c.coverImage) continue
    const ext = path.extname(new URL(c.coverImage).pathname) || '.png'
    const filename = `${c.id}${ext}`
    const filepath = path.join(targetDir, filename)

    try {
      console.log(`Downloading cover for: ${c.title}...`)
      const res = await fetch(c.coverImage)
      if (!res.ok) {
        console.warn(`Failed (${res.status}) for ${c.title}`)
        continue
      }
      const buffer = await res.arrayBuffer()
      fs.writeFileSync(filepath, Buffer.from(buffer))
      c.localCoverImage = `/courses/covers/${filename}`
      console.log(`Saved ${filename} (${(buffer.byteLength / 1024).toFixed(1)} KB)`)
    } catch (err) {
      console.error(`Error downloading ${c.coverImage}:`, err.message)
    }
  }

  fs.writeFileSync(coursesPath, JSON.stringify(courses, null, 2), 'utf-8')
  console.log(`Updated scraped-courses.json with local cover paths!`)
}

downloadImages()
