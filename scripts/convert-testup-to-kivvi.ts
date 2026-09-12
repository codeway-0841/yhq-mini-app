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
  shuffleOptions: boolean;
}

const MAPPINGS: SubjectMapping[] = [
  {
    testupFolder: 'biologiya',
    canonicalFolder: 'biologiya',
    subjectId: 'biologiya',
    bankId: 'biology_db',
    bankName: 'Biologiya savollar bazasi',
    shuffleOptions: true,
  },
  {
    testupFolder: 'tarix',
    canonicalFolder: 'tarix',
    subjectId: 'tarix',
    bankId: 'history_db',
    bankName: 'Tarix savollar bazasi',
    shuffleOptions: true,
  },
  {
    testupFolder: 'kimyo',
    canonicalFolder: 'kimyo',
    subjectId: 'kimyo',
    bankId: 'chemistry_db',
    bankName: 'Kimyo savollar bazasi',
    shuffleOptions: true,
  },
  {
    testupFolder: 'geografiya',
    canonicalFolder: 'geografiya',
    subjectId: 'geografiya',
    bankId: 'geography_db',
    bankName: 'Geografiya savollar bazasi',
    shuffleOptions: true,
  },
  {
    testupFolder: 'ona-tili',
    canonicalFolder: 'onatili',
    subjectId: 'onatili',
    bankId: 'onatili_db',
    bankName: 'Ona tili savollar bazasi',
    shuffleOptions: false,
  },
  {
    testupFolder: 'adabiyot',
    canonicalFolder: 'adabiyot',
    subjectId: 'adabiyot',
    bankId: 'adabiyot_db',
    bankName: 'Adabiyot savollar bazasi',
    shuffleOptions: false,
  },
  {
    testupFolder: 'ingliz-tili',
    canonicalFolder: 'ingliz',
    subjectId: 'ingliz',
    bankId: 'english_db',
    bankName: 'Ingliz tili savollar bazasi',
    shuffleOptions: true,
  },
];

const LEVEL_WEIGHT: Record<string, number> = {
  kids: 0,
  a1: 1,
  a2: 2,
  b1: 3,
  b2: 4,
  c1: 5,
};

function parseEnglishTopicId(fileOrId: string): { level: string; num: number } | null {
  const m = fileOrId.match(/^ing_([a-z0-9]+)_m(\d+)/i);
  if (!m) return null;
  return { level: m[1].toLowerCase(), num: parseInt(m[2], 10) };
}

function hashString(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleArray<T>(array: T[], rng: () => number): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const temp = arr[i];
    arr[i] = arr[j];
    arr[j] = temp;
  }
  return arr;
}

