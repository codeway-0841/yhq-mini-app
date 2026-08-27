import { create } from 'zustand'
import { api, dbToQuestion, DbQuestion, DbTopic, Question } from '../api'
import { useSubjectStore } from './useSubjectStore'

interface QuestionsState {
  questions: Question[]
  topics:    DbTopic[]
  loaded:    boolean
  loading:   boolean
  error:     string | null
  /** Language the currently mapped questions are in. */
  lang:      'uz' | 'ru'
  /** Qaysi fan uchun yuklangan (subject almashganda qayta yuklanadi). */
  subjectId: string
  /**
   * Oxirgi urinish YIQILGAN kalit ('<subject>::<lang>').
   *
   * Sahifalar `!loaded && !loading` shartida load() chaqiradi. Xatoda ikkala
   * flag ham false qoladi, ya'ni effekt darhol qayta ishga tushib CHEKSIZ
   * SIKL hosil qilardi. Server esa butun bankni bir IP dan kuniga 20 marta
   * beradi (questions.router.ts FULL_BANK_DAILY_CAP) — sikl shu limitni bir
   * necha soniyada yeb, 429 + 24 soatlik blok keltirardi va sahifa
   * "yuklanmoqda"da muzlab qolardi.
   */
  failedKey: string | null
  load:      (lang: 'uz' | 'ru', subjectId?: string) => Promise<void>
  /** Foydalanuvchi BOSGANDA qayta urinish — avtomatik takror emas. */
  retry:     () => Promise<void>
  /** Admin CRUD'dan keyin cache'dan qat'iatan qayta yuklash (force) */
  reload:    () => Promise<void>
  /** Re-map already-fetched questions to another language — no network call. */
  setLang:   (lang: 'uz' | 'ru') => void
}

// Raw (til-mapping'siz) PUBLIC savollar — language switch'da re-fetch'siz
// qayta map qilish uchun. correctAnswer bu yerda YO'Q (server strip qiladi).
let rawQuestions: DbQuestion[] = []
let loadVersion = 0
// Uchib ketayotgan load() — AYNI (lang, subject) uchun ikkinchi so'rovni
// bloklaydi. Boot'da load() ikki marta chaqiriladi (App.tsx: keshdagi til
// bilan ERTA + profil kelgach tasdiq) — guard bo'lmasa `loaded` hali false
// bo'lgani uchun ikkala chaqiruv ham tarmoqqa chiqardi.
let inFlight: { key: string; promise: Promise<void> } | null = null

// Fan bo'yicha savollar SONI — diskda saqlanadi.
//
// Nima uchun: savollar endi boot'ni bloklamaydi (perf), ya'ni Dashboard
// `questions.length === 0` bilan mount bo'ladi. ProgressCard undan foizni
// hisoblagani uchun birinchi kadrda "0%" va "37 / …" ko'rinardi, so'ng
// ma'lumot kelgach 51% ga sakrardi. Faqat SON saqlanadi (bir nechta bayt) —
// savollarning o'zi emas.
const COUNT_KEY = 'yhq-qcount'

function readCounts(): Record<string, number> {
  try {
    const raw = localStorage.getItem(COUNT_KEY)
    return raw ? (JSON.parse(raw) as Record<string, number>) : {}
  } catch { return {} }
}

/** Oxirgi ma'lum savollar soni — savollar yuklanguncha ishlatiladi. */
export function cachedQuestionCount(subjectId: string): number {
  const n = readCounts()[subjectId]
  return typeof n === 'number' && n > 0 ? n : 0
}

function writeCount(subjectId: string, count: number): void {
  if (count <= 0) return
  try {
    localStorage.setItem(COUNT_KEY, JSON.stringify({ ...readCounts(), [subjectId]: count }))
  } catch { /* kvota — kesh ixtiyoriy */ }
}

export const useQuestionsStore = create<QuestionsState>((set, get) => ({
  questions: [],
  topics:    [],
  loaded:    false,
  loading:   false,
  error:     null,
  lang:      'uz',
  subjectId: useSubjectStore.getState().subjectId || 'yhq',
  failedKey: null,

  async load(lang, subjectId) {
    const sid = subjectId ?? useSubjectStore.getState().subjectId ?? get().subjectId
    // Shu til + shu fan allaqachon yuklangan
    if (get().loaded && get().lang === lang && get().subjectId === sid) return
    // Ayni so'rov hozir uchib ketmoqda — uni qaytaramiz (takroriy fetch yo'q)
    const key = `${sid}::${lang}`
    if (inFlight?.key === key) return inFlight.promise

    // Shu FAN allaqachon tortilgan, faqat TIL boshqa — butun bankni qayta
    // tortish shart emas, xom javob saqlangan va lokal qayta map qilinadi.
    // (Boot'da kesh tili bilan erta yuklaymiz, profil boshqa til qaytarsa
    //  ilgari shu yerda ikkinchi to'liq fetch ketardi — kunlik limitni ikki
    //  barobar tez yeydi.)
    // `loaded` sharti MUHIM: `rawQuestions` modul darajasida yashaydi, store
    // holati esa tozalanishi mumkin — u holda eskirgan xom keshdan xizmat
    // qilib qo'ymasligimiz kerak.
    if (get().loaded && rawQuestions.length > 0 && get().subjectId === sid) {
      set({ questions: rawQuestions.map((q) => dbToQuestion(q, lang)), lang, loaded: true, error: null, failedKey: null })
      return
    }

    // Oxirgi urinish shu kalitda yiqilgan — AVTOMATIK takrorlamaymiz.
    // Qayta urinish faqat retry() orqali (foydalanuvchi bosganda).
    if (get().failedKey === key) return

    const version = ++loadVersion
    set({ loading: true, error: null })
    const run = (async () => {
      try {
        const [raw, topics] = await Promise.all([api.getQuestions(sid), api.getTopics(sid)])
        if (version !== loadVersion) return
        rawQuestions = raw
        writeCount(sid, raw.length)
        set({ questions: raw.map((q) => dbToQuestion(q, lang)), topics, loaded: true, lang, subjectId: sid, failedKey: null })
      } catch (e) {
        if (version === loadVersion) {
          set({
            error: e instanceof Error ? e.message : 'Failed to load questions',
            failedKey: key,
          })
        }
      } finally {
        if (version === loadVersion) set({ loading: false })
        if (inFlight?.key === key) inFlight = null
      }
    })()
    inFlight = { key, promise: run }
    return run
  },

  async retry() {
    set({ failedKey: null, error: null })
    const { lang, subjectId } = get()
    await get().load(lang, subjectId)
  },

  async reload() {
    const { lang, subjectId } = get()
    // load() dan FARQLI: cache-bust bilan — admin CRUD'dan keyingi stale
    // CDN/browser javobini chetlab o'tish uchun
    set({ loading: true, error: null })
    try {
      const [raw, topics] = await Promise.all([
        api.getQuestions(subjectId, true),
        api.getTopics(subjectId, true),
      ])
      rawQuestions = raw
      writeCount(subjectId, raw.length)
      set({ questions: raw.map((q) => dbToQuestion(q, lang)), topics, loaded: true, lang, subjectId, failedKey: null })
    } catch (e) {
      set({ error: e instanceof Error ? e.message : 'Failed to reload questions' })
    } finally {
      set({ loading: false })
    }
  },

  setLang(lang) {
    if (get().lang === lang) return
    if (rawQuestions.length === 0) { void get().load(lang); return }
    set({ questions: rawQuestions.map((q) => dbToQuestion(q, lang)), lang, loaded: true })
  },
}))
