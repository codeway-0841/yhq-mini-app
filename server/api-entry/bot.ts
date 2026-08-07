import '../utils/sentry'
import { Sentry } from '../utils/sentry'
import { Bot, Context, InlineKeyboard, webhookCallback } from 'grammy'
import { usersRepository } from '../modules/users/users.repository'
import { PREMIUM_PLANS, getPlan, parseStartParam, parsePaymentPayload, type PlanKey } from '../../shared/premium-plans'
import { config } from '../config'

const token = config.telegram.botToken
if (!token) throw new Error('BOT_TOKEN is unset')

// Cache-bust har deployda o'zgaradi (?v=<commit-sha>) — Telegram WebView
// eski versiyani keshlab turishining oldini oladi
const BASE_URL = config.deploy.appUrl
const APP_URL  = `${BASE_URL}?v=${config.deploy.buildId}`

const bot = new Bot(token)

const appKeyboard = () => new InlineKeyboard().webApp("📱 Ilovani ochish", APP_URL)

// ── Premium — Telegram Stars to'lovi (tarif rejalari — shared/premium-plans) ─
const PREMIUM_DESC =
  "KIWI Premium obunasi:\n" +
  "• Barcha funksiyalarga cheksiz kirish\n" +
  "• Eksklyuziv temalar (9 ta atmosfera)\n" +
  "• AI Tutor va xatolar tahlili\n" +
  "• Reklama'siz toza tajriba"

/** Bitta tarif uchun Stars invoice yuborish. Payload: premium_<plan>_<uid>. */
async function sendPremiumInvoice(ctx: Context, planKey: PlanKey) {
  const plan = getPlan(planKey)
  if (!plan) return
  await ctx.replyWithInvoice(
    `⭐ KIWI Premium — ${plan.titleUz}`,
    PREMIUM_DESC,
    `premium_${plan.key}_${ctx.from?.id}`,
    'XTR',
    [{ label: `Premium · ${plan.periodUz}`, amount: plan.stars }],
  )
}

/** Tarif tanlash menusi (3 inline tugma) */
async function sendPremiumChooser(ctx: Context) {
  const kb = new InlineKeyboard()
  for (const p of PREMIUM_PLANS) {
    kb.text(`⭐ ${p.titleUz} — ${p.stars} Stars`, `buy_${p.key}`).row()
  }
  await ctx.reply(
    "👑 KIWI Premium — o'z tarifingizni tanlang:\n\n" +
    PREMIUM_PLANS.map((p) => `• ${p.titleUz} — ${p.periodUz} — ${p.stars}⭐`).join('\n'),
    { reply_markup: kb }
  )
}

// ── Self-onboarding: set commands/description/menu button once per cold start ──
let profileReady: Promise<unknown> | null = null
function ensureProfile(): Promise<unknown> {
  profileReady ??= Promise.all([
    bot.api.setMyCommands([
      { command: 'start',       description: "Ilovani ochish" },
      { command: 'stats',       description: "Statistikangiz" },
      { command: 'daily',       description: "Bugungi savol" },
      { command: 'random',      description: "Tasodifiy savol" },
      { command: 'leaderboard', description: "Top-10 reyting" },
      { command: 'help',        description: "Yordam" },
      { command: 'about',       description: "Ilova haqida" },
      { command: 'privacy',     description: "Maxfiylik siyosati" },
    ]),
    bot.api.setMyDescription(
      "KIWI — Barcha fanlar uchun zamonaviy ta'lim platformasi.\n\n" +
      "• Biletlar va mavzular bo'yicha testlar\n" +
      "• Xatolar ustida ishlash\n" +
      "• Oktagon — do'stlar bilan bellashuv\n\n" +
      "Boshlash uchun /start bosing!"
    ),
    bot.api.setChatMenuButton({
      menu_button: { type: 'web_app', text: 'KIWI', web_app: { url: APP_URL } },
    }),
  ]).catch((err) => {
    profileReady = null   // retry next time if it failed
    console.error('[bot] ensureProfile failed:', err?.message ?? err)
  })
  return profileReady
}

// ── Global error handler — a failing handler must never crash the function ──
bot.catch((err) => {
  console.error('[bot]', err.message, err.ctx?.update?.update_id)
  Sentry.captureException(err)
})

