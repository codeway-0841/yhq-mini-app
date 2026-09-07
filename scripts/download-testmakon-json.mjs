import fs from 'fs';
import path from 'path';

const BASE_OUT_DIR = path.resolve('content-banks', 'testmakon', 'json');

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

async function fetchTopicQuestions(topicUrl) {
  let page = 1;
  let allQuestions = [];
  let topicInfo = null;

  while (true) {
    const pageUrl = page === 1 ? topicUrl : `${topicUrl}?page=${page}`;
    try {
      const res = await fetch(pageUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        }
      });
      if (!res.ok) break;
      const text = await res.text();

      // Extract JSON-LD Quiz
      const m = text.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi) || [];
      let foundQuiz = false;
      for (const s of m) {
        if (s.includes('"Quiz"')) {
          foundQuiz = true;
          const jsonStr = s.replace(/<script type="application\/ld\+json">|<\/script>/gi, '');
          const quiz = JSON.parse(jsonStr);
          if (!topicInfo) {
            topicInfo = {
              name: quiz.name,
              about: quiz.about?.name,
              subject: quiz.educationalAlignment?.[0]?.targetName || 'Boshqa',
              level: quiz.educationalLevel || 'Abituriyent',
              url: topicUrl
            };
          }
          if (quiz.hasPart && Array.isArray(quiz.hasPart)) {
            for (const q of quiz.hasPart) {
              allQuestions.push({
                question: q.text || q.name,
                options: q.suggestedAnswer?.map(a => a.text) || [],
                correctAnswer: q.acceptedAnswer?.text || ''
              });
            }
          }
        }
      }

      const hasNext = text.includes(`?page=${page + 1}`);
      if (!foundQuiz || !hasNext) {
        break;
      }
      page++;
      await sleep(350);
    } catch (e) {
      console.error(`  [XATO] ${pageUrl}:`, e.message);
      break;
    }
  }

  if (!topicInfo) return null;

  return {
    ...topicInfo,
    questionsCount: allQuestions.length,
    questions: allQuestions,
    downloadedAt: new Date().toISOString()
  };
}

async function main() {
  console.log('🚀 TestMakon rasmiy savollar bazasini to\'liq JSON formatda yuklash boshlandi...');
  ensureDir(BASE_OUT_DIR);

  console.log('Sitemap yuklanmoqda...');
  const sitemapRes = await fetch('https://testmakon.uz/sitemap-questions.xml');
  const sitemapText = await sitemapRes.text();
  const locs = sitemapText.match(/<loc>([^<]+)<\/loc>/gi) || [];
  const topicUrls = locs.map(l => l.replace(/<loc>|<\/loc>/gi, ''));

  console.log(`Jami topilgan mavzular soni: ${topicUrls.length} ta`);

  let totalDownloadedQuestions = 0;
  let totalTopics = 0;

  for (let i = 0; i < topicUrls.length; i++) {
    const url = topicUrls[i];
    // parse subject and topic slug from URL: /tests/practice/<subject>/<topic>/savollar/
    const parts = url.replace('https://testmakon.uz/tests/practice/', '').split('/').filter(Boolean);
    const subjectSlug = parts[0] || 'umumiy';
    const topicSlug = parts[1] || `topic_${i+1}`;

    const subjectDir = path.join(BASE_OUT_DIR, subjectSlug);
    ensureDir(subjectDir);
    const outFile = path.join(subjectDir, `${topicSlug}.json`);

    if (fs.existsSync(outFile)) {
      console.log(`[${i+1}/${topicUrls.length}] [Mavjud] ${subjectSlug}/${topicSlug}`);
      continue;
    }

    // Polite delay
    await sleep(400);

    const data = await fetchTopicQuestions(url);
    if (data && data.questionsCount > 0) {
      fs.writeFileSync(outFile, JSON.stringify(data, null, 2), 'utf8');
      totalDownloadedQuestions += data.questionsCount;
      totalTopics++;
      console.log(`[${i+1}/${topicUrls.length}] [OK] ${data.subject || subjectSlug} -> "${data.about || topicSlug}": ${data.questionsCount} ta savol`);
    } else {
      console.log(`[${i+1}/${topicUrls.length}] [BO'SH] ${subjectSlug}/${topicSlug}`);
    }
  }

  console.log('\n🎉 TESTMAKON SAVOLLAR BAZASI TO\'LIQ JSON FORMATDA YUKLAB OLINDI!');
  console.log(`📊 Jami mavzular: ${totalTopics}, jami savollar: ${totalDownloadedQuestions}`);
  console.log(`📁 Manzil: ${BASE_OUT_DIR}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
