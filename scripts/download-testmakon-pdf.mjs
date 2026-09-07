import fs from 'fs';
import path from 'path';

const OUT_DIR = path.resolve('content-banks', 'testmakon', 'pdf');

const pdfs = [
  { name: 'matematika-test-toplami.pdf', url: 'https://testmakon.uz/pdf/matematika-test-toplami.pdf' },
  { name: 'fizika-test-toplami.pdf', url: 'https://testmakon.uz/pdf/fizika-test-toplami.pdf' },
  { name: 'kimyo-test-toplami.pdf', url: 'https://testmakon.uz/pdf/kimyo-test-toplami.pdf' },
  { name: 'biologiya-test-toplami.pdf', url: 'https://testmakon.uz/pdf/biologiya-test-toplami.pdf' },
  { name: 'english-test-toplami.pdf', url: 'https://testmakon.uz/pdf/english-test-toplami.pdf' },
  { name: 'tarix-test-toplami.pdf', url: 'https://testmakon.uz/pdf/tarix-test-toplami.pdf' },
  { name: 'ona-tili-test-toplami.pdf', url: 'https://testmakon.uz/pdf/ona-tili-test-toplami.pdf' },
  { name: 'geografiya-test-toplami.pdf', url: 'https://testmakon.uz/pdf/geografiya-test-toplami.pdf' },
  { name: 'informatika-test-toplami.pdf', url: 'https://testmakon.uz/pdf/informatika-test-toplami.pdf' },
  { name: 'adabiyot-test-toplami.pdf', url: 'https://testmakon.uz/pdf/adabiyot-test-toplami.pdf' },
  { name: 'huquq-test-toplami.pdf', url: 'https://testmakon.uz/pdf/huquq-test-toplami.pdf' },
  { name: 'yol-belgilari.pdf', url: 'https://testmakon.uz/pdf/yol-belgilari.pdf' },
  { name: 'otish-ballari.pdf', url: 'https://testmakon.uz/pdf/otish-ballari.pdf' }
];

async function downloadPdfs() {
  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  }

  console.log(`Yuklanmoqda: ${pdfs.length} ta rasmiy PDF test to'plamlari...`);
  for (const item of pdfs) {
    const dest = path.join(OUT_DIR, item.name);
    if (fs.existsSync(dest)) {
      console.log(`  [Mavjud] ${item.name}`);
      continue;
    }

    try {
      const res = await fetch(item.url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      if (res.ok) {
        const buffer = await res.arrayBuffer();
        fs.writeFileSync(dest, Buffer.from(buffer));
        console.log(`  [OK] ${item.name} (${Math.round(buffer.byteLength / 1024)} KB)`);
      } else {
        console.log(`  [XATO] ${item.name}: HTTP ${res.status}`);
      }
    } catch (e) {
      console.log(`  [XATO] ${item.name}: ${e.message}`);
    }
  }

  console.log('\nBarcha mavjud PDF to\'plamlar yuklab olindi!');
  console.log('Manzil:', OUT_DIR);
}

downloadPdfs().catch(console.error);
