import 'dotenv/config';
import { executeRows } from '../server/db/connection';
import { sql } from 'drizzle-orm';

async function main() {
  const rows = await executeRows<{ bank_id: string; correct_answer: string; count: number }>(sql`
    SELECT bank_id, correct_answer, COUNT(*)::int AS count
    FROM questions
    WHERE bank_id IN ('biology_db', 'history_db', 'chemistry_db', 'geography_db', 'onatili_db', 'adabiyot_db')
    GROUP BY bank_id, correct_answer
    ORDER BY bank_id, correct_answer
  `);

  console.log('\n--- Neon DB correct_answer taqsimoti ---');
  const table: Record<string, Record<string, number>> = {};
  for (const r of rows) {
    if (!table[r.bank_id]) table[r.bank_id] = {};
    table[r.bank_id][r.correct_answer] = r.count;
  }
  console.table(table);
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
