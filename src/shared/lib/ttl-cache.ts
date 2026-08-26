/**
 * TTL kesh (SWR — stale-while-revalidate).
 *
 * Nima uchun: Dashboard/LeaguePreview kabi komponentlar HAR mount'da yangi
 * so'rov kutib skelet ko'rsatardi. Endi keshdagi ma'lumot DARHOL chiziladi,
 * yangilanish esa orqa fonda yuradi.
 *
 * PERSIST (`persistKey`) — Telegram Mini App uchun SHART. Faqat xotiradagi
 * kesh sessiya davomida ishlaydi, lekin Mini App HAR ochilishda sahifani
 * qaytadan yuklaydi, ya'ni xotira kesh boot'da doim BO'SH bo'ladi va user
 * har safar skelet ko'rardi. localStorage'ga yozilgan kesh esa qayta
 * yuklashdan omon qoladi — birinchi kadr o'tgan seansdagi ma'lumot bilan
 * chiziladi, so'ng orqa fonda yangilanadi.
 */

const PREFIX = 'yhq-cache:'

interface PersistOptions {
  /** localStorage kaliti (PREFIX avtomatik qo'shiladi). Yo'q bo'lsa — faqat xotira. */
  persistKey?: string
  /**
   * Persist qilingan yozuv shu muddatdan eski bo'lsa ISHLATILMAYDI (skelet
   * ko'rinadi). TTL'dan farqi: TTL "qayta so'rash kerakmi" degani, bu esa
   * "birinchi kadrda ko'rsatsa bo'ladimi" degani.
   */
  maxAgeMs?: number
}

export interface TtlCache<T> {
  /** Hozirgi qiymat (eski bo'lsa ham) — birinchi kadrni chizish uchun */
  peek(): T | null
  /** Kesh yangimi (TTL ichida)? */
  isFresh(): boolean
  /**
   * Yangi ma'lumotni olib keladi. Parallel chaqiruvlar BITTA tarmoq
   * so'rovini bo'lishadi (inflight dedup). Muvaffaqiyat = kesh yangilanadi.
   */
  fetch(fetcher: () => Promise<T>): Promise<T>
  /** Keshni tozalash (logout/account switch'da) */
  invalidate(): void
}

function readPersisted<T>(key: string, maxAgeMs: number): { data: T; at: number } | null {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { data: T; at: number }
    if (typeof parsed?.at !== 'number' || Date.now() - parsed.at > maxAgeMs) return null
    return parsed
  } catch { return null }
}

export function createTtlCache<T>(ttlMs: number, options: PersistOptions = {}): TtlCache<T> {
  const { persistKey, maxAgeMs = 24 * 3600_000 } = options

  // Boot'da diskdagi yozuv o'qiladi — birinchi kadr skeletsiz chiqishi uchun.
  // `fetchedAt` saqlanadi, ya'ni TTL ham to'g'ri hisoblanadi: eski yozuv
  // ko'rsatiladi-yu, darhol qayta so'raladi (SWR).
  const restored = persistKey ? readPersisted<T>(persistKey, maxAgeMs) : null
  let data: T | null = restored?.data ?? null
  let fetchedAt = restored?.at ?? 0
  let inflight: Promise<T> | null = null

  const persist = () => {
    if (!persistKey) return
    try {
      localStorage.setItem(PREFIX + persistKey, JSON.stringify({ data, at: fetchedAt }))
    } catch { /* kvota / private mode — kesh ixtiyoriy */ }
  }

  return {
    peek: () => data,
    isFresh: () => data !== null && Date.now() - fetchedAt < ttlMs,
    fetch(fetcher) {
      inflight ??= fetcher()
        .then((fresh) => { data = fresh; fetchedAt = Date.now(); persist(); return fresh })
        .finally(() => { inflight = null })
      return inflight
    },
    invalidate() {
      data = null
      fetchedAt = 0
      if (persistKey) {
        try { localStorage.removeItem(PREFIX + persistKey) } catch { /* ignore */ }
      }
    },
  }
}

/**
 * BARCHA persist qilingan keshlarni o'chiradi — akkaunt almashganda SHART:
 * yozuvlar user-specific (leaderboard `isYou`, kunlik vazifa progressi),
 * umumiy qurilmada oldingi akkaunt ma'lumoti ko'rinib qolardi.
 *
 * Prefiks bo'yicha supuriladi, ro'yxat bo'yicha emas: kesh modullari lazy
 * chunk'larda bo'lishi mumkin va account switch paytida hali import
 * qilinmagan bo'lsa, ro'yxatda ham ko'rinmasdi.
 */
export function invalidateAllPersistedCaches(): void {
  try {
    const doomed: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k?.startsWith(PREFIX)) doomed.push(k)
    }
    doomed.forEach((k) => localStorage.removeItem(k))
  } catch { /* ignore */ }
}
