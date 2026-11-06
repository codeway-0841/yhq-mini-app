import fs from 'node:fs';
import path from 'node:path';

function parseDocxXml(xml) {
  const tblIndex = xml.indexOf('<w:tbl');
  const preTableXml = tblIndex !== -1 ? xml.slice(0, tblIndex) : xml;
  const tableXml = tblIndex !== -1 ? xml.slice(tblIndex) : '';

  const paragraphs = [];
  const pRegex = /<w:p\b[^>]*>([\s\S]*?)<\/w:p>/g;
  let pMatch;
  while ((pMatch = pRegex.exec(preTableXml)) !== null) {
    const pContent = pMatch[1];
    const tRegex = /<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g;
    let tMatch;
    let pText = '';
    while ((tMatch = tRegex.exec(pContent)) !== null) {
      pText += tMatch[1];
    }
    if (pText.trim()) {
      paragraphs.push(pText.trim());
    }
  }

  const tableRows = [];
  if (tableXml) {
    const trRegex = /<w:tr\b[^>]*>([\s\S]*?)<\/w:tr>/g;
    let trMatch;
    while ((trMatch = trRegex.exec(tableXml)) !== null) {
      const trContent = trMatch[1];
      const tcRegex = /<w:tc\b[^>]*>([\s\S]*?)<\/w:tc>/g;
      let tcMatch;
      const cells = [];
      while ((tcMatch = tcRegex.exec(trContent)) !== null) {
        const tcContent = tcMatch[1];
        const tRegex = /<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g;
        let tMatch;
        let cellText = '';
        while ((tMatch = tRegex.exec(tcContent)) !== null) {
          cellText += tMatch[1];
        }
        cells.push(cellText.trim());
      }
      if (cells.length) tableRows.push(cells);
    }
  }

  return { paragraphs, tableRows };
}

function extractEpochData(filePath) {
  const xml = fs.readFileSync(filePath, 'utf8');
  const { paragraphs, tableRows } = parseDocxXml(xml);

  let epochNum = 0;
  let epochTitle = '';
  for (const p of paragraphs.slice(0, 5)) {
    const m = p.match(/Эпоха\s+(\d+)[:.]?\s*(.*)/i);
    if (m) {
      epochNum = parseInt(m[1], 10);
      epochTitle = m[2].trim();
      break;
    }
  }

  const tableMap = new Map();
  for (let i = 1; i < tableRows.length; i++) {
    const row = tableRows[i];
    if (row.length >= 4) {
      const qNum = parseInt(row[0].trim(), 10);
      const answer = row[1].trim().toUpperCase();
      const topic = row[2].trim();
      const explanation = row[3].trim();
      if (!isNaN(qNum)) {
        if (!tableMap.has(qNum) || (!tableMap.get(qNum).explanation && explanation)) {
          tableMap.set(qNum, { answer, topic, explanation });
        }
      }
    }
  }

  const questions = [];
  let currentQ = null;

  for (const p of paragraphs) {
    const qMatch = p.match(/^Вопрос\s+(\d+)[\.\s]+([\s\S]*)$/i);
    if (qMatch) {
      if (currentQ) {
        questions.push(currentQ);
      }
      currentQ = {
        num: parseInt(qMatch[1], 10),
        text: qMatch[2].trim(),
        options: {},
      };
      continue;
    }

    if (currentQ) {
      const optMatch = p.match(/^([A-DА-Яa-dа-я])\)\s*([\s\S]*)$/);
      if (optMatch) {
        let optKey = optMatch[1].toUpperCase();
        if (optKey === 'А') optKey = 'A';
        if (optKey === 'В') optKey = 'B';
        if (optKey === 'С') optKey = 'C';
        if (optKey === 'D' || optKey === 'Д') optKey = 'D';

        currentQ.options[optKey] = optMatch[2].trim();
      } else if (!p.startsWith('A)') && !p.startsWith('B)') && !p.startsWith('C)') && !p.startsWith('D)')) {
        if (Object.keys(currentQ.options).length === 0) {
          currentQ.text += ' ' + p;
        }
      }
    }
  }
  if (currentQ) questions.push(currentQ);

  return { epochNum, epochTitle, questions, tableMap };
}

