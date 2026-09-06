import 'dotenv/config'
import { executeRows } from '../server/db/connection'
import { sql } from 'drizzle-orm'
import fs from 'node:fs'
import path from 'node:path'

async function cleanup() {
  console.log('=== NEON DB: CLEANING UP OLD PHYSICS DATA ===\n')

  // 1. Verify backup exists
  const backupPath = path.resolve(process.cwd(), 'content-banks/fizika/old-physics-backup-2478.json')
  if (!fs.existsSync(backupPath)) {
    throw new Error(`CRITICAL: Backup file not found at ${backupPath}! Aborting.`)
  }
  const backupData = JSON.parse(fs.readFileSync(backupPath, 'utf8'))
  if (backupData.questions?.length !== 2478 || backupData.topics?.length !== 101) {
    throw new Error(`CRITICAL: Backup verification failed! Expected 2478 questions and 101 topics.`)
  }
  console.log(`✅ Pre-check: Backup verified (${backupData.questions.length} questions, ${backupData.topics.length} topics).`)

  // 2. Check current state in DB
  const beforeQuestions = await executeRows(sql`
    SELECT COUNT(*)::int as total,
           COUNT(*) FILTER (WHERE external_id LIKE 'ftp-%')::int as ftp_count,
           COUNT(*) FILTER (WHERE NOT (external_id LIKE 'ftp-%'))::int as old_count
    FROM questions
    WHERE bank_id = 'physics_db'
  `)
  console.log('Before cleanup questions in DB:', beforeQuestions[0])

  const beforeTopics = await executeRows(sql`
    SELECT COUNT(*)::int as total,
           COUNT(*) FILTER (WHERE slug LIKE 'physics_db-ftp-%')::int as ftp_count,
           COUNT(*) FILTER (WHERE NOT (slug LIKE 'physics_db-ftp-%'))::int as old_count
    FROM topics
    WHERE bank_id = 'physics_db'
  `)
  console.log('Before cleanup topics in DB:', beforeTopics[0])

  if (beforeQuestions[0]?.ftp_count !== 8880 || beforeTopics[0]?.ftp_count !== 296) {
    throw new Error(`CRITICAL: New FTP questions count is not 8880 or topics count is not 296! Aborting.`)
  }

  // 3. Perform cleanup
  console.log('\nCleaning up old non-ftp questions...')
  const delQuestions = await executeRows(sql`
    DELETE FROM questions
    WHERE bank_id = 'physics_db' AND NOT (external_id LIKE 'ftp-%')
    RETURNING id
  `)
  console.log(`Deleted ${delQuestions.length} old questions from questions table.`)

  console.log('Cleaning up old non-ftp topics...')
  const delTopics = await executeRows(sql`
    DELETE FROM topics
    WHERE bank_id = 'physics_db' AND NOT (slug LIKE 'physics_db-ftp-%')
    RETURNING id
  `)
  console.log(`Deleted ${delTopics.length} old topics from topics table.`)

  // 4. Verify post-cleanup state in DB
  const afterQuestions = await executeRows(sql`
    SELECT COUNT(*)::int as total,
           COUNT(*) FILTER (WHERE external_id LIKE 'ftp-%')::int as ftp_count
    FROM questions
    WHERE bank_id = 'physics_db'
  `)
  console.log('\nAfter cleanup questions in DB:', afterQuestions[0])

  const afterTopics = await executeRows(sql`
    SELECT COUNT(*)::int as total,
           COUNT(*) FILTER (WHERE slug LIKE 'physics_db-ftp-%')::int as ftp_count
    FROM topics
    WHERE bank_id = 'physics_db'
  `)
  console.log('After cleanup topics in DB:', afterTopics[0])

  const grandTotal = await executeRows(sql`SELECT COUNT(*)::int as total FROM questions`)
  console.log('\nTotal questions across ALL banks in Neon DB:', grandTotal[0]?.total)

  if (afterQuestions[0]?.total === 8880 && afterTopics[0]?.total === 296) {
    console.log('\n🎉 SUCCESS! physics_db is now clean with EXACTLY 8,880 questions and 296 topics!')
  } else {
    console.error('\n⚠️ WARNING: Post-cleanup count mismatch!')
  }
}

cleanup().then(() => process.exit(0)).catch((err) => {
  console.error('Cleanup failed:', err)
  process.exit(1)
})
