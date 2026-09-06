import 'dotenv/config'
import { executeRows } from '../server/db/connection'
import { sql } from 'drizzle-orm'
import fs from 'node:fs'
import path from 'node:path'

async function backup() {
  console.log('Connecting to Neon to backup old physics data...')
  const oldQuestions = await executeRows(sql`
    SELECT * FROM questions
    WHERE bank_id = 'physics_db' AND NOT (external_id LIKE 'ftp-%')
    ORDER BY id
  `)
  const newTopics = await executeRows(sql`
    SELECT id, name_uz, slug FROM topics
    WHERE bank_id = 'physics_db' AND slug LIKE 'physics_db-ftp-%'
  `)
  const oldTopics = await executeRows(sql`
    SELECT * FROM topics
    WHERE bank_id = 'physics_db' AND NOT (slug LIKE 'physics_db-ftp-%')
    ORDER BY id
  `)
  console.log(`New topics: ${newTopics.length}, Old topics: ${oldTopics.length}`)
  console.log(`Old questions: ${oldQuestions.length}`)

  const outPath = path.resolve(process.cwd(), 'content-banks/fizika/old-physics-backup-2478.json')
  fs.writeFileSync(
    outPath,
    JSON.stringify({ exportedAt: new Date().toISOString(), topics: oldTopics, questions: oldQuestions }, null, 2),
    'utf8'
  )
  console.log(`✅ Backup successfully saved to ${outPath}`)
}

backup().then(() => process.exit(0)).catch((e) => {
  console.error('Backup error:', e)
  process.exit(1)
})
