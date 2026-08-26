/**
 * In-memory TTL kesh (SWR — stale-while-revalidate).
 *
 * Nima uchun: Dashboard/LeaguePreview kabi komponentlar HAR mount'da yangi
 * so'rov kutib skelet ko'rsatardi. Endi keshdagi ma'lumot DARHOL chiziladi,
 * yangilanish esa orqa fonda yuradi — sahifa qayta ochilganda "miltillash" yo'q.
 * Session davomida yashaydi (page reload'da tozalanadi — bu kutilgan xatti-harakat).
 */

export interface TtlCache<T> {
  /** Hozirgi qiymat (eski bo'lsa ham) — birinchi kadri chizish uchun */
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

export function createTtlCache<T>(ttlMs: number): TtlCache<T> {
  let data: T | null = null
  let fetchedAt = 0
  let inflight: Promise<T> | null = null

  return {
    peek: () => data,
    isFresh: () => data !== null && Date.now() - fetchedAt < ttlMs,
    fetch(fetcher) {
      inflight ??= fetcher()
        .then((fresh) => { data = fresh; fetchedAt = Date.now(); return fresh })
        .finally(() => { inflight = null })
      return inflight
    },
    invalidate() { data = null; fetchedAt = 0 },
  }
}
