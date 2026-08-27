/**
 * Sentry (backend) — Express/Vercel functions uchun xatolarni yig'ish.
 * SENTRY_DSN sozlanmagan bo'lsa, to'liq no-op.
 *
 * `@sentry/node` ATAYLAB dinamik yuklanadi. Top-level `import` sifatida u cold
 * start'ga ~900 ms qo'shardi — o'lchandi, boot vaqtining eng katta bo'lagi edi.
 * Va bu narx HAR BIR sovuq so'rovga tushardi, hatto DB'ga tegmaydigan
 * `/api/health` ga ham.
 *
 * Yuklash modul init'ida BOSHLANADI, lekin kutilmaydi: boot bloklanmaydi,
 * kutubxona fonda tayyor bo'ladi. Shu oraliqda kelgan hodisalar navbatga
 * tushadi va yuklangach yuboriladi — ya'ni xato kuzatuvi yo'qolmaydi, faqat
 * bir necha yuz millisekundga kechikadi.
 *
 * Navbat CHEGARALANGAN: Sentry umuman yuklanmasa xotira o'smaydi.
 *
 * Chaqiruv shakli eski holicha — `Sentry.captureException(err, { tags })`.
 * Hech bir chaqiruv joyi o'zgarmadi.
 */
import type * as SentryNode from '@sentry/node'
import { config } from '../config'

type SentryModule = typeof SentryNode
type ExceptionContext = Parameters<SentryModule['captureException']>[1]
type MessageContext = Parameters<SentryModule['captureMessage']>[1]

type PendingEvent =
  | { kind: 'exception'; error: unknown; context: ExceptionContext }
  | { kind: 'message'; message: string; context: MessageContext }

/**
 * Kutubxona yuklanguncha saqlanadigan hodisalar chegarasi. Sovuq boot ~1s,
 * bu oraliqda 50 tadan ortiq xato bo'lsa muammo Sentry'da emas — o'shanda
 * ortiqchasini tashlab yuborgan ma'qul.
 */
export const MAX_PENDING = 50

const pending: PendingEvent[] = []
let loaded: SentryModule | undefined
let loading: Promise<void> | undefined

function send(sentry: SentryModule, event: PendingEvent): void {
  if (event.kind === 'exception') sentry.captureException(event.error, event.context)
  else sentry.captureMessage(event.message, event.context)
}

function load(): void {
  if (loading) return
  loading = import('@sentry/node')
    .then((sentry) => {
      sentry.init({
        dsn: config.sentry.dsn,
        environment: config.isProd ? 'production' : 'development',
        release: config.deploy.buildId,
        // Har 10-transaksiyadan 1 tasini kuzatish (serverless uchun yetarli)
        tracesSampleRate: 0.1,
      })
      loaded = sentry
      for (const event of pending.splice(0)) send(sentry, event)
    })
    .catch(() => {
      // Sentry yuklanmadi — bu ilovani to'xtatadigan sabab emas. Navbatni
      // bo'shatamiz, aks holda hodisalar hech qachon yuborilmay yig'ilaveradi.
      pending.length = 0
    })
}

function capture(event: PendingEvent): void {
  if (!config.sentry.dsn) return
  if (loaded) {
    send(loaded, event)
    return
  }
  if (pending.length < MAX_PENDING) pending.push(event)
  load()
}

// DSN bor bo'lsa yuklashni darhol boshlaymiz — birinchi xato kelguncha
// kutubxona odatda tayyor bo'ladi. `await` YO'Q: boot bloklanmaydi.
if (config.sentry.dsn) load()

export const Sentry = {
  captureException(error: unknown, context?: ExceptionContext): void {
    capture({ kind: 'exception', error, context })
  },
  captureMessage(message: string, context?: MessageContext): void {
    capture({ kind: 'message', message, context })
  },
}
