import type { DbTopic } from '../../shared/api'

export interface ChapterDef {
  id: string
  labelUz: string
  labelRu: string
}

export const SUBJECT_CHAPTERS: Record<string, ChapterDef[]> = {
  fizika: [
    { id: 'all',      labelUz: 'Barchasi',                   labelRu: 'Все' },
    { id: '01',       labelUz: 'Kinematika',                 labelRu: 'Кинематика' },
    { id: '02',       labelUz: 'Dinamika va Statika',        labelRu: 'Динамика и статика' },
    { id: '03',       labelUz: 'Saqlanish qonunlari',        labelRu: 'Законы сохранения' },
    { id: '04',       labelUz: 'Molekulyar fizika',          labelRu: 'Молекулярная физика' },
    { id: '05',       labelUz: 'Elektrostatika',             labelRu: 'Электростатика' },
    { id: '06',       labelUz: "O'zgarmas tok",              labelRu: 'Постоянный ток' },
    { id: '07',       labelUz: 'Magnetizm',                  labelRu: 'Магнетизм' },
    { id: '08',       labelUz: "Tebranishlar va to'lqinlar", labelRu: 'Колебания и волны' },
    { id: '09',       labelUz: 'Optika',                     labelRu: 'Оптика' },
    { id: '10',       labelUz: 'Atom va yadro',              labelRu: 'Атомная и ядерная физика' },
    { id: 'variants', labelUz: 'Umumiy variantlar',          labelRu: 'Общие варианты' },
  ],
  ingliz: [
    { id: 'all',    labelUz: 'Barchasi',          labelRu: 'Все' },
    { id: 'pre-a1', labelUz: 'Pre-A1 (Starter)',   labelRu: 'Pre-A1 (Начальный)' },
    { id: 'a1',     labelUz: 'A1 (Beginner)',     labelRu: 'A1 (Элементарный)' },
    { id: 'a2',     labelUz: 'A2 (Elementary)',   labelRu: 'A2 (Базовый)' },
    { id: 'b1',     labelUz: 'B1 (Intermediate)', labelRu: 'B1 (Средний)' },
    { id: 'b2',     labelUz: 'B2 (Upper-Int)',    labelRu: 'B2 (Выше среднего)' },
    { id: 'c1',     labelUz: 'C1 (Advanced)',     labelRu: 'C1 (Продвинутый)' },
  ],
  biologiya: [
    { id: 'all',    labelUz: 'Barchasi', labelRu: 'Все' },
    { id: 'bio-5',  labelUz: '5-sinf',   labelRu: '5-класс' },
    { id: 'bio-7',  labelUz: '7-sinf',   labelRu: '7-класс' },
    { id: 'bio-8',  labelUz: '8-sinf',   labelRu: '8-класс' },
    { id: 'bio-9',  labelUz: '9-sinf',   labelRu: '9-класс' },
    { id: 'bio-10', labelUz: '10-sinf',  labelRu: '10-класс' },
    { id: 'bio-11', labelUz: '11-sinf',  labelRu: '11-класс' },
  ],
  kimyo: [
    { id: 'all',      labelUz: 'Barchasi', labelRu: 'Все' },
    { id: 'kimyo-7',  labelUz: '7-sinf',   labelRu: '7-класс' },
    { id: 'kimyo-8',  labelUz: '8-sinf',   labelRu: '8-класс' },
    { id: 'kimyo-9',  labelUz: '9-sinf',   labelRu: '9-класс' },
    { id: 'kimyo-10', labelUz: '10-sinf',  labelRu: '10-класс' },
    { id: 'kimyo-11', labelUz: '11-sinf',  labelRu: '11-класс' },
  ],
  geografiya: [
    { id: 'all',    labelUz: 'Barchasi', labelRu: 'Все' },
    { id: 'geo-5',  labelUz: '5-sinf',   labelRu: '5-класс' },
    { id: 'geo-6',  labelUz: '6-sinf',   labelRu: '6-класс' },
    { id: 'geo-7',  labelUz: '7-sinf',   labelRu: '7-класс' },
    { id: 'geo-8',  labelUz: '8-sinf',   labelRu: '8-класс' },
    { id: 'geo-9',  labelUz: '9-sinf',   labelRu: '9-класс' },
    { id: 'geo-10', labelUz: '10-sinf',  labelRu: '10-класс' },
  ],
  tarix: [
    { id: 'all',      labelUz: 'Barchasi', labelRu: 'Все' },
    { id: 'tarix-6',  labelUz: '6-sinf',   labelRu: '6-класс' },
    { id: 'tarix-7',  labelUz: '7-sinf',   labelRu: '7-класс' },
    { id: 'tarix-8',  labelUz: '8-sinf',   labelRu: '8-класс' },
    { id: 'tarix-9',  labelUz: '9-sinf',   labelRu: '9-класс' },
    { id: 'tarix-10', labelUz: '10-sinf',  labelRu: '10-класс' },
    { id: 'tarix-11', labelUz: '11-sinf',  labelRu: '11-класс' },
  ],
  onatili: [
    { id: 'all', labelUz: 'Barchasi',          labelRu: 'Все' },
    { id: 'fon', labelUz: 'Fonetika',          labelRu: 'Фонетика' },
    { id: 'orf', labelUz: 'Orfoepiya',         labelRu: 'Орфоэпия' },
    { id: 'iml', labelUz: 'Imlo',              labelRu: 'Орфография' },
    { id: 'lek', labelUz: 'Leksika',           labelRu: 'Лексика' },
    { id: 'mor', labelUz: 'Morfologiya',       labelRu: 'Морфология' },
    { id: 'sin', labelUz: 'Sintaksis',         labelRu: 'Синтаксис' },
    { id: 'pun', labelUz: 'Tinish belgilari',  labelRu: 'Пунктуация' },
    { id: 'usl', labelUz: 'Uslubiyat',         labelRu: 'Стилистика' },
    { id: 'mat', labelUz: 'Matn va nutq',      labelRu: 'Текст и речь' },
  ],
  adabiyot: [
    { id: 'all', labelUz: 'Barchasi',          labelRu: 'Все' },
    { id: 'xoi', labelUz: 'Folklor',           labelRu: 'Фольклор' },
    { id: 'qad', labelUz: 'Qadimgi',           labelRu: 'Древняя' },
    { id: 'mum', labelUz: 'Mumtoz',            labelRu: 'Классическая' },
    { id: 'xix', labelUz: 'XVII–XIX asr',      labelRu: 'XVII–XIX вв.' },
    { id: 'jad', labelUz: 'Jadid',             labelRu: 'Джадидская' },
    { id: 'xx',  labelUz: 'XX asr',            labelRu: 'XX век' },
    { id: 'mus', labelUz: 'Istiqlol',          labelRu: 'Независимость' },
    { id: 'jah', labelUz: 'Jahon adabiyoti',   labelRu: 'Мировая' },
    { id: 'naz', labelUz: 'Nazariya',          labelRu: 'Теория' },
    { id: 'san', labelUz: 'Badiiy san’at',     labelRu: 'Изобразительные' },
    { id: 'msr', labelUz: 'Sertifikat',        labelRu: 'Сертификат' },
  ],
  matematika: [
    { id: 'all',           labelUz: 'Barchasi',      labelRu: 'Все' },
    { id: 'algebra',       labelUz: 'Algebra',       labelRu: 'Алгебра' },
    { id: 'geometriya',    labelUz: 'Geometriya',    labelRu: 'Геометрия' },
    { id: 'kombinatorika', labelUz: 'Kombinatorika', labelRu: 'Комбинаторика' },
  ],
  rustili: [
    { id: 'all',      labelUz: 'Barchasi',             labelRu: 'Все' },
    { id: 'rus-fon',  labelUz: 'Fonetika va grafika',  labelRu: 'Фонетика' },
    { id: 'rus-lek',  labelUz: 'Leksikologiya',        labelRu: 'Лексикология' },
    { id: 'rus-morz', labelUz: 'So‘z yasalishi',       labelRu: 'Словообразование' },
    { id: 'rus-orf',  labelUz: 'Orfografiya',          labelRu: 'Орфография' },
    { id: 'rus-mor',  labelUz: 'Morfologiya',          labelRu: 'Морфология' },
    { id: 'rus-lit',  labelUz: 'Rus adabiyoti',        labelRu: 'Литература' },
  ],
}

