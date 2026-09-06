import 'dotenv/config'
import { executeRows } from '../server/db/connection'
import { sql } from 'drizzle-orm'

async function run() {
  console.log('Connecting to Neon DB...')
  try {
    const banks = await executeRows(sql`SELECT id, name, created_at FROM question_banks ORDER BY id`)
    console.log('\n--- QUESTION BANKS ---')
    console.table(banks)

    const questionCounts = await executeRows(sql`
      SELECT bank_id, COUNT(*)::int AS questions_count
      FROM questions
      GROUP BY bank_id
      ORDER BY bank_id
    `)
    console.log('\n--- QUESTIONS COUNT BY BANK ---')
    console.table(questionCounts)

    const topicCounts = await executeRows(sql`
      SELECT bank_id, COUNT(*)::int AS topics_count
      FROM topics
      GROUP BY bank_id
      ORDER BY bank_id
    `)
    console.log('\n--- TOPICS COUNT BY BANK ---')
    console.table(topicCounts)

    const totalQuestions = await executeRows(sql`SELECT COUNT(*)::int AS total FROM questions`)
    console.log('\n--- TOTAL QUESTIONS IN DB ---')
    console.log('Total:', totalQuestions[0]?.total)

    console.log('\n--- PHYSICS DB BREAKDOWN ---')
    const idTypes = await executeRows(sql`
      SELECT
        CASE
          WHEN external_id LIKE 'ftp-%' THEN 'ftp-* (Fizika Test Print)'
          WHEN external_id ~ '^[0-9]+$' THEN 'numeric id'
          ELSE substring(external_id from 1 for 15)
        END AS id_type,
        COUNT(*)::int AS count,
        MIN(id)::int AS min_id,
        MAX(id)::int AS max_id
      FROM questions
      WHERE bank_id = 'physics_db'
      GROUP BY 1
      ORDER BY count DESC
    `)
    console.table(idTypes)

    const topicSamples = await executeRows(sql`
      SELECT
        CASE
          WHEN slug LIKE 'ftp-%' THEN 'ftp-* (Fizika Test Print)'
          ELSE 'other: ' || substring(slug from 1 for 20)
        END AS topic_type,
        COUNT(*)::int AS count,
        MIN(id)::int AS min_id,
        MAX(id)::int AS max_id
      FROM topics
      WHERE bank_id = 'physics_db'
      GROUP BY 1
      ORDER BY count DESC
    `)
    console.log('\n--- PHYSICS TOPICS BREAKDOWN ---')
    console.table(topicSamples)

    // Check if 8,880 ftp questions exist alongside something else:
    const ftpCount = await executeRows(sql`
      SELECT COUNT(*)::int as ftp_count
      FROM questions
      WHERE bank_id = 'physics_db' AND external_id LIKE 'ftp-%'
    `)
    console.log('ftp-* questions count:', ftpCount[0]?.ftp_count)

    const nonFtpCount = await executeRows(sql`
      SELECT COUNT(*)::int as non_ftp_count
      FROM questions
      WHERE bank_id = 'physics_db' AND NOT (external_id LIKE 'ftp-%')
    `)
    console.log('non-ftp questions count:', nonFtpCount[0]?.non_ftp_count)

    const nonFtpSamples = await executeRows(sql`
      SELECT id, external_id, substring(question_uz from 1 for 60) as sample_text, topic_id
      FROM questions
      WHERE bank_id = 'physics_db' AND NOT (external_id LIKE 'ftp-%')
      LIMIT 10
    `)
    console.log('\n--- NON-FTP SAMPLE QUESTIONS ---')
    console.table(nonFtpSamples)

    console.log('\n--- CHECKING REFERENCES TO NON-FTP QUESTIONS ---')
    const progressCount = await executeRows(sql`
      SELECT COUNT(*)::int as count
      FROM progress_questions pq
      JOIN questions q ON q.id = pq.question_id
      WHERE q.bank_id = 'physics_db' AND NOT (q.external_id LIKE 'ftp-%')
    `)
    console.log('Progress questions referencing old non-ftp questions:', progressCount[0]?.count)

    const savedCount = await executeRows(sql`
      SELECT COUNT(*)::int as count
      FROM saved_questions sq
      JOIN questions q ON q.id = sq.question_id
      WHERE q.bank_id = 'physics_db' AND NOT (q.external_id LIKE 'ftp-%')
    `)
    console.log('Saved questions referencing old non-ftp questions:', savedCount[0]?.count)

    const explanationsCount = await executeRows(sql`
      SELECT COUNT(*)::int as count
      FROM question_explanations qe
      JOIN questions q ON q.id = qe.question_id
      WHERE q.bank_id = 'physics_db' AND NOT (q.external_id LIKE 'ftp-%')
    `)
    console.log('Question explanations referencing old non-ftp questions:', explanationsCount[0]?.count)

    const idRange = await executeRows(sql`
      SELECT
        CASE WHEN external_id LIKE 'ftp-%' THEN 'ftp' ELSE 'non-ftp' END as type,
        MIN(id)::int as min_id,
        MAX(id)::int as max_id,
        COUNT(*)::int as count
      FROM questions
      WHERE bank_id = 'physics_db'
      GROUP BY 1
    `)
    console.table(idRange)

  } catch (err: any) {
    console.error('Database query failed:', err.message || err)
  }
}

run().then(() => process.exit(0)).catch((e) => {
  console.error(e)
  process.exit(1)
})
