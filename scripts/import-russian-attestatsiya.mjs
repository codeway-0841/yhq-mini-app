import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { neon } from '@neondatabase/serverless';

if (!process.env.DATABASE_URL) {
  console.error('FATAL: DATABASE_URL topilmadi (.env faylni tekshiring)');
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);
const BANK_ID = 'russian_db';
const BANK_NAME = 'Rus tili savollar bazasi';

async function main() {
  console.log('🚀 Rus tili attestatsiya savollarini Neon DB ga yuklash boshlandi...');

  // 1. bank.json ni o'qish
  const bankPath = path.resolve(process.cwd(), 'content-banks/rustili/bank.json');
  const bank = JSON.parse(fs.readFileSync(bankPath, 'utf8'));

  console.log(`Yuklanmoqda: ${bank.topics.length} ta mavzu, ${bank.items.length} ta savol`);

  // 2. question_banks qatori
  await sql`
    INSERT INTO question_banks (id, name) VALUES (${BANK_ID}, ${BANK_NAME})
    ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name
  `;
  console.log('✅ question_banks tayyor');

  // 3. Topics kiritish (slug = ${BANK_ID}-${externalId})
  for (const t of bank.topics) {
    const slug = `${BANK_ID}-${t.externalId}`;
    await sql`
      INSERT INTO topics (name_uz, name_ru, slug, bank_id)
      VALUES (${t.nameUz}, ${t.nameRu}, ${slug}, ${BANK_ID})
      ON CONFLICT (slug) DO UPDATE SET
        name_uz = EXCLUDED.name_uz,
        name_ru = EXCLUDED.name_ru
    `;
  }
  console.log(`✅ ${bank.topics.length} ta topic bazaga kiritildi/yangilandi`);

  // 4. Topic ID xaritasini olish
  const dbTopics = await sql`
    SELECT id, slug FROM topics WHERE bank_id = ${BANK_ID}
  `;
  const topicIdBySlug = new Map(dbTopics.map((t) => [t.slug, t.id]));
  const getTopicId = (extId) => {
    const id = topicIdBySlug.get(`${BANK_ID}-${extId}`) ?? topicIdBySlug.get(extId);
    if (!id) throw new Error(`Topic topilmadi: ${extId}`);
    return id;
  };

  // 5. Mavjud savollarni tekshirish
  const existingQuestions = await sql`
    SELECT id, external_id FROM questions WHERE bank_id = ${BANK_ID}
  `;
  const existingIdMap = new Map(existingQuestions.map((q) => [q.external_id, q.id]));
  console.log(`Mavjud savollar soni: ${existingIdMap.size} ta`);

  const maxRow = await sql`
    SELECT COALESCE(MAX(id), 0)::int AS max FROM questions
  `;
  let nextId = (maxRow[0]?.max ?? 0) + 1;
  console.log(`Yangi savollar uchun boshlang'ich ID: ${nextId}`);

  // 6. Savollarni kiritish (concurrency bilan tezkor yuklash)
  const CONCURRENCY = 20;
  let affected = 0;
  
  // Faqat yangi yoki yangilanishi kerak bo'lgan savollarni filtrlaymiz
  const itemsToProcess = bank.items;
  
  for (let i = 0; i < itemsToProcess.length; i += CONCURRENCY) {
    const slice = itemsToProcess.slice(i, i + CONCURRENCY);
    await Promise.all(
      slice.map(async (it) => {
        const existingId = existingIdMap.get(it.externalId);
        const qId = existingId !== undefined ? existingId : nextId++;
        const topicId = getTopicId(it.topicExternalId);
        const optionsUz = JSON.stringify(it.optionsUz);
        const optionsRu = JSON.stringify(it.optionsRu);
        const image = it.image || null;

        await sql`
          INSERT INTO questions (
            id, bank_id, external_id, question_uz, question_ru,
            options_uz, options_ru, correct_answer, image, topic_id
          ) VALUES (
            ${qId}, ${BANK_ID}, ${it.externalId}, ${it.questionUz}, ${it.questionRu},
            ${optionsUz}::jsonb, ${optionsRu}::jsonb, ${it.correctAnswer}, ${image}, ${topicId}
          )
          ON CONFLICT (bank_id, external_id) DO UPDATE SET
            question_uz = EXCLUDED.question_uz,
            question_ru = EXCLUDED.question_ru,
            options_uz = EXCLUDED.options_uz,
            options_ru = EXCLUDED.options_ru,
            correct_answer = EXCLUDED.correct_answer,
            image = EXCLUDED.image,
            topic_id = EXCLUDED.topic_id
        `;
      })
    );
    affected += slice.length;
    process.stdout.write(`\rSavollar saqlanmoqda: ${affected}/${itemsToProcess.length}...`);
  }
  console.log('\n✅ Barcha savollar muvaffaqiyatli saqlandi');

  // 7. Version bump (client va CDN keshlarini yangilash)
  await sql`
    UPDATE question_banks
    SET content_version = content_version + 1
    WHERE id = ${BANK_ID}
  `;
  console.log('✅ question_banks.content_version oshirildi');

  // 8. Yakuniy hisobot
  const finalTopics = await sql`
    SELECT t.id, t.name_uz, t.slug, COUNT(q.id)::int as question_count
    FROM topics t
    LEFT JOIN questions q ON q.topic_id = t.id AND q.bank_id = ${BANK_ID}
    WHERE t.bank_id = ${BANK_ID}
    GROUP BY t.id, t.name_uz, t.slug
    ORDER BY t.slug ASC
  `;

  const [totalQ] = await sql`
    SELECT COUNT(*)::int as total FROM questions WHERE bank_id = ${BANK_ID}
  `;

  console.log('\n======================================================');
  console.log(`🎉 YAKUNIY NATIJA (${BANK_ID}):`);
  console.log(`Jami savollar: ${totalQ.total} ta`);
  console.log(`Jami mavzular / biletlar: ${finalTopics.length} ta\n`);
  for (const t of finalTopics) {
    console.log(`  - [ID: ${t.id}] ${t.name_uz} (${t.slug}): ${t.question_count} ta savol`);
  }
  console.log('======================================================');
}

main().catch((err) => {
  console.error('\n❌ Xatolik yuz berdi:', err);
  process.exit(1);
});