const CHAPTER_WEIGHTS: Record<string, number> = {
  // onatili
  fon: 1, orf: 2, iml: 3, lek: 4, mor: 5, sin: 6, pun: 7, usl: 8, mat: 9,
  // adabiyot
  xoi: 1, qad: 2, mum: 3, xix: 4, jad: 5, xx: 6, mus: 7, jah: 8, naz: 9, san: 10, msr: 11,
  // matematika
  algebra: 1, geometriya: 2, kombinatorika: 3,
  // ingliz
  'pre-a1': 0, a1: 1, a2: 2, b1: 3, b2: 4, c1: 5,
  // rustili
  'rus-fon': 1, 'rus-lek': 2, 'rus-morz': 3, 'rus-orf': 4, 'rus-mor': 5, 'rus-lit': 6,
}

export function getTopicChapterId(subjectId: string, slug?: string, nameUz?: string): string {
  const s = slug || ''
  const n = nameUz || ''

  if (subjectId === 'fizika') {
    const m = s.match(/ftp-(\d{2})/i)
    if (m) {
      const code = m[1]
      if (code === '11' || code === '12') return 'variants'
      return code
    }
    if (/^Kinematika/i.test(n)) return '01'
    if (/^Dinamika/i.test(n)) return '02'
    if (/^Saqlanish/i.test(n)) return '03'
    if (/^Molekulyar/i.test(n)) return '04'
    if (/^Elektrostatika/i.test(n)) return '05'
    if (/^(?:O['`’]zgarmas|Ozgangas)/i.test(n)) return '06'
    if (/^Turli/i.test(n)) return '07'
    if (/^Tebranish/i.test(n)) return '08'
    if (/^Optika/i.test(n)) return '09'
    if (/^(?:Kvant|Atom)/i.test(n)) return '10'
    if (/^Variant/i.test(n)) return 'variants'
    return 'other'
  }

  if (subjectId === 'ingliz') {
    if (s.includes('kids') || n.includes('[Pre-A1]')) return 'pre-a1'
    if (s.includes('a1') || n.includes('[A1]')) return 'a1'
    if (s.includes('a2') || n.includes('[A2]')) return 'a2'
    if (s.includes('b1') || n.includes('[B1]')) return 'b1'
    if (s.includes('b2') || n.includes('[B2]')) return 'b2'
    if (s.includes('c1') || n.includes('[C1]')) return 'c1'
    return 'other'
  }

  if (subjectId === 'biologiya') {
    const m = s.match(/bio_?(\d+)/i) || n.match(/Biologiya-(\d+)/i)
    if (m) return `bio-${m[1]}`
    return 'other'
  }

  if (subjectId === 'kimyo') {
    const m = s.match(/kimyo_(\d+)/i) || n.match(/^(\d+)-sinf/i)
    if (m) return `kimyo-${m[1]}`
    return 'other'
  }

  if (subjectId === 'geografiya') {
    const m = s.match(/geo_?(\d+)/i) || n.match(/Geografiya-(\d+)/i)
    if (m) return `geo-${m[1]}`
    return 'other'
  }

  if (subjectId === 'tarix') {
    const m = s.match(/tarix_(\d+)/i) || s.match(/(\d+)jahon/i) || n.match(/(\d+)-sinf/i)
    if (m) return `tarix-${m[1]}`
    return 'other'
  }

  if (subjectId === 'onatili') {
    const m = s.match(/(?:^|[-_])(fon|orf|iml|lek|mor|sin|pun|usl|mat)(?:[-_]|$)/i)
    if (m) return m[1].toLowerCase()
    return 'other'
  }

  if (subjectId === 'adabiyot') {
    const m = s.match(/(?:^|[-_])(xoi|qad|mum|xix|jad|xx|mus|jah|naz|san|msr)(?:[-_]|$)/i)
    if (m) return m[1].toLowerCase()
    return 'other'
  }

  if (subjectId === 'matematika') {
    const m = s.match(/mtp-([a-z]+)/i) || n.match(/^(Algebra|Geometriya|Kombinatorika)/i)
    if (m) return m[1].toLowerCase()
    return 'other'
  }

  if (subjectId === 'rustili') {
    if (s.includes('fonetika')) return 'rus-fon'
    if (s.includes('leksika')) return 'rus-lek'
    if (s.includes('morfemika')) return 'rus-morz'
    if (s.includes('orfografiya')) return 'rus-orf'
    if (s.includes('morfologiya')) return 'rus-mor'
    if (s.includes('literatura')) return 'rus-lit'
    return 'other'
  }

  return 'other'
}

function parseTopicNumber(str?: string): number {
  if (!str) return 0
  const m = str.match(/(?:_m|m|p|-)(\d+)/i) || str.match(/(\d+)-mavzu/i) || str.match(/(\d+)-§/i)
  return m ? parseInt(m[1], 10) : 0
}

function parseClassNumber(chId: string): number {
  const m = chId.match(/(?:bio|kimyo|geo|tarix)-(\d+)/i)
  return m ? parseInt(m[1], 10) : 99
}

export function sortTopicsForTickets(subjectId: string, topics: DbTopic[]): DbTopic[] {
  if (subjectId === 'fizika') {
    return [...topics].sort((a, b) => {
      const ma = a.slug?.match(/ftp-(\d+)-(\d+)/)
      const mb = b.slug?.match(/ftp-(\d+)-(\d+)/)
      if (ma && mb) {
        const na = parseInt(ma[1], 10) * 1000 + parseInt(ma[2], 10)
        const nb = parseInt(mb[1], 10) * 1000 + parseInt(mb[2], 10)
        return na - nb
      }
      return a.id - b.id
    })
  }

  return [...topics].sort((a, b) => {
    const ca = getTopicChapterId(subjectId, a.slug, a.nameUz)
    const cb = getTopicChapterId(subjectId, b.slug, b.nameUz)

    // 1. Sinflar bo'yicha (biologiya, kimyo, geografiya, tarix)
    if (
      ca.includes('-') &&
      cb.includes('-') &&
      (subjectId === 'biologiya' || subjectId === 'kimyo' || subjectId === 'geografiya' || subjectId === 'tarix')
    ) {
      const na = parseClassNumber(ca)
      const nb = parseClassNumber(cb)
      if (na !== nb) return na - nb
    }

    // 2. Vazn bo'yicha (onatili, adabiyot, matematika, ingliz, rustili)
    const wa = CHAPTER_WEIGHTS[ca] ?? 99
    const wb = CHAPTER_WEIGHTS[cb] ?? 99
    if (wa !== wb) return wa - wb

    // 3. Bir xil bo'lim ichida tartib raqami bo'yicha
    const numA = parseTopicNumber(a.slug || a.nameUz)
    const numB = parseTopicNumber(b.slug || b.nameUz)
    if (numA !== numB) return numA - numB

    return a.id - b.id
  })
}
