import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { sql } from 'drizzle-orm';
import { executeRows } from '../server/db/connection';

const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const subjectIdx = args.indexOf('--subject');
const targetSubject = subjectIdx !== -1 ? args[subjectIdx + 1] : null;
const isAll = args.includes('--all');

const SUBJECT_LIST = [
  { folder: 'biologiya', bankId: 'biology_db', bankName: 'Biologiya savollar bazasi' },
  { folder: 'tarix', bankId: 'history_db', bankName: 'Tarix savollar bazasi' },
  { folder: 'kimyo', bankId: 'chemistry_db', bankName: 'Kimyo savollar bazasi' },
  { folder: 'geografiya', bankId: 'geography_db', bankName: 'Geografiya savollar bazasi' },
  { folder: 'onatili', bankId: 'onatili_db', bankName: 'Ona tili savollar bazasi' },
  { folder: 'adabiyot', bankId: 'adabiyot_db', bankName: 'Adabiyot savollar bazasi' },
  { folder: 'ingliz', bankId: 'english_db', bankName: 'Ingliz tili savollar bazasi' },
  { folder: 'rustili', bankId: 'russian_db', bankName: 'Rus tili savollar bazasi' },
];

const CHUNK_SIZE = 500;

interface BankTopic {
  externalId: string;
  nameUz: string;
  nameRu: string;
}

interface BankItem {
  externalId: string;
  topicExternalId: string;
  questionUz: string;
  questionRu: string;
  optionsUz: Record<string, string>;
  optionsRu: Record<string, string>;
  correctAnswer: string;
  explanationUz: string;
  explanationRu: string;
  source: string;
  image: string | null;
}

interface BankFile {
  version: number;
  subjectId: string;
  bankId: string;
  bankName: string;
  topics: BankTopic[];
  items: BankItem[];
}

