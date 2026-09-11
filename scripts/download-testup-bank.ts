import fs from 'node:fs/promises';
import path from 'node:path';

const BASE_URL = 'https://testup.uz';
const OUTPUT_ROOT = path.resolve(process.cwd(), 'content-banks/testup');
const CONCURRENCY = 15;

const SUBJECTS = [
  'matematika',
  'ona-tili',
  'adabiyot',
  'fizika',
  'kimyo',
  'biologiya',
  'tarix',
  'geografiya',
  'ingliz-tili',
];

interface TopicMeta {
  id: string;
  nom: string;
  bolim?: string;
  savol?: number;
  qiy?: { oson?: number; orta?: number; qiyin?: number };
  sertifikat?: boolean;
  daraja?: string;
}

interface Question {
  id: string;
  q: string;
  v: string[];
  t: number;
  izoh?: string;
  rasm?: string;
  izohRasm?: string;
  qiy?: string;
  arxetip?: string;
}

interface TopicFile {
  nom: string;
  bolim?: string;
  savollar: Question[];
}

async function fetchWithRetry(url: string, retries = 3, timeoutMs = 12000): Promise<any> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; TestUpArchiver/1.0)' },
      });
      clearTimeout(timeout);
      if (!res.ok) {
        if (res.status === 404) return null;
        throw new Error(`HTTP ${res.status}`);
      }
      return await res.json();
    } catch (err: any) {
      clearTimeout(timeout);
      if (attempt === retries) throw err;
      await new Promise((r) => setTimeout(r, 600 * attempt));
    }
  }
  return null;
}

async function runPool<T, R>(items: T[], fn: (item: T, idx: number) => Promise<R>, limit: number): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let currentIndex = 0;

  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (currentIndex < items.length) {
      const idx = currentIndex++;
      results[idx] = await fn(items[idx], idx);
    }
  });

  await Promise.all(workers);
  return results;
}