// ── /start ──────────────────────────────────────────────────────────────────
bot.command('start', async (ctx) => {
  void ensureProfile()   // fire-and-forget — don't block the reply

  // Duel invite deep-link: t.me/bot?start=duel-xxxx → ilovadagi duel sahifasiga o'tkazuvchi tugma
  const param = ctx.match
  // Premium: 'premium' → tarif tanlash; 'premium_<plan>' → aniq invoice
  const planParam = param ? parseStartParam(param) : null
  if (planParam === 'chooser') {
    await sendPremiumChooser(ctx)
    return
  }
  if (planParam) {
    await sendPremiumInvoice(ctx, planParam)
    return
  }
  // Referal link: t.me/bot?start=ref_<id> → ilovaga ?ref= orqali o'tkazamiz
  if (param && /^ref_\d{1,19}$/.test(param)) {
    const refId = param.slice(4)
    await ctx.reply(
      "🚗 Do'stingiz sizni KIWI'ga taklif qilганi uchun mukofot beriladi!\n\n" +
      "Ilovani oching — do'stingizga +3 kun Premium (sizga esa imtihonga to'liq tayyorlanish imkoniyati).",
      { reply_markup: new InlineKeyboard().webApp("📱 Ilovani ochish", `${BASE_URL}?ref=${refId}`) },
    )
    return
  }
  if (param && /^duel-[a-z0-9]{6,16}$/.test(param)) {
    await ctx.reply(
      '🤺 Duelga taklif qilindingiz! Quyidagi tugmani bosib raqibingizga qo\'shiling:',
      // QUERY param — hash emas! Telegram hash'li web_app URL'da eski
      // sessiyani (Dashboard'da qolgan) ochadi; query esa ilovani QAYTA YUKLAYDI.
      { reply_markup: new InlineKeyboard().webApp("⚔️ Duelga qo'shilish", `${BASE_URL}?duel=${param}`) },
    )
    return
  }

  await ctx.reply(
    "Xush kelibsiz! 🎓\n\nKIWI — barcha fanlar uchun zamonaviy ta'lim platformasi: testlar, biletlar va real vaqtli o'yinlar — hammasi bitta ilovada.",
    { reply_markup: appKeyboard() }
  )
})

// ── /premium — Stars to'lov oqimi ───────────────────────────────────────────
bot.command('premium', async (ctx) => { await sendPremiumChooser(ctx) })

// Tarif tanlansa (inline tugma) → aniq shu tarif invoice'i
bot.callbackQuery(/^buy_(month|year|lifetime)$/, async (ctx) => {
  const planKey = ctx.match[1] as PlanKey
  await ctx.answerCallbackQuery()
  await sendPremiumInvoice(ctx, planKey)
})

// Telegram to'lov checkout'ini tasdiqlash (majburiy — aks holda invoice o'tmaydi)
bot.on('pre_checkout_query', async (ctx) => {
  await ctx.answerPreCheckoutQuery(true)
})

// To'lov muvaffaqiyatli → PREMIUM faollashtiriladi (tarif muddatiga qarab)
bot.on('message:successful_payment', async (ctx) => {
  const uid = ctx.from?.id
  const payload = ctx.message?.successful_payment?.invoice_payload ?? ''
  if (!uid) return
  const parsed = parsePaymentPayload(payload)
  try {
    if (parsed?.plan.days) {
      // Muddatli tarif: mavjud premium muddati USTIGA yig'iladi
      await usersRepository.extendPremium(BigInt(uid), parsed.plan.days)
      await ctx.reply(
        `🎉 Tabriklaymiz — Premium ${parsed.plan.periodUz}ga faollashtirildi!\n\n` +
        "Endi barcha funksiyalardan cheksiz foydalaning. Ilova: /start"
      )
    } else {
      // Umrbod (yoki eski payload format)
      await usersRepository.setTariff(BigInt(uid), 'premium')
      await ctx.reply(
        "🎉 Tabriklaymiz — UMRBOD Premium faollashtirildi!\n\n" +
        "Endi barcha funksiyalardan cheksiz foydalaning. Ilova: /start"
      )
    }
  } catch (err) {
    console.error('[bot] premium activation failed:', err)
    await ctx.reply("To'lov qabul qilindi, lekin faollashtirishda xato. @kiwi_uz_bot'ga yozing — tezda yechamiz.")
  }
})

