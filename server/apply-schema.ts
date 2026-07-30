import 'dotenv/config'
import { neon } from '@neondatabase/serverless'

const sql = neon(process.env['DATABASE_URL']!)

await sql`CREATE TABLE IF NOT EXISTS questions (
  id integer PRIMARY KEY NOT NULL,
  question_uz text NOT NULL,
  question_ru text NOT NULL,
  options_uz jsonb NOT NULL,
  options_ru jsonb NOT NULL,
  correct_answer text NOT NULL,
  image text
)`
console.log('questions table ok')

await sql`CREATE TABLE IF NOT EXISTS topics (
  id serial PRIMARY KEY NOT NULL,
  name_uz text NOT NULL,
  name_ru text NOT NULL,
  slug text NOT NULL,
  CONSTRAINT topics_slug_unique UNIQUE(slug)
)`
console.log('topics table ok')

try {
  await sql`ALTER TABLE questions ADD COLUMN topic_id integer REFERENCES topics(id)`
  console.log('topic_id added')
} catch { console.log('topic_id: already exists, skip') }

try {
  await sql`ALTER TABLE saved_questions ADD CONSTRAINT sq_qfk FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE cascade`
  console.log('FK added')
} catch { console.log('FK: already exists, skip') }

console.log('Schema ready')
process.exit(0)
