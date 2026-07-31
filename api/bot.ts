import { Bot, InlineKeyboard, webhookCallback } from 'grammy'

const token = process.env['BOT_TOKEN']
if (!token) throw new Error('BOT_TOKEN is unset')

const APP_URL = process.env['APP_URL'] ?? 'https://yhq-mini-app.vercel.app'

const bot = new Bot(token)

const appKeyboard = () => new InlineKeyboard().webApp("📱 Ilovani ochish", APP_URL)

// ── Global error handler — a failing handler must never crash the function ──
bot.catch((err) => {
  console.error('[bot]', err.message, err.ctx?.update?.update_id)
})

// ── /start ──────────────────────────────────────────────────────────────────
bot.command('start', async (ctx) => {
  await ctx.reply(
    "Xush kelibsiz! 🚗\n\nYo'l harakati qoidalari bo'yicha imtihonga tayyorlaning: biletlar, mavzular, yo'l belgilari va real vaqtli o'yinlar — hammasi bitta ilovada.",
    { reply_markup: appKeyboard() }
  )
})

// ── /help ───────────────────────────────────────────────────────────────────
bot.command('help', async (ctx) => {
  await ctx.reply(
    'Mavjud komandalar:\n\n' +
    '/start — Ilovani ochish\n' +
    '/stats — Statistikangiz\n' +
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
    "ℹ️ YHQ Test — Yo'l harakati qoidalari bo'yicha imtihonga tayyorgarlik ilovasi.\n\n" +
    "• Biletlar va mavzular bo'yicha testlar\n" +
    "• Xatolar ustida ishlash rejimi\n" +
    "• Yo'l belgilari bo'limi\n" +
    "• Oktagon — real vaqtli bellashuvlar\n\n" +
    "Omad tilaymiz! 🍀",
    { reply_markup: appKeyboard() }
  )
})

// ── /stats — needs DB ───────────────────────────────────────────────────────
bot.command('stats', async (ctx) => {
  try {
    const { db }       = await import('../server/db/connection')
    const { progress } = await import('../server/schema')
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

// ── /random — quiz poll with a random question ──────────────────────────────
bot.command('random', async (ctx) => {
  try {
    const { db }        = await import('../server/db/connection')
    const { questions } = await import('../server/schema')
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
    const { db }                = await import('../server/db/connection')
    const { progress, users }   = await import('../server/schema')
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

export default webhookCallback(bot, 'https')