// ── /help ───────────────────────────────────────────────────────────────────
bot.command('help', async (ctx) => {
  await ctx.reply(
    'Mavjud komandalar:\n\n' +
    '/start — Ilovani ochish\n' +
    '/stats — Statistikangiz\n' +
    '/daily — Bugungi savol\n' +
    '/random — Tasodifiy savol\n' +
    '/leaderboard — Eng yaxshi 10 talik reyting\n' +
    '/about — Ilova haqida\n\n' +
    "Savol yoki taklif bo'lsa, shu botga yozing.",
    { reply_markup: appKeyboard() }
  )
})

// ── /about ──────────────────────────────────────────────────────────────────
bot.command('about', async (ctx) => {
  await ctx.reply(
    "ℹ️ KIWI — Barcha fanlar uchun zamonaviy ta'lim platformasi.\n\n" +
    "• Biletlar va mavzular bo'yicha testlar\n" +
    "• Xatolar ustida ishlash rejimi\n" +
    "• Oktagon — real vaqtli bellashuvlar\n\n" +
    "Omad tilaymiz! 🍀",
    { reply_markup: appKeyboard() }
  )
})

// ── /privacy — Telegram talab qiladigan maxfiylik sahifasi ──────────────────
bot.command('privacy', async (ctx) => {
  await ctx.reply('Maxfiylik siyosati / Privacy Policy:\nhttps://yhq-mini-app.vercel.app/privacy.html')
})

// ── /stats — needs DB ───────────────────────────────────────────────────────
bot.command('stats', async (ctx) => {
  try {
    const { db }       = await import('../db/connection')
    const { progress } = await import('../schema')
    const { eq }       = await import('drizzle-orm')

    const from = ctx.from
    if (!from) return
    const userId = BigInt(from.id)
    const [row]  = await db.select().from(progress).where(eq(progress.userId, userId))

    if (!row) {
      await ctx.reply(
        "Sizda hali statistika yo'q. Ilovani ochib, birinchi testingizni yeching!",
        { reply_markup: appKeyboard() }
      )
      return
    }

    const total   = row.totalAnswered || 0
    const percent = total > 0 ? Math.round((row.totalCorrect / total) * 100) : 0

    await ctx.reply(
      `📊 Sizning statistikangiz:\n\n` +
      `✅ To'g'ri javoblar: ${row.totalCorrect}\n` +
      `❌ Xato javoblar: ${row.totalWrong}\n` +
      `📝 Jami javoblar: ${total}\n` +
      `🎯 Aniqlik: ${percent}%\n` +
      `🔥 Streak: ${row.streak} kun`,
      { reply_markup: appKeyboard() }
    )
  } catch (err) {
    console.error('[/stats]', err)
    await ctx.reply("Statistikani yuklab bo'lmadi. Birozdan so'ng qayta urinib ko'ring.")
  }
})

// ── /daily — deterministic daily question (same for everyone, changes daily) ──
bot.command('daily', async (ctx) => {
  try {
    const { db }        = await import('../db/connection')
    const { questions } = await import('../schema')
    const { sql }       = await import('drizzle-orm')

    // Deterministic pick by day-of-year — BUTUN jadvalni tortmasdan COUNT + OFFSET/LIMIT 1
    // (eski kod: SELECT * har bir /daily uchun — katta egress + latency)
    const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(questions)
    if (!count) {
      await ctx.reply('Hozircha savollar mavjud emas.')
      return
    }
    const dayOfYear = Math.floor(Date.now() / 86_400_000)
    const [q] = await db.select().from(questions)
      .orderBy(questions.id)
      .limit(1)
      .offset(dayOfYear % count)
    if (!q) {
      await ctx.reply('Hozircha savollar mavjud emas.')
      return
    }

    const options = Object.entries(q.optionsUz as Record<string, string>)
    const labels  = options.map(([id]) => id)
    const correctIndex = labels.indexOf(q.correctAnswer)

    await ctx.replyWithPoll(
      `📅 Bugungi savol (${new Date().toLocaleDateString('uz-UZ')}):\n\n${q.questionUz}`,
      options.map(([, text]) => text.slice(0, 100)),
      {
        type: 'quiz',
        is_anonymous: true,
        correct_option_ids: [correctIndex >= 0 ? correctIndex : 0],
      }
    )
  } catch (err) {
    console.error('[/daily]', err)
    await ctx.reply("Savolni yuklab bo'lmadi. Birozdan so'ng qayta urinib ko'ring.")
  }
})

