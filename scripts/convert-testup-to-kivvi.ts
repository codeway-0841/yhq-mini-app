import fs from 'node:fs/promises';
import path from 'node:path';

interface TestUpQuestion {
  q: string;
  v: string[];
  t: number;
  izoh?: string;
  rasm?: string;
  izohRasm?: string;
  qiy?: string;
  arxetip?: string;
  id?: string;
}

interface TestUpTopicFile {
  nom: string;
  bolim?: string;
  savollar: TestUpQuestion[];
}

interface SubjectMapping {
  testupFolder: string;
  canonicalFolder: string;
  subjectId: string;
  bankId: string;
  bankName: string;
}

const MAPPINGS: SubjectMapping[] = [
  {
    testupFolder: 'biologiya',
    canonicalFolder: 'biologiya',
    subjectId: 'biologiya',
    bankId: 'biology_db',
    bankName: 'Biologiya savollar bazasi',
  },
  {
    testupFolder: 'tarix',
    canonicalFolder: 'tarix',
    subjectId: 'tarix',
    bankId: 'history_db',
    bankName: 'Tarix savollar bazasi',
  },
  {
    testupFolder: 'kimyo',
    canonicalFolder: 'kimyo',
    subjectId: 'kimyo',
    bankId: 'chemistry_db',
    bankName: 'Kimyo savollar bazasi',
  },
  {
    testupFolder: 'geografiya',
    canonicalFolder: 'geografiya',
    subjectId: 'geografiya',
    bankId: 'geography_db',
    bankName: 'Geografiya savollar bazasi',
  },
  {
    testupFolder: 'ona-tili',
    canonicalFolder: 'onatili',
    subjectId: 'onatili',
    bankId: 'onatili_db',
    bankName: 'Ona tili savollar bazasi',
  },
  {
    testupFolder: 'adabiyot',
    canonicalFolder: 'adabiyot',
    subjectId: 'adabiyot',
    bankId: 'adabiyot_db',
    bankName: 'Adabiyot savollar bazasi',
  },
];

async function convertSubject(map: SubjectMapping) {
  const inputDir = path.resolve(process.cwd(), 'content-banks/testup', map.testupFolder);
  const topicsDir = path.join(inputDir, 'topics');
  const outputDir = path.resolve(process.cwd(), 'content-banks', map.canonicalFolder);
  await fs.mkdir(outputDir, { recursive: true });

  const indexFile = path.join(inputDir, 'index.json');
  const indexRaw = await fs.readFile(indexFile, 'utf-8');
  const indexData = JSON.parse(indexRaw);

  const topicFiles = await fs.readdir(topicsDir);
  console.log(`\n========================================`);
  console.log(`[Konvertatsiya: ${map.bankName}] Topics papkasida ${topicFiles.length} ta fayl`);

  const topics: Array<{ externalId: string; nameUz: string; nameRu: string }> = [];
  const items: any[] = [];
  const seenExternalIds = new Set<string>();

  for (const file of topicFiles) {
    if (!file.endsWith('.json')) continue;
    const topicId = file.replace('.json', '');
    const topicPath = path.join(topicsDir, file);
    const contentRaw = await fs.readFile(topicPath, 'utf-8');
    const topicContent: TestUpTopicFile = JSON.parse(contentRaw);

    const topicNom = topicContent.nom || topicId;
    topics.push({
      externalId: topicId,
      nameUz: topicNom,
      nameRu: topicNom,
    });

    if (!Array.isArray(topicContent.savollar)) continue;

    topicContent.savollar.forEach((q, idx) => {
      // 1. External ID
      const externalId = `${topicId}_${String(idx + 1).padStart(3, '0')}`;
      if (seenExternalIds.has(externalId)) {
        console.warn(`Ogohlantirish: Takrorlangan externalId: ${externalId}`);
      }
      seenExternalIds.add(externalId);

      // 2. Options
      const rawOptions = Array.isArray(q.v) ? q.v : [];
      const optionsUz: Record<string, string> = {};
      const optionsRu: Record<string, string> = {};

      rawOptions.forEach((opt, optIdx) => {
        const key = `A${optIdx + 1}`;
        const cleanOpt = String(opt ?? '').trim();
        optionsUz[key] = cleanOpt;
        optionsRu[key] = cleanOpt;
      });

      // Kamida 2 ta, standart 4 ta variant
      const correctIdx = Number(q.t);
      const correctAnswer = `A${correctIdx + 1}`;

      // Validatsiya
      if (!optionsUz[correctAnswer]) {
        console.error(`[XATO] ${externalId}: correctAnswer (${correctAnswer}) options ichida yo'q!`);
      }

      items.push({
        externalId,
        topicExternalId: topicId,
        questionUz: String(q.q || '').trim(),
        questionRu: String(q.q || '').trim(),
        optionsUz,
        optionsRu,
        correctAnswer,
        explanationUz: String(q.izoh || '').trim(),
        explanationRu: String(q.izoh || '').trim(),
        source: `${map.bankName}, ${topicNom}`,
        image: q.rasm || null,
        difficulty: q.qiy || 'medium',
      });
    });
  }

  const bankJson = {
    version: 1,
    subjectId: map.subjectId,
    bankId: map.bankId,
    bankName: map.bankName,
    topics,
    items,
  };

  const outPath = path.join(outputDir, 'bank.json');
  await fs.writeFile(outPath, JSON.stringify(bankJson, null, 2), 'utf-8');

  console.log(`✅ [${map.subjectId}] Tayyor! Topics: ${topics.length} ta, Items: ${items.length} ta`);
  console.log(`   Saqlandi: ${path.relative(process.cwd(), outPath)}`);

  return {
    subjectId: map.subjectId,
    bankId: map.bankId,
    topicsCount: topics.length,
    itemsCount: items.length,
  };
}

async function main() {
  console.log('[TestUp Converter] Boshlanmoqda...');
  const stats = [];
  for (const m of MAPPINGS) {
    const res = await convertSubject(m);
    stats.push(res);
  }

  console.log('\n========================================');
  console.log('[TestUp Converter] BARCHA FANLAR MUVAFFAQIYATLI KONVERTATSIYA QILINDI:');
  console.table(stats);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