async function convertSubject(map: SubjectMapping) {
  const inputDir = path.resolve(process.cwd(), 'content-banks/testup', map.testupFolder);
  const topicsDir = path.join(inputDir, 'topics');
  const outputDir = path.resolve(process.cwd(), 'content-banks', map.canonicalFolder);
  await fs.mkdir(outputDir, { recursive: true });

  const indexFile = path.join(inputDir, 'index.json');
  const indexRaw = await fs.readFile(indexFile, 'utf-8');
  const indexData = JSON.parse(indexRaw);

  const rawTopicFiles = await fs.readdir(topicsDir);
  const topicFiles = rawTopicFiles.filter((f) => f.endsWith('.json'));

  if (map.subjectId === 'ingliz') {
    topicFiles.sort((a, b) => {
      const pa = parseEnglishTopicId(a);
      const pb = parseEnglishTopicId(b);
      if (pa && pb) {
        const wa = LEVEL_WEIGHT[pa.level] ?? 99;
        const wb = LEVEL_WEIGHT[pb.level] ?? 99;
        if (wa !== wb) return wa - wb;
        return pa.num - pb.num;
      }
      return a.localeCompare(b);
    });
  }

  console.log(`\n========================================`);
  console.log(`[Konvertatsiya: ${map.bankName}] Topics papkasida ${topicFiles.length} ta fayl`);

  const topics: Array<{ externalId: string; nameUz: string; nameRu: string }> = [];
  const items: any[] = [];
  const seenExternalIds = new Set<string>();
  const answerCounts: Record<string, number> = { A1: 0, A2: 0, A3: 0, A4: 0 };

  for (const file of topicFiles) {
    const topicId = file.replace('.json', '');
    const topicPath = path.join(topicsDir, file);
    const contentRaw = await fs.readFile(topicPath, 'utf-8');
    const topicContent: TestUpTopicFile = JSON.parse(contentRaw);

    let topicNom = topicContent.nom || topicId;
    if (map.subjectId === 'ingliz') {
      const p = parseEnglishTopicId(file);
      if (p) {
        const badge = p.level === 'kids' ? 'Pre-A1' : p.level.toUpperCase();
        topicNom = `[${badge}] ${topicNom}`;
      }
    }

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

      // 2. Options & deterministic shuffle
      const rawOptions = Array.isArray(q.v) ? q.v : [];
      const correctIdx = Number(q.t);

      if (isNaN(correctIdx) || correctIdx < 0 || correctIdx >= rawOptions.length) {
        console.error(`[XATO] ${externalId}: invalid q.t index: ${q.t} (options length: ${rawOptions.length})`);
      }

      let finalOptions = rawOptions.map((opt) => String(opt ?? '').trim());
      let finalCorrectIdx = correctIdx;

      if (map.shuffleOptions && rawOptions.length > 1) {
        const indices = rawOptions.map((_, i) => i);
        const seed = hashString(externalId);
        const rng = mulberry32(seed);
        const permutedIndices = shuffleArray(indices, rng);

        finalOptions = permutedIndices.map((origIdx) => String(rawOptions[origIdx] ?? '').trim());
        finalCorrectIdx = permutedIndices.indexOf(correctIdx);
      }

      const optionsUz: Record<string, string> = {};
      const optionsRu: Record<string, string> = {};

      finalOptions.forEach((opt, optIdx) => {
        const key = `A${optIdx + 1}`;
        optionsUz[key] = opt;
        optionsRu[key] = opt;
      });

      const correctAnswer = `A${finalCorrectIdx + 1}`;

      // Invariant check: to'g'ri javob matni aynan rawOptions[correctIdx] bilan bir xil bo'lishi shart!
      const originalCorrectText = String(rawOptions[correctIdx] ?? '').trim();
      if (optionsUz[correctAnswer] !== originalCorrectText) {
        console.error(`[FATAL] ${externalId}: correctAnswer matni mos kelmadi! Kutilgan: "${originalCorrectText}", olindi: "${optionsUz[correctAnswer]}"`);
        process.exit(1);
      }

      answerCounts[correctAnswer] = (answerCounts[correctAnswer] || 0) + 1;

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
  console.log(`   Javoblar taqsimoti: ${JSON.stringify(answerCounts)}`);
  console.log(`   Saqlandi: ${path.relative(process.cwd(), outPath)}`);

  return {
    subjectId: map.subjectId,
    bankId: map.bankId,
    topicsCount: topics.length,
    itemsCount: items.length,
    distribution: `A1:${answerCounts.A1 ?? 0} A2:${answerCounts.A2 ?? 0} A3:${answerCounts.A3 ?? 0} A4:${answerCounts.A4 ?? 0}`,
  };
}

async function main() {
  const args = process.argv.slice(2);
  const subjIdx = args.indexOf('--subject');
  const targetSubj = subjIdx !== -1 ? args[subjIdx + 1] : null;

  console.log('[TestUp Converter] Boshlanmoqda...');
  const targets = targetSubj
    ? MAPPINGS.filter((m) => m.subjectId === targetSubj)
    : MAPPINGS;

  if (targets.length === 0) {
    throw new Error(`Fan topilmadi: ${targetSubj}. Mavjud: ${MAPPINGS.map((m) => m.subjectId).join(', ')}`);
  }

  const stats = [];
  for (const m of targets) {
    const res = await convertSubject(m);
    stats.push(res);
  }

  console.log('\n========================================');
  console.log('[TestUp Converter] KONVERTATSIYA YAKUNLANDI:');
  console.table(stats);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
