/**
 * CamAi — SOF o'yin logikasi (UI'dan ajratilgan, deterministik test qilinadi).
 * `rand` inject qilinadi (default Math.random) — testlar seeded rand bilan.
 *
 * CLIENT-ONLY: yuzlar FAQAT brauzerda aniqlanadi (MediaPipe, video qurilmadan
 * chiqmaydi), biometrik ma'lumot saqlanmaydi — slotlar anonim ("O'quvchi N").
 */

/** Normallashtirilgan (0..1) yuz ramkasi — video o'lchamiga nisbatan. */
export interface FaceBox {
  x: number
  y: number
  width: number
  height: number
}

/** Anonim o'quvchi sloti — kadr davomida yuzni kuzatib boradi. */
export interface Slot {
  id: number
  box: FaceBox
  /** Ketma-ket nechta kadrda bu slotga mos yuz topilmagani (yo'qolish tolerant). */
  missed: number
}

export interface CamAiQuestion {
  id: string
  text: string
  /** Variantlar (bank savollari); bo'sh massiv = erkin og'zaki javob (custom). */
  options: string[]
  image: string | null
  /** Kutilgan javob (FAQAT custom savollar; bank'da kalit serverdan chiqmaydi —
   *  scoring trust boundary). O'qituvchi ko'rishi uchun, yashirin toggle ortida. */
  answer: string | null
}

/** Bir vaqtning o'zida kuzatiladigan maksimal slot — sinf sig'imi (30-40 o'quvchi). */
export const MAX_SLOTS = 40
/** Slot shu qadar kadr davomida ko'rinmasa — o'chirib yuboriladi (~1.5s @20fps).
 *  KAMERA AYLANTIRISH rejimi: o'qituvchi kamerani sinf bo'ylab sekin aylantirganda
 *  kadrdan chiqqan yuzlar slotda QOLADI — shu bilan 40 tagacha o'quvchi yig'iladi. */
export const MISS_TOLERANCE = 30
/** Yuz markazi shu masofada (normallashtirilgan) bo'lsa — o'sha slot davomi. */
export const MATCH_MAX_DIST = 0.15

function center(b: FaceBox): { cx: number; cy: number } {
  return { cx: b.x + b.width / 2, cy: b.y + b.height / 2 }
}

function dist(a: FaceBox, b: FaceBox): number {
  const pa = center(a)
  const pb = center(b)
  return Math.hypot(pa.cx - pb.cx, pa.cy - pb.cy)
}

export interface MatchResult {
  slots: Slot[]
  nextId: number
}

/**
 * Kadrda aniqlangan yuzlarni mavjud slotlarga bog'laydi (eng yaqin markaz).
 * Bir yuz — bir slot; bir slotga bir kadrda faqat bitta yuz yoziladi.
 * Mos kelmagan slotlar `missed` oshadi, tolerance'dan oshsa o'chadi.
 */
export function matchDetectionsToSlots(
  prev: readonly Slot[],
  boxes: readonly FaceBox[],
  nextId: number,
): MatchResult {
  const slots = prev.map((s) => ({ ...s, missed: s.missed + 1 }))
  let id = nextId

  for (const box of boxes) {
    // Eng yaqin, hali bu kadrda band qilinmagan slot
    let bestIdx = -1
    let bestDist = MATCH_MAX_DIST
    for (let i = 0; i < slots.length; i++) {
      if (slots[i].missed === 0) continue // bu kadrda allaqachon yangilangan
      const d = dist(slots[i].box, box)
      if (d < bestDist) {
        bestDist = d
        bestIdx = i
      }
    }
    if (bestIdx >= 0) {
      slots[bestIdx] = { ...slots[bestIdx], box, missed: 0 }
    } else if (slots.length < MAX_SLOTS) {
      slots.push({ id: id++, box, missed: 0 })
    }
  }

  return { slots: slots.filter((s) => s.missed <= MISS_TOLERANCE), nextId: id }
}