async function main() {
  const startTime = Date.now();
  console.log(`[TestUp Downloader] Boshlanmoqda...`);
  console.log(`[TestUp Downloader] Saqlash joyi: ${OUTPUT_ROOT}`);
  await fs.mkdir(OUTPUT_ROOT, { recursive: true });

  const summary: Record<string, any> = {
    downloadedAt: new Date().toISOString(),
    subjects: {},
    totalQuestions: 0,
    totalTopics: 0,
  };

  // 1. Asosiy 9 ta fanni yuklash
  for (const slug of SUBJECTS) {
    console.log(`\n========================================`);
    console.log(`[Fan: ${slug}] Indeks yuklanmoqda...`);
    const subjectDir = path.join(OUTPUT_ROOT, slug);
    const topicsDir = path.join(subjectDir, 'topics');
    await fs.mkdir(topicsDir, { recursive: true });

    const indexUrl = `${BASE_URL}/data/${slug}/index.json`;
    const indexData = await fetchWithRetry(indexUrl);
    if (!indexData) {
      console.error(`[Fan: ${slug}] Indeks topilmadi!`);
      continue;
    }

    await fs.writeFile(
      path.join(subjectDir, 'index.json'),
      JSON.stringify(indexData, null, 2),
      'utf-8'
    );

    // Barcha mavzular ro'yxatini yig'ish
    const topicsToDownload: TopicMeta[] = [];
    if (Array.isArray(indexData.sinflar)) {
      for (const sinf of indexData.sinflar) {
        if (Array.isArray(sinf.kitoblar)) {
          for (const kitob of sinf.kitoblar) {
            if (Array.isArray(kitob.mavzular)) {
              for (const m of kitob.mavzular) {
                if (m && m.id) {
                  topicsToDownload.push(m);
                }
              }
            }
          }
        }
      }
    }

    console.log(`[Fan: ${slug}] Jami topilgan mavzular: ${topicsToDownload.length} ta`);

    let downloadedCount = 0;
    let questionsForSubject: Array<Question & { topicId: string; topicNom: string }> = [];

    await runPool(
      topicsToDownload,
      async (topic) => {
        const topicUrl = `${BASE_URL}/data/${slug}/${topic.id}.json`;
        try {
          const topicContent = await fetchWithRetry(topicUrl);
          if (topicContent && Array.isArray(topicContent.savollar)) {
            // Alohida mavzu fayli sifatida saqlash
            await fs.writeFile(
              path.join(topicsDir, `${topic.id}.json`),
              JSON.stringify(topicContent, null, 2),
              'utf-8'
            );

            // Master to'plamga qo'shish
            for (const q of topicContent.savollar) {
              questionsForSubject.push({
                ...q,
                topicId: topic.id,
                topicNom: topicContent.nom || topic.nom,
              });
            }
          }
          downloadedCount++;
          if (downloadedCount % 25 === 0 || downloadedCount === topicsToDownload.length) {
            process.stdout.write(`\r  Yuklandi: ${downloadedCount}/${topicsToDownload.length} mavzu...`);
          }
        } catch (e: any) {
          console.error(`\n  [Xato] ${topic.id}: ${e.message}`);
        }
      },
      CONCURRENCY
    );

    console.log(`\n[Fan: ${slug}] Birlashgan master fayl yozilmoqda...`);
    const allSubjectFile = path.join(OUTPUT_ROOT, `${slug}_all.json`);
    await fs.writeFile(
      allSubjectFile,
      JSON.stringify(
        {
          fan: slug,
          nom: indexData.nom,
          jamiSavollar: questionsForSubject.length,
          jamiMavzular: downloadedCount,
          savollar: questionsForSubject,
        },
        null,
        2
      ),
      'utf-8'
    );

    summary.subjects[slug] = {
      nom: indexData.nom,
      mavzular: downloadedCount,
      savollar: questionsForSubject.length,
    };
    summary.totalQuestions += questionsForSubject.length;
    summary.totalTopics += downloadedCount;
    console.log(`[Fan: ${slug}] TUGADI! Savollar soni: ${questionsForSubject.length} ta`);
  }

  // 2. Milliy sertifikat bo'limi
  console.log(`\n========================================`);
  console.log(`[Milliy Sertifikat] Indeks yuklanmoqda...`);
  const certDir = path.join(OUTPUT_ROOT, 'sertifikat');
  const certTopicsDir = path.join(certDir, 'topics');
  await fs.mkdir(certTopicsDir, { recursive: true });

  const certIndexUrl = `${BASE_URL}/data/sertifikat/index.json`;
  const certIndex = await fetchWithRetry(certIndexUrl);
  if (certIndex) {
    await fs.writeFile(
      path.join(certDir, 'index.json'),
      JSON.stringify(certIndex, null, 2),
      'utf-8'
    );

    const certTopics: TopicMeta[] = [];
    if (Array.isArray(certIndex.sinflar)) {
      for (const sinf of certIndex.sinflar) {
        if (Array.isArray(sinf.kitoblar)) {
          for (const kitob of sinf.kitoblar) {
            if (Array.isArray(kitob.mavzular)) {
              for (const m of kitob.mavzular) {
                if (m && m.id && (m.savol ?? 0) > 0) {
                  certTopics.push(m);
                }
              }
            }
          }
        }
      }
    }

    console.log(`[Milliy Sertifikat] Savoli bor mavzular: ${certTopics.length} ta`);
    const certQuestions: Array<Question & { topicId: string; topicNom: string }> = [];

    await runPool(
      certTopics,
      async (topic) => {
        const topicUrl = `${BASE_URL}/data/sertifikat/${topic.id}.json`;
        try {
          const content = await fetchWithRetry(topicUrl);
          if (content && Array.isArray(content.savollar)) {
            await fs.writeFile(
              path.join(certTopicsDir, `${topic.id}.json`),
              JSON.stringify(content, null, 2),
              'utf-8'
            );
            for (const q of content.savollar) {
              certQuestions.push({
                ...q,
                topicId: topic.id,
                topicNom: content.nom || topic.nom,
              });
            }
          }
        } catch (e: any) {
          console.error(`\n  [Xato sertifikat] ${topic.id}: ${e.message}`);
        }
      },
      CONCURRENCY
    );

    await fs.writeFile(
      path.join(OUTPUT_ROOT, 'sertifikat_all.json'),
      JSON.stringify(
        {
          fan: 'sertifikat',
          nom: 'Milliy sertifikat',
          jamiSavollar: certQuestions.length,
          jamiMavzular: certTopics.length,
          savollar: certQuestions,
        },
        null,
        2
      ),
      'utf-8'
    );

    summary.subjects['sertifikat'] = {
      nom: 'Milliy sertifikat',
      mavzular: certTopics.length,
      savollar: certQuestions.length,
    };
    summary.totalQuestions += certQuestions.length;
    summary.totalTopics += certTopics.length;
  }

  // 3. Yakuniy xulosa faylini saqlash
  const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(1);
  summary.elapsedSeconds = Number(elapsedSec);
  await fs.writeFile(
    path.join(OUTPUT_ROOT, 'summary.json'),
    JSON.stringify(summary, null, 2),
    'utf-8'
  );

  console.log(`\n========================================`);
  console.log(`[TestUp Downloader] BARCHA MA'LUMOTLAR YUKLANDI!`);
  console.log(`Ketgan vaqt: ${elapsedSec} sekund`);
  console.log(`Jami mavzular: ${summary.totalTopics} ta`);
  console.log(`Jami test savollari: ${summary.totalQuestions} ta`);
  console.log(`Papka: ${OUTPUT_ROOT}`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