// ── /random — quiz poll with a random question ──────────────────────────────
bot.command('random', async (ctx) => {
  try {
    const { db }        = await import('../db/connection')
    const { questions } = await import('../schema')
    const { sql }       = await import('drizzle-orm')

    const [q] = await db.select().from(questions).orderBy(sql`random()`).limit(1)
    if (!q) {
      await ctx.reply('Hozircha savollar mavjud emas.')
      return
    }

    const options = Object.entries(q.optionsUz as Record<string, string>)
    const labels  = options.map(([id]) => id)
    const correctIndex = labels.indexOf(q.correctAnswer)

    await ctx.replyWithPoll(
      q.questionUz,
      options.map(([, text]) => text.slice(0, 100)),   // Telegram option limit: 100 chars
      {
        type: 'quiz',
        is_anonymous: true,
        correct_option_ids: [correctIndex >= 0 ? correctIndex : 0],
      }
    )
  } catch (err) {
    console.error('[/random]', err)
    await ctx.reply("Savolni yuklab bo'lmadi. Birozdan so'ng qayta urinib ko'ring.")
  }
})

// ── /leaderboard — top 10 by correct answers ────────────────────────────────
bot.command('leaderboard', async (ctx) => {
  try {
    const { db }                = await import('../db/connection')
    const { progress, users }   = await import('../schema')
    const { desc, eq }          = await import('drizzle-orm')

    const rows = await db
      .select({
        firstName: users.firstName,
        username:  users.username,
        correct:   progress.totalCorrect,
      })
      .from(progress)
      .innerJoin(users, eq(progress.userId, users.id))
      .orderBy(desc(progress.totalCorrect))
      .limit(10)

    if (rows.length === 0) {
      await ctx.reply("Reyting hozircha bo'sh — birinchi bo'ling!", { reply_markup: appKeyboard() })
      return
    }

    const medals = ['🥇', '🥈', '🥉']
    const lines  = rows.map((r, i) => {
      const place = medals[i] ?? `${i + 1}.`
      const name  = r.firstName || r.username || 'Foydalanuvchi'
      return `${place} ${name} — ${r.correct} ✅`
    })

    await ctx.reply(`🏆 Eng yaxshi 10 talik:\n\n${lines.join('\n')}`, { reply_markup: appKeyboard() })
  } catch (err) {
    console.error('[/leaderboard]', err)
    await ctx.reply("Reytingni yuklab bo'lmadi. Birozdan so'ng qayta urinib ko'ring.")
  }
})

const callback = webhookCallback(bot, 'https')

// ── Webhook secret verification ─────────────────────────────────────────────
// PRODUCTION'da BOT_WEBHOOK_SECRET MAJBURIY — bo'lmasa istalgan odam soxta
// Telegram update'larini yuborib bot'ni spamer/polly sifatida ishlatadi.
// Header solishtirish timingSafeEqual bilan (timing attack himoyasi).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any) {
  const secret = config.telegram.webhookSecret
  if (!secret) {
    if (config.isProd) {
      res.statusCode = 500
      res.setHeader?.('content-type', 'text/plain')
      res.end?.('webhook secret not configured')
      return
    }
    return callback(req, res)   // dev — secret'siz ishlaydi
  }

  const got = (req?.headers?.['x-telegram-bot-api-secret-token']
    ?? req?.headers?.['X-Telegram-Bot-Api-Secret-Token']) as string | undefined

  const { timingSafeEqual } = await import('crypto')
  const a = Buffer.from(got ?? '')
  const b = Buffer.from(secret)
  const ok = a.length === b.length && timingSafeEqual(a, b)

  if (!ok) {
    // Oddiy Node ServerResponse — Express uslubidagi res.status() yo'q!
    res.statusCode = 401
    res.setHeader?.('content-type', 'text/plain')
    res.end?.('unauthorized')
    return
  }
  return callback(req, res)
}