export async function importBank(subjectFolder: string, txOrDb?: any) {
  const jsonPath = path.resolve(process.cwd(), 'content-banks', subjectFolder, 'bank.json');
  if (!fs.existsSync(jsonPath)) {
    throw new Error(`Bank fayli topilmadi: ${jsonPath}`);
  }

  const bank: BankFile = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const bankId = bank.bankId;
  const bankName = bank.bankName;

  console.log(`\n========================================`);
  console.log(`[Import: ${bank.subjectId}] ${bankName} (${bankId})`);
  console.log(`Kutilayotgan topics: ${bank.topics.length} ta, items: ${bank.items.length} ta`);

  // 1. question_banks qatori
  await executeRows(
    sql`
      INSERT INTO question_banks (id, name) VALUES (${bankId}, ${bankName})
      ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name
    `,
    txOrDb
  );

  // 2. Topics ni kiritish (slug = ${bankId}-${externalId})
  if (bankId === 'russian_db') {
    await executeRows(
      sql`UPDATE topics SET slug = ${bankId} || '-' || slug WHERE bank_id = ${bankId} AND slug NOT LIKE 'russian_db-%'`,
      txOrDb
    );
  }

  const topicRows = bank.topics.map((t) => ({
    ...t,
    slug: `${bankId}-${t.externalId}`,
  }));

  for (let i = 0; i < topicRows.length; i += CHUNK_SIZE) {
    const chunk = topicRows.slice(i, i + CHUNK_SIZE);
    const values = chunk.map(
      (t) => sql`(${t.nameUz}, ${t.nameRu}, ${t.slug}, ${bankId})`
    );
    await executeRows(
      sql`
        INSERT INTO topics (name_uz, name_ru, slug, bank_id)
        VALUES ${sql.join(values, sql`, `)}
        ON CONFLICT (slug) DO UPDATE SET
          name_uz = EXCLUDED.name_uz,
          name_ru = EXCLUDED.name_ru
      `,
      txOrDb
    );
  }

  // Mavzular ID xaritasini olish
  const dbTopics = await executeRows<{ id: number; slug: string }>(
    sql`SELECT id, slug FROM topics WHERE bank_id = ${bankId}`,
    txOrDb
  );
  const topicIdBySlug = new Map(dbTopics.map((t) => [t.slug, t.id]));
  const topicIdFor = (externalId: string): number => {
    const id = topicIdBySlug.get(`${bankId}-${externalId}`) ?? topicIdBySlug.get(externalId);
    if (id === undefined) throw new Error(`Topic topilmadi: ${externalId}`);
    return id;
  };

  // 3. Mavjud savollarning ID larini olish (idempotentlik uchun)
  const existingQuestions = await executeRows<{ id: number; external_id: string }>(
    sql`SELECT id, external_id FROM questions WHERE bank_id = ${bankId}`,
    txOrDb
  );
  const existingIdMap = new Map(existingQuestions.map((q) => [q.external_id, q.id]));

  const maxRow = await executeRows<{ max: number }>(
    sql`SELECT COALESCE(MAX(id), 0)::int AS max FROM questions`,
    txOrDb
  );
  let nextId = (maxRow[0]?.max ?? 0) + 1;

  console.log(`Mavjud savollar: ${existingIdMap.size} ta. Yangi ID boshlanishi: ${nextId}`);

  let affectedQuestions = 0;
  for (let start = 0; start < bank.items.length; start += CHUNK_SIZE) {
    const chunk = bank.items.slice(start, start + CHUNK_SIZE);
    const questionValues = chunk.map((it) => {
      const existingId = existingIdMap.get(it.externalId);
      const id = existingId !== undefined ? existingId : nextId++;
      return sql`(${id}, ${bankId}, ${it.externalId}, ${it.questionUz}, ${it.questionRu},
        ${JSON.stringify(it.optionsUz)}::jsonb, ${JSON.stringify(it.optionsRu)}::jsonb,
        ${it.correctAnswer}, ${it.image}, ${topicIdFor(it.topicExternalId)})`;
    });

    const insertedOrUpdated = await executeRows<{ id: number; external_id: string }>(
      sql`
        INSERT INTO questions (id, bank_id, external_id, question_uz, question_ru,
          options_uz, options_ru, correct_answer, image, topic_id)
        VALUES ${sql.join(questionValues, sql`, `)}
        ON CONFLICT (bank_id, external_id) DO UPDATE SET
          question_uz = EXCLUDED.question_uz,
          question_ru = EXCLUDED.question_ru,
          options_uz = EXCLUDED.options_uz,
          options_ru = EXCLUDED.options_ru,
          correct_answer = EXCLUDED.correct_answer,
          image = EXCLUDED.image,
          topic_id = EXCLUDED.topic_id
        RETURNING id, external_id
      `,
      txOrDb
    );

    affectedQuestions += insertedOrUpdated.length;

    // 4. Izohlarni question_explanations ga yozish
    const idByExt = new Map(insertedOrUpdated.map((r) => [r.external_id, r.id]));
    const explanationValues = chunk
      .filter((it) => it.explanationUz && idByExt.has(it.externalId))
      .map((it) => {
        const qId = idByExt.get(it.externalId)!;
        return sql`(${qId}, ${it.explanationUz}, ${it.explanationRu})`;
      });

    if (explanationValues.length > 0) {
      await executeRows(
        sql`
          INSERT INTO question_explanations (question_id, explanation_uz, explanation_ru)
          VALUES ${sql.join(explanationValues, sql`, `)}
          ON CONFLICT (question_id) DO UPDATE SET
            explanation_uz = EXCLUDED.explanation_uz,
            explanation_ru = EXCLUDED.explanation_ru
        `,
        txOrDb
      );
    }

    process.stdout.write(
      `\r  Savollar: ${Math.min(start + CHUNK_SIZE, bank.items.length)}/${bank.items.length} kiritildi...`
    );
  }
  console.log('');

  // 5. Version bump
  await executeRows(
    sql`
      UPDATE question_banks
      SET content_version = content_version + 1
      WHERE id = ${bankId}
    `,
    txOrDb
  );

  // 6. Tekshiruv
  const after = await executeRows<{ q: number; t: number }>(
    sql`
      SELECT (SELECT COUNT(*)::int FROM questions WHERE bank_id = ${bankId}) AS q,
             (SELECT COUNT(*)::int FROM topics WHERE bank_id = ${bankId}) AS t
    `,
    txOrDb
  );

  console.log(`✅ [${bank.subjectId}] MUVAFFAQIYATLI: ${after[0]?.q} savol, ${after[0]?.t} mavzu DBda mavjud.`);
  return after[0];
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL topilmadi (.env faylni tekshiring)');
  }

  const targets = isAll
    ? SUBJECT_LIST
    : targetSubject
    ? SUBJECT_LIST.filter((s) => s.folder === targetSubject || s.bankId === targetSubject)
    : [];

  if (targets.length === 0) {
    console.error('Qaysi fanni import qilishni ko\'rsating:');
    console.error('  npx tsx scripts/import-subject-bank.ts --subject biologiya [--dry-run]');
    console.error('  npx tsx scripts/import-subject-bank.ts --all [--dry-run]');
    process.exit(1);
  }

  console.log(`[Import Manager] ${targets.length} ta fan tanlandi.`);
  if (isDryRun) {
    console.log('⚡ REJIM: DRY-RUN (barcha o\'zgarishlar yakunda rollback qilinadi, DBga tegilmaydi)');
    const { transactionBestEffort } = await import('../server/db/connection');
    try {
      await transactionBestEffort(async (tx) => {
        for (const t of targets) {
          await importBank(t.folder, tx);
        }
        throw new Error('DRY_RUN_ROLLBACK');
      });
    } catch (err: any) {
      if (err.message === 'DRY_RUN_ROLLBACK') {
        console.log('\n========================================');
        console.log('✅ DRY-RUN yakunlandi: Barcha fanlar xatosiz tekshirildi va bekor qilindi (DB toza).');
        return;
      }
      throw err;
    }
  } else {
    for (const t of targets) {
      await importBank(t.folder);
    }
    console.log('\n========================================');
    console.log('🎉 BARCHA TANLANGAN FANLAR NEON DB GA TO\'LIQ IMPORT QILINDI!');
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n❌ Importda xatolik yuz berdi:', err);
    process.exit(1);
  });
