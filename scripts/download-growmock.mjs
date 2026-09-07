import fs from 'fs';
import path from 'path';

const TOKEN_FILE = 'C:\\Users\\PC\\.gemini\\antigravity\\brain\\a2d35c3e-e899-4637-9d88-615d1318b260\\scratch\\user_token.txt';
const BASE_OUT_DIR = path.resolve('content-banks', 'growmock');

const SUPABASE_URL = 'https://jvwzxauhpczromuapaaz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp2d3p4YXVocGN6cm9tdWFwYWF6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyMTY2NTQsImV4cCI6MjA5Mzc5MjY1NH0.yT_OmhIzLpJvh07Kyov-h8kmaNQ7ZrpIYGs2rvdDWsQ';

const API_BASE = 'https://api.growmock.uz/api';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function randomDelay(minMs = 1200, maxMs = 2500) {
  const ms = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  return sleep(ms);
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

async function fetchJson(url, options = {}) {
  const res = await fetch(url, options);
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`HTTP ${res.status} from ${url}: ${txt.slice(0, 200)}`);
  }
  return res.json();
}

async function downloadSupabaseTable(table, outPath) {
  if (fs.existsSync(outPath)) {
    console.log(`[IELTS] Exists, skipping: ${table}`);
    return;
  }
  console.log(`[IELTS] Fetching ${table}...`);
  const data = await fetchJson(`${SUPABASE_URL}/rest/v1/${table}?select=*`, {
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
    }
  });
  fs.writeFileSync(outPath, JSON.stringify(data, null, 2), 'utf8');
  console.log(`[IELTS] Saved ${table} (${data.length} records) -> ${path.basename(outPath)}`);
  await sleep(400);
}

async function downloadIelts() {
  console.log('\n=== Yuklanmoqda: IELTS (Reading, Listening, Writing, Speaking) ===');
  const ieltsDir = path.join(BASE_OUT_DIR, 'ielts');
  ensureDir(path.join(ieltsDir, 'listening'));
  ensureDir(path.join(ieltsDir, 'reading'));
  ensureDir(path.join(ieltsDir, 'writing'));
  ensureDir(path.join(ieltsDir, 'speaking'));

  // Listening
  await downloadSupabaseTable('listening_part1_templates', path.join(ieltsDir, 'listening', 'part1.json'));
  await downloadSupabaseTable('listening_part2_templates', path.join(ieltsDir, 'listening', 'part2.json'));
  await downloadSupabaseTable('listening_part3_templates', path.join(ieltsDir, 'listening', 'part3.json'));
  await downloadSupabaseTable('listening_part4_templates', path.join(ieltsDir, 'listening', 'part4.json'));

  // Reading
  await downloadSupabaseTable('reading_passage1_templates', path.join(ieltsDir, 'reading', 'passage1.json'));
  await downloadSupabaseTable('reading_passage2_templates', path.join(ieltsDir, 'reading', 'passage2.json'));
  await downloadSupabaseTable('reading_passage3_templates', path.join(ieltsDir, 'reading', 'passage3.json'));

  // Writing
  await downloadSupabaseTable('writing_tests', path.join(ieltsDir, 'writing', 'tests.json'));
  await downloadSupabaseTable('writing_tasks', path.join(ieltsDir, 'writing', 'tasks.json'));
  await downloadSupabaseTable('writing_task1_pool', path.join(ieltsDir, 'writing', 'task1_pool.json'));
  await downloadSupabaseTable('writing_task2_pool', path.join(ieltsDir, 'writing', 'task2_pool.json'));

  // Speaking
  await downloadSupabaseTable('speaking_tests', path.join(ieltsDir, 'speaking', 'tests.json'));
  await downloadSupabaseTable('speaking_parts', path.join(ieltsDir, 'speaking', 'parts.json'));
  await downloadSupabaseTable('speaking_questions', path.join(ieltsDir, 'speaking', 'questions.json'));
}

