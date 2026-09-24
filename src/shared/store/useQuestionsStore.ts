import { create } from 'zustand'
import { api, dbToQuestion, DbQuestion, DbTopic, Question } from '../api'
import { config } from '../config'
import { useSubjectStore } from './useSubjectStore'
import { readBankCache, writeBankCache } from '../lib/question-bank-cache'
import { loadSubjectBankR2 } from '../lib/r2-question-bank'
import { track } from '../lib/analytics'

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
  /** Faqat mavzu metadata (v2 katalog sahifalari) — savol matni tortmaydi.
   *  Xatoda throw (sahifa local error ko'rsatadi; legacy error/failedKey
   *  oqimiga tegmaydi). */
  loadTopics: (subjectId?: string) => Promise<void>
  /** Foydalanuvchi BOSGANDA qayta urinish — avtomatik takror emas. */
  retry:     (lang?: 'uz' | 'ru', subjectId?: string) => Promise<void>
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
        // A: PERSIST KESH (EGRESS 2026-09-21) — server versiyasi bir xil bo'lsa
        // bankni QAYTA TORTMAYMIZ (IndexedDB'dan o'qiymiz, tarmoqda faqat ~40
        // baytlik versiya so'rovi). Versiya so'rovi yiqilsa (offline) kesh bor
        // bo'lsa shu bilan yashaymiz, bo'lmasa avvalgidek to'liq fetch.
        const [cachedBank, serverInfo] = await Promise.all([
          // Modul o'zi throw qilmaydi, lekin qo'shimcha himoya — kesh xatosi
          // HECH QACHON bank yuklashni to'xtatmasligi kerak (kesh = ixtiyoriy).
          readBankCache(sid).catch(() => null),
          api.getQuestionsVersion(sid).catch(() => null),
        ])
        if (version !== loadVersion) return

        // R2/Worker yo'li (BARCHA fanlar): FAQAT flag ON + server shu fan uchun
        // r2v bergan bo'lsa (r2v = per-fan gate: publish qilinmagan fan legacy
        // yo'lda qoladi). r2v yo'qolsa (flag o'chiq/publish yo'q) — legacy yo'l
        // (server-side kill switch). Kesh kaliti: R2 yozuvlari 'r2:' prefiksli
        // (Neon counter bilan aralashmasin — u BOSHQA hisoblagich), legacy
        // yozuvlar esa eski formatda qoladi (mavjud keshlar bekor bo'lmaydi).
        const r2Active = Boolean(
          config.r2QuestionBank && typeof serverInfo?.r2v === 'string',
        )
        const expectedV = r2Active ? `r2:${serverInfo!.r2v as string}` : (serverInfo?.v ?? null)

        if (cachedBank && (expectedV === null || cachedBank.v === expectedV)) {
          rawQuestions = cachedBank.raw
          writeCount(sid, cachedBank.raw.length)
          set({ questions: cachedBank.raw.map((q) => dbToQuestion(q, lang)), topics: cachedBank.topics, loaded: true, lang, subjectId: sid, failedKey: null, error: null })
          return
        }

        // Bankni tortish — R2 yo'li xato bersa TELEMETRY + legacy fallback
        // (hech qachon jim abadiy fallback emas: qbank_r2_fallback o'lchanadi).
        let usedV: string | null = null
        const loadRaw = async (): Promise<DbQuestion[]> => {
          if (r2Active) {
            try {
              const raw = await loadSubjectBankR2(sid, serverInfo!.r2v as string)
              usedV = expectedV
              return raw
            } catch (err) {
              track('qbank_r2_fallback', {
                subjectId: sid,
                reason: err instanceof Error ? err.message.slice(0, 80) : 'unknown',
              })
              // Fallback: legacy endpoint (correctAnswer'siz, CDN) — kontent
              // yo'qolmaydi, faqat manba almashinadi.
              const raw = await api.getQuestions(sid)
              usedV = serverInfo?.v ?? null
              return raw
            }
          }
          const raw = await api.getQuestions(sid)
          usedV = serverInfo?.v ?? null
          return raw
        }

        const [raw, topics] = await Promise.all([loadRaw(), api.getTopics(sid)])
        if (version !== loadVersion) return
        rawQuestions = raw
        writeCount(sid, raw.length)
        // Versiya ma'lum bo'lsagina keshlaymiz — noma'lum versiyali kesh keyingi
        // launch'da "o'zgargan" deb qayta tortilishga olib kelardi.
        if (usedV) void writeBankCache({ subjectId: sid, v: usedV, raw, topics })
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

  async retry(lang, subjectId) {
    const targetLang = lang ?? get().lang
    const targetSubject = subjectId ?? get().subjectId
    set({ failedKey: null, error: null })
    await get().load(targetLang, targetSubject)
  },

  async loadTopics(subjectId) {
    const sid = subjectId ?? useSubjectStore.getState().subjectId ?? get().subjectId
    // Shu fan mavzulari allaqachon bor — qayta fetch yo'q
    if (get().subjectId === sid && get().topics.length > 0) return
    const topics = await api.getTopics(sid)
    // Fan almashgan bo'lsa questions eskirgan — keyingi load() subject
    // mismatch guard orqali qayta tortadi. Topics esa joriy fan uchun yangi.
    set({ topics, subjectId: sid })
  },

  async reload() {
    const { lang, subjectId } = get()
    // load() dan FARQLI: cache-bust bilan — admin CRUD'dan keyingi stale
    // CDN/browser javobini chetlab o'tish uchun
    set({ loading: true, error: null })
    try {
      const [raw, topics, serverV] = await Promise.all([
        api.getQuestions(subjectId, true),
        api.getTopics(subjectId, true),
        api.getQuestionsVersion(subjectId).then((r) => r.v).catch(() => null),
      ])
      rawQuestions = raw
      writeCount(subjectId, raw.length)
      // Yangi kontent + yangi versiya — persist keshni ham yangilab qo'yamiz
      if (serverV) void writeBankCache({ subjectId, v: serverV, raw, topics })
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