const EPOCH_CONFIG = {
  1: {
    slug: 'rusadabiyot_lit-teo',
    nameUz: "1-bilet. Adabiyot nazariyasi va adabiy yo'nalishlar",
    nameRu: 'Билет 1. Эпоха 1: Теория литературы и литературные направления',
  },
  2: {
    slug: 'rusadabiyot_lit-drev',
    nameUz: '2-bilet. Qadimgi rus adabiyoti (XI–XVII asrlar)',
    nameRu: 'Билет 2. Эпоха 2: Древнерусская литература (XI–XVII века)',
  },
  3: {
    slug: 'rusadabiyot_lit-xviii',
    nameUz: "3-bilet. XVIII asr rus adabiyoti (Klassitsizm va Ma'rifatparvarlik)",
    nameRu: 'Билет 3. Эпоха 3: Русская литература XVIII века (Классицизм и Просвещение)',
  },
  4: {
    slug: 'rusadabiyot_lit-xix-1',
    nameUz: '4-bilet. XIX asr birinchi yarmi rus adabiyoti (Oltin asr)',
    nameRu: 'Билет 4. Эпоха 4: Русская литература первой половины XIX века (Золотой век)',
  },
  5: {
    slug: 'rusadabiyot_lit-xix-2',
    nameUz: "5-bilet. XIX asr ikkinchi yarmi rus adabiyoti (Realizm cho'qqisi)",
    nameRu: 'Билет 5. Эпоха 5: Русская литература второй половины XIX века (Расцвет реализма)',
  },
  6: {
    slug: 'rusadabiyot_lit-sereb',
    nameUz: "6-bilet. XIX–XX asrlar bo'sag'asi rus adabiyoti va Kumush davr",
    nameRu: 'Билет 6. Эпоха 6: Русская литература рубежа XIX–XX веков и Серебряный век',
  },
  7: {
    slug: 'rusadabiyot_lit-sov',
    nameUz: '7-bilet. Rus sovet adabiyoti (1920–1950-yillar)',
    nameRu: 'Билет 7. Эпоха 7: Русская советская литература 1920–1950-х годов',
  },
  8: {
    slug: 'rusadabiyot_lit-ottepel',
    nameUz: '8-bilet. «Оттепель» davri va XX asr ikkinchi yarmi rus adabiyoti',
    nameRu: 'Билет 8. Эпоха 8: Русская литература периода «оттепели» и второй половины XX века',
  },
  9: {
    slug: 'rusadabiyot_lit-zamonaviy',
    nameUz: '9-bilet. Zamonaviy rus adabiyoti (1990–2020-yillar)',
    nameRu: 'Билет 9. Эпоха 9: Современная русская литература рубежа XX–XXI веков (1990–2020-е годы)',
  },
  10: {
    slug: 'rusadabiyot_lit-jahon',
    nameUz: '10-bilet. Jahon adabiyoti maktab dasturida va jahon konteksti',
    nameRu: 'Билет 10. Эпоха 10: Зарубежная литература в школьной программе и мировой контекст',
  },
  11: {
    slug: 'rusadabiyot_lit-ozbek-sharq',
    nameUz: "11-bilet. O'zbek mumtoz va zamonaviy adabiyoti, Sharq poetikasi",
    nameRu: 'Билет 11. Эпоха 11: Узбекская классическая и современная литература и восточная поэтика',
  },
  12: {
    slug: 'rusadabiyot_lit-metodika',
    nameUz: "12-bilet. Rus tili va adabiyotini o'qitish metodikasi va pedtexnologiyalar",
    nameRu: 'Билет 12. Эпоха 12: Методика преподавания русского языка и литературы и современные педагогические технологии',
  },
};

const dir = 'd:/Desktop/Bot/scripts/docx-extracted';
const files = fs.readdirSync(dir);
const epochsByNum = new Map();

for (const f of files) {
  const data = extractEpochData(path.join(dir, f));
  epochsByNum.set(data.epochNum, data);
}

const topics = [];
const items = [];

for (let ep = 1; ep <= 12; ep++) {
  const epData = epochsByNum.get(ep);
  if (!epData) {
    throw new Error(`Missing Epoch ${ep}!`);
  }
  const conf = EPOCH_CONFIG[ep];
  topics.push({
    externalId: conf.slug,
    nameUz: conf.nameUz,
    nameRu: conf.nameRu,
  });

  // sort questions by num
  const sortedQs = [...epData.questions].sort((a, b) => a.num - b.num);
  for (const q of sortedQs) {
    const tableInfo = epData.tableMap.get(q.num);
    if (!tableInfo) {
      throw new Error(`Epoch ${ep} Question ${q.num} has no table info!`);
    }

    const extId = `rusadabiyot_q${String(q.num).padStart(4, '0')}`;
    items.push({
      externalId: extId,
      topicExternalId: conf.slug,
      questionUz: q.text,
      questionRu: q.text,
      optionsUz: q.options,
      optionsRu: q.options,
      correctAnswer: tableInfo.answer,
      explanationUz: tableInfo.explanation,
      explanationRu: tableInfo.explanation,
      source: `KIVVI TA'LIM • АКАДЕМИЧЕСКИЙ КУРС • Эпоха ${ep}`,
      image: null,
      difficulty: 'orta',
      topicAspect: tableInfo.topic,
    });
  }
}

const bankFile = {
  version: 1,
  subjectId: 'rusadabiyot',
  bankId: 'rusadabiyot_db',
  bankName: 'Rus adabiyoti savollar bazasi',
  topics,
  items,
};

const outDir = 'd:/Desktop/Bot/content-banks/rusadabiyot';
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}
const outPath = path.join(outDir, 'bank.json');
fs.writeFileSync(outPath, JSON.stringify(bankFile, null, 2), 'utf8');

console.log(`✅ bank.json successfully created!`);
console.log(`   Topics: ${topics.length}`);
console.log(`   Items: ${items.length}`);
console.log(`   Path: ${outPath}`);
console.log(`   File size: ${(fs.statSync(outPath).size / 1024).toFixed(1)} KB`);