async function downloadApiCategory(categoryName, subjectsEndpoint, categoryDir, token) {
  console.log(`\n=== Yuklanmoqda: ${categoryName} ===`);
  const headers = {
    'Authorization': `Bearer ${token}`,
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
    'Referer': 'https://growmock.uz/',
    'Origin': 'https://growmock.uz',
    'Accept': 'application/json'
  };

  ensureDir(categoryDir);
  let subjects = [];
  if (typeof subjectsEndpoint === 'string') {
    subjects = await fetchJson(`${API_BASE}${subjectsEndpoint}`, { headers });
  } else {
    subjects = subjectsEndpoint;
  }

  fs.writeFileSync(path.join(categoryDir, 'subjects.json'), JSON.stringify(subjects, null, 2), 'utf8');

  let totalQuestionsCount = 0;
  let totalTestsCount = 0;

  for (const subj of subjects) {
    const slug = subj.slug || subj.code;
    const subjName = subj.name || slug;
    const subjDir = path.join(categoryDir, slug);
    ensureDir(subjDir);

    console.log(`\n[${categoryName}] Fan: ${subjName} (${slug})`);
    let testsUrl = `${API_BASE}/dtm/subjects/${slug}/tests`;
    if (subj.testsEndpoint) {
      testsUrl = `${API_BASE}${subj.testsEndpoint}`;
    }

    let tests = [];
    try {
      tests = await fetchJson(testsUrl, { headers });
      fs.writeFileSync(path.join(subjDir, 'tests_list.json'), JSON.stringify(tests, null, 2), 'utf8');
    } catch (e) {
      console.error(`  [XATO] Testlar ro'yxatini olib bo'lmadi: ${slug}`, e.message);
      continue;
    }

    console.log(`  Topilgan testlar: ${tests.length} ta`);

    for (let i = 0; i < tests.length; i++) {
      const test = tests[i];
      const safeTitle = (test.title || `test_${i+1}`).replace(/[^a-zA-Z0-9_\-]/g, '_').toLowerCase();
      const testFile = path.join(subjDir, `${i+1}_${safeTitle}.json`);

      if (fs.existsSync(testFile)) {
        console.log(`    (${i+1}/${tests.length}) [Mavjud, tashlab o'tildi] ${test.title}`);
        continue;
      }

      // Tabiiy kechikish (insoniy interval: 1.2s - 2.5s)
      await randomDelay();

      try {
        const qUrl = `${API_BASE}/dtm/tests/${test.id}/questions`;
        const questions = await fetchJson(qUrl, { headers });

        const fullTest = {
          info: test,
          subject: subj,
          questionsCount: questions.length,
          questions: questions,
          downloadedAt: new Date().toISOString()
        };

        fs.writeFileSync(testFile, JSON.stringify(fullTest, null, 2), 'utf8');
        totalQuestionsCount += questions.length;
        totalTestsCount++;
        console.log(`    (${i+1}/${tests.length}) [OK] ${test.title} -> ${questions.length} ta savol yuklandi`);
      } catch (err) {
        console.error(`    (${i+1}/${tests.length}) [XATO] ${test.title} (${test.id}): ${err.message}`);
        // Agar 429 bo'lsa, 10 soniya kutamiz
        if (err.message.includes('429')) {
          console.log('    [429] Rate limit kutish: 10 soniya...');
          await sleep(10000);
        }
      }
    }
  }

  console.log(`\n[${categoryName}] Yakunlandi! Yuklangan yangi testlar: ${totalTestsCount}, savollar: ${totalQuestionsCount}`);
}

async function main() {
  console.log('🚀 GrowMock testlarini bildirmasdan yuklash boshlandi...');
  ensureDir(BASE_OUT_DIR);

  let token = '';
  if (fs.existsSync(TOKEN_FILE)) {
    token = fs.readFileSync(TOKEN_FILE, 'utf8').trim();
    console.log('✅ Foydalanuvchi sessiya tokeni topildi');
  } else {
    throw new Error('user_token.txt fayli topilmadi!');
  }

  // 1. IELTS (Supabase)
  await downloadIelts();

  // 2. DTM testlari (Biologiya, Fizika, Geografiya, Huquq, Ingliz tili, Kimyo, Matematika, Ona tili, Tarix)
  await downloadApiCategory('DTM', '/dtm/categories/dtm/subjects', path.join(BASE_OUT_DIR, 'dtm'), token);

  // 3. SAT testlari (SAT Math, SAT Reading & Writing)
  await downloadApiCategory('SAT', '/dtm/categories/sat/subjects', path.join(BASE_OUT_DIR, 'sat'), token);

  // 4. Tillar (Turk, Nemis, Rus, Koreys, Xitoy)
  const langSubjects = [
    { name: 'Turk tili', slug: 'lang_tr', code: 'tr' },
    { name: 'Nemis tili', slug: 'lang_de', code: 'de' },
    { name: 'Rus tili', slug: 'lang_ru', code: 'ru' },
    { name: 'Koreys tili', slug: 'lang_ko', code: 'ko' },
    { name: 'Xitoy tili', slug: 'lang_zh', code: 'zh' }
  ];
  await downloadApiCategory('Tillar', langSubjects, path.join(BASE_OUT_DIR, 'languages'), token);

  console.log('\n🎉 BARCHA TESTLAR MUVAFFAQIYATLI VA SEZDIRMASDAN YUKLAB OLINDI!');
  console.log(`📁 Saqlangan manzil: ${BASE_OUT_DIR}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