export function shuffled<T>(arr: readonly T[], rand: () => number = Math.random): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** Savol navbati: aralashtirilgan `count` ta savol (savollar kam bo'lsa — hammasi). */
export function buildQuestionQueue<T>(questions: readonly T[], count: number, rand: () => number = Math.random): T[] {
  return shuffled(questions, rand).slice(0, Math.max(0, Math.min(count, questions.length)))
}

/**
 * CHEKSIZ deck: deck'dan bitta savol oladi; deck tugasa — pool'dan yangi
 * aralashtirilgan deck ochadi (`lastId` takrorlanmasligi uchun chiqarib tashlanadi,
 * pool'da 1 ta savol bo'lsa bunday filtr qo'llanmaydi — cheksizlik kafolati).
 */
export function drawNext<T extends { id: string }>(
  pool: readonly T[],
  deck: readonly T[],
  lastId: string | null,
  rand: () => number = Math.random,
): { question: T | null; deck: T[] } {
  let d = [...deck]
  if (d.length === 0) {
    const src = lastId && pool.length > 1 ? pool.filter((q) => q.id !== lastId) : pool
    d = shuffled(src, rand)
  }
  if (d.length === 0) return { question: null, deck: [] }
  return { question: d[0], deck: d.slice(1) }
}

export interface RoulettePlan {
  /** G'olib slot indeksi (slots massividagi tartib). */
  winner: number
  /** Ruletka animatsiyasi uchun ketma-ket yoritiladigan indekslar. */
  sequence: number[]
}

/**
 * Ruletka rejasi: tasodifiy boshlanish nuqtasidan 2 to'liq aylana + g'olibgacha.
 * slotCount = 0 bo'lsa — null (tanlash mumkin emas).
 */
export function roulettePlan(slotCount: number, rand: () => number = Math.random): RoulettePlan | null {
  if (slotCount <= 0) return null
  const start = Math.floor(rand() * slotCount)
  const winner = Math.floor(rand() * slotCount)
  const rounds = slotCount > 4 ? 2 : 3 // kam slotda ko'proq aylana — effekt saqlansin
  const offset = (winner - start + slotCount) % slotCount
  const total = rounds * slotCount + offset + 1
  const sequence: number[] = []
  for (let i = 0; i < total; i++) sequence.push((start + i) % slotCount)
  return { winner, sequence }
}

/** Slot statistikasi — reyting uchun ikkala hisob ham kerak. */
export interface SlotStats {
  correct: number
  wrong: number
}

/** Baho yozish: to'g'ri = correct+1, xato = wrong+1 (salbiy ball yo'q). */
export function applyMark(
  stats: Readonly<Record<number, SlotStats>>,
  slotId: number,
  correct: boolean,
): Record<number, SlotStats> {
  const prev = stats[slotId] ?? { correct: 0, wrong: 0 }
  return {
    ...stats,
    [slotId]: correct ? { ...prev, correct: prev.correct + 1 } : { ...prev, wrong: prev.wrong + 1 },
  }
}

export interface RankEntry {
  slotId: number
  correct: number
  wrong: number
  /** To'g'ri javoblar ulushi 0..100 (javob berilmagan bo'lsa 0). */
  accuracy: number
}

/**
 * Reyting — FAQAT kamida 1 marta javob bergan slotlar.
 * Saralash: ko'p to'g'ri → kam xato → kichik slot id (deterministik).
 */
export function ranking(stats: Readonly<Record<number, SlotStats>>): RankEntry[] {
  return Object.entries(stats)
    .map(([k, v]) => {
      const total = v.correct + v.wrong
      return {
        slotId: Number(k),
        correct: v.correct,
        wrong: v.wrong,
        accuracy: total > 0 ? Math.round((v.correct / total) * 100) : 0,
      }
    })
    .filter((e) => e.correct + e.wrong > 0)
    .sort((a, b) => b.correct - a.correct || a.wrong - b.wrong || a.slotId - b.slotId)
}

/**
 * Custom savollar matnini parse qiladi: har qator — bitta savol.
 * "Savol matni || to'g'ri javob" — `||` dan keyingi qism kutilgan javob
 * (o'qituvchi tez solishtirishi uchun kartada yashirin toggle ortida ko'rinadi).
 * Bo'sh qatorlar tashlab yuboriladi; tartib saqlanadi (aralashtirish keyin).
 */
export function parseCustomQuestions(raw: string): CamAiQuestion[] {
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line, i) => {
      const sep = line.indexOf('||')
      const text = (sep >= 0 ? line.slice(0, sep) : line).trim()
      const answer = sep >= 0 ? line.slice(sep + 2).trim() || null : null
      return { id: `custom-${i}`, text, options: [], image: null, answer }
    })
    .filter((q) => q.text.length > 0)
}

/** Piksel koordinatalaridagi to'g'ri burchak (canvas crop uchun). */
export interface PixelRect {
  x: number
  y: number
  size: number
}

/**
 * G'olib yuzini KATTA ko'rsatish uchun kvadrat crop hududini hisoblaydi.
 * Yuz ramkasi markazidan `padding` marta kengaytirilgan KVADRAT olinadi
 * (bosh + yelka ko'rinishi uchun), kadr chegarasidan tashqariga chiqmaydi.
 * Qaytaradi: source-rect (piksel) yoki null (box yaroqsiz bo'lsa).
 */
export function computeFaceCrop(
  box: FaceBox,
  videoW: number,
  videoH: number,
  padding = 2.0,
): PixelRect | null {
  if (videoW <= 0 || videoH <= 0 || box.width <= 0 || box.height <= 0) return null
  const cx = (box.x + box.width / 2) * videoW
  const cy = (box.y + box.height / 2) * videoH
  // Yuz balandligidan kvadrat tomon (balandlik ancha barqaror o'lchov)
  let size = Math.max(box.width * videoW, box.height * videoH) * padding
  size = Math.min(size, videoW, videoH)
  const x = Math.min(Math.max(cx - size / 2, 0), videoW - size)
  const y = Math.min(Math.max(cy - size / 2, 0), videoH - size)
  return { x: Math.round(x), y: Math.round(y), size: Math.round(size) }
}
