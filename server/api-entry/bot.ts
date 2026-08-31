import '../utils/sentry'
import { Sentry } from '../utils/sentry'
import { Bot, Context, InlineKeyboard, Keyboard, webhookCallback } from 'grammy'
import { usersRepository } from '../modules/users/users.repository'

import { PREMIUM_PLANS, getPlan, parseStartParam, type PlanKey } from '../../shared/premium-plans'
import { assertProdConfig, assertBotWebhookConfig, config } from '../config'
import { paymentRepository } from '../modules/payments/payment.repository'
import { paymentErrorMessage, validatePremiumPayment } from '../modules/payments/payment.service'
import { parseReferralParam } from '../utils/parse'
import { extractOwnContactPhone } from '../modules/users/contact-phone'

// api/index.js (server/api-entry/index.ts) va server/index.ts bu tekshiruvni
// boot'da chaqiradi — bu yerda ham chaqiramiz (BOT_TOKEN/CRON_SECRET/OTP_PEPPER
// umumiy). BOT_WEBHOOK_SECRET esa ALOHIDA assertBotWebhookConfig() orqali —
// u FAQAT shu (Telegram webhook) entry'ga tegishli; assertProdConfig()'ga
// qo'shilsa edi, Render'dagi standalone WS server (u webhook'ni ishlatmaydi,
// server/index.ts ham shu funksiyani chaqiradi) BOT_WEBHOOK_SECRET'siz
// boot'da qulab tushardi (incident — audit #9 fix'ining yon ta'siri).
assertProdConfig()
assertBotWebhookConfig()

const token = config.telegram.botToken
if (!token) throw new Error('BOT_TOKEN is unset')

// Cache-bust har deployda o'zgaradi (?v=<commit-sha>) — Telegram WebView
// eski versiyani keshlab turishining oldini oladi
const BASE_URL = config.deploy.appUrl
const APP_URL  = `${BASE_URL}?v=${config.deploy.buildId}`

export const bot = new Bot(token)

/**
 * Berilgan fan uchun Telegram Bot API orqali dinamik, yangi invite link yaratish.
 * Guruhda bot admin bo'lsa va TG_GROUP_<SUBJECT> sozlangan bo'lsa ishlaydi.
 */
export async function createGroupInviteLinkForSubject(subjectId: string, userId: string): Promise<string | null> {
  const { getSubjectTelegramChatId } = await import('../../shared/subjects')
  const groupChatId = (config.groups as Record<string, string | undefined>)?.[subjectId] || getSubjectTelegramChatId(subjectId)
  if (!groupChatId) return null

  const chatIdNum = Number(groupChatId) || groupChatId
  const userIdNum = Number(userId)

  if (!isNaN(userIdNum) && userIdNum > 0) {
    // 1. Agar foydalanuvchi ilgari chiqarib yuborilgan (kicked/restricted) bo'lsa — to'liq unban/unrestrict qilamiz
    try {
      await bot.api.unbanChatMember(chatIdNum, userIdNum)
    } catch {
      // unban fail bo'lsa ham davom etamiz
    }

    // 2. Agar user allaqachon guruh a'zosi/egasi bo'lsa — to'g'ridan-to'g'ri guruh chatini ochish havolasi
    try {
      const member = await bot.api.getChatMember(chatIdNum, userIdNum)
      if (member && ['creator', 'administrator', 'member'].includes(member.status)) {
        const internalId = String(groupChatId).replace(/^-100/, '')
        return `https://t.me/c/${internalId}/1`
      }
    } catch {
      // User hali guruhda yo'q — yangi invite yaratishga o'tamiz
    }
  }

  // 3. Yangi obunachi uchun avtomatik tasdiqli yoki bir martalik taklif havolasi
  try {
    const invite = await bot.api.createChatInviteLink(chatIdNum, {
      name: `User ${userId}`,
      creates_join_request: true,
    })
    return invite.invite_link
  } catch {
    try {
      const invite = await bot.api.createChatInviteLink(chatIdNum, {
        name: `User ${userId}`,
        member_limit: 1,
      })
      return invite.invite_link
    } catch (err) {
      console.error(`[bot] createChatInviteLink error for ${subjectId} (${groupChatId}):`, err)
      return null
    }
  }
}

// ── /id /chatid — Guruh ID'sini aniqlash uchun admin buyrug'i ─────────────────
// L-1 (audit): ichki guruh ID'lari oshkor bo'lmasligi uchun FAQAT bot adminlari
// (avval istalgan user ichki chat ID'larini olib, invite-link sxemasini ochardi).
bot.command(['id', 'chatid'], async (ctx) => {
  const { usersRepository } = await import('../modules/users/users.repository')
  const admin = await usersRepository.findById(String(ctx.from?.id))
  if (!admin?.isAdmin) {
    await ctx.reply("❌ Bu buyruq faqat bot adminlari uchun.")
    return
  }
  const chat = ctx.chat
  await ctx.reply(
    `📌 <b>Chat ID:</b> <code>${chat.id}</code>\n` +
    `🏷 <b>Nomi:</b> ${'title' in chat ? chat.title : (chat.first_name || 'Shaxsiy')}\n` +
    `🔖 <b>Turi:</b> ${chat.type}`,
    { parse_mode: 'HTML' }
  )
})

// ── /unban — Foydalanuvchini blokdan chiqarish (Admin buyrug'i) ───────────────
bot.command('unban', async (ctx) => {
  const adminId = String(ctx.from?.id)
  const { usersRepository } = await import('../modules/users/users.repository')
  const admin = await usersRepository.findById(adminId)
  if (!admin?.isAdmin) {
    await ctx.reply("❌ Bu buyruq faqat bot adminlari uchun.")
    return
  }

  const targetArg = ctx.match?.trim()
  const replyTo = ctx.message?.reply_to_message?.from?.id
  const targetId = replyTo ? String(replyTo) : targetArg

  if (!targetId || !/^\d+$/.test(targetId)) {
    await ctx.reply("ℹ️ Foydalanish: <code>/unban 123456789</code> yoki user xabariga reply qilib <code>/unban</code>", { parse_mode: 'HTML' })
    return
  }

  const { SUBJECT_BASES, getSubjectTelegramChatId } = await import('../../shared/subjects')
  let unbannedIn = 0

  for (const s of SUBJECT_BASES) {
    const chatId = (config.groups as Record<string, string | undefined>)?.[s.id] || getSubjectTelegramChatId(s.id)
    if (chatId) {
      try {
        await bot.api.unbanChatMember(Number(chatId) || chatId, Number(targetId))
        unbannedIn++
      } catch {}
    }
  }

  await ctx.reply(`✅ Foydalanuvchi (ID: <code>${targetId}</code>) ${unbannedIn} ta guruhda blokdan chiqarildi!`, { parse_mode: 'HTML' })
})

// Pending-login holati — telegram_login_codes DB ustunlarida (D1, 2026-08-26).
// Ilgari in-memory Map'da edi: Vercel serverless webhook turli instance'larga
// tushganda (/start → instance A, contact → instance B, tasdiqlash → instance C)
// pending yo'qolardi va login JIM sindiriladi. Endi 3 bosqich ham DB orqali.
// M-8 (audit): contact KELGANDA DARHOL sessiya bog'lanmaydi — avval in-bot
// TASDIQLASH tugmasi talab qilinadi (phishing: hujumchi yaratgan kodga qurbon
// kontakt ulashsa, qurbon "Brauzerdan kirishni tasdiqlaysizmi?" ni ko'radi).

const appKeyboard = () => new InlineKeyboard().webApp("📱 Ilovani ochish", APP_URL)

// ── Premium — Telegram Stars to'lovi (tarif rejalari — shared/premium-plans) ─
const PREMIUM_DESC =
  "KIVVI Premium obunasi:\n" +
  "• Barcha funksiyalarga cheksiz kirish\n" +
  "• Eksklyuziv temalar (9 ta atmosfera)\n" +
  "• AI Tutor va xatolar tahlili\n" +
  "• Reklama'siz toza tajriba"

/** Bitta tarif uchun Stars invoice yuborish. Payload: premium_<plan>_<uid>.
 *  Sarlavhada tierName (Plus/Pro/Premium) — oylik modelda titleUz barchada "Oylik". */
async function sendPremiumInvoice(ctx: Context, planKey: PlanKey) {
  const plan = getPlan(planKey)
  if (!plan) return
  await ctx.replyWithInvoice(
    `⭐ KIVVI Premium — ${plan.tierNameUz}`,
    PREMIUM_DESC,
    `premium_${plan.key}_${ctx.from?.id}`,
    'XTR',
    [{ label: `${plan.tierNameUz} · ${plan.periodUz}`, amount: plan.stars }],
  )
}

/** Tarif tanlash menusi (3 inline tugma) */
async function sendPremiumChooser(ctx: Context) {
  const kb = new InlineKeyboard()
  for (const p of PREMIUM_PLANS) {
    kb.text(`⭐ ${p.tierNameUz} — ${p.stars} Stars`, `buy_${p.key}`).row()
  }
  await ctx.reply(
    "👑 KIVVI Premium — o'z tarifingizni tanlang:\n\n" +
    PREMIUM_PLANS.map((p) => `• ${p.tierNameUz} — ${p.periodUz} — ${p.stars}⭐`).join('\n'),
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
      "KIVVI — Barcha fanlar uchun zamonaviy ta'lim platformasi.\n\n" +
      "• Biletlar va mavzular bo'yicha testlar\n" +
      "• Xatolar ustida ishlash\n" +
      "• Oktagon — do'stlar bilan bellashuv\n\n" +
      "Boshlash uchun /start bosing!"
    ),
    bot.api.setChatMenuButton({
      menu_button: { type: 'web_app', text: 'KIVVI', web_app: { url: APP_URL } },
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
  // Yopiq guruhga kirish: t.me/bot?start=group_<subjectId>
  if (param && /^group_([a-z0-9_-]+)$/.test(param)) {
    const subjectId = param.replace(/^group_/, '')
    const from = ctx.from
    if (!from) return

    const { usersRepository } = await import('../modules/users/users.repository')
    const user = await usersRepository.findById(String(from.id))
    const isPremium = user != null && (
      user.tariff === 'premium' ||
      (user.premiumUntil != null && new Date(user.premiumUntil) > new Date())
    )

    if (!isPremium) {
      await ctx.reply(
        "🔒 <b>Yopiq guruh faqat KIVVI Premium obunachilari uchun.</b>\n\n" +
        "Guruhga kirish uchun avval ilovada Premium obunani faollashtiring:",
        {
          parse_mode: 'HTML',
          reply_markup: new InlineKeyboard().webApp("👑 Obuna bo'lish", `${BASE_URL}?open=premium`),
        }
      )
      return
    }

    const inviteLink = await createGroupInviteLinkForSubject(subjectId, String(from.id))
    const { getSubjectClosedGroupUrl } = await import('../../shared/subjects')
    const targetUrl = inviteLink || getSubjectClosedGroupUrl(subjectId)

    await ctx.reply(
      `🎉 <b>Yopiq guruhga taklif havolangiz:</b>\n\n` +
      `Quyidagi tugmani bosib guruhga qo'shiling. Botingiz so'rovingizni avtomatik tasdiqlaydi:`,
      {
        parse_mode: 'HTML',
        reply_markup: new InlineKeyboard().url("🚀 Guruhga kirish", targetUrl),
      }
    )
    return
  }
  // Telegram Login: t.me/bot?start=login_<code> — brauzerdan kirish uchun
  // Bot contact (raqam) so'raydi, phone kelganda session yaratadi
  if (param && /^login_[A-Za-z0-9_-]{10,16}$/.test(param)) {
    if (ctx.from) {
      const kb = new Keyboard()
        .requestContact("📱 Raqamni ulashish")
        .resized()
        .oneTime()
      // D1: pending DB'da (atomik claim — boshqa TG user shu kodni ololmaydi
      // va qayta boshamaydi: tg_user_id FAQAT NULL'dan o'rnatiladi).
      const { authRepository } = await import('../modules/auth/auth.repository')
      const claimed = await authRepository.claimTelegramLoginCodeForTgUser(param.slice(6), String(ctx.from.id))
      if (!claimed) {
        await ctx.reply(
          '⏳ Ushbu kirish kodi eskirgan yoki band. ' +
          'Brauzerda «Telegram orqali kirish» tugmasini qaytadan bosing — yangi kod olinadi.',
        )
        return
      }
      await ctx.reply(
        "📱 Ilovaga kirish uchun telefon raqamingizni ulashing.\n\n" +
        "Quyidagi tugmani bosing — raqamingiz xavfsiz tarzda tekshiriladi:",
        { reply_markup: kb },
      )
    }
    return
  }

  // Account linking: t.me/bot?start=link_<code> — APK/brauzer (telefon sessiya)
  // yaratgan bir martalik kodni konsumatsiya qilib TG identity'ni shu hisobga ulaydi
  if (param && /^link_[A-Za-z0-9_-]{10,16}$/.test(param)) {
    if (ctx.from) {
      try {
        const { authService } = await import('../modules/auth/auth.service')
        const result = await authService.linkTelegramByCode(param.slice(5), { id: ctx.from.id })
        await ctx.reply(result.message)
      } catch (err) {
        console.error('[bot] link handler error:', err)
        await ctx.reply("❌ Ichki xatolik — keyinroq urinib ko'ring.")
      }
    }
    return
  }
  // Referal link: t.me/bot?start=ref_<id> → ilovaga ?ref= orqali o'tkazamiz.
  // ID canonical SHAQLda bo'lishi shart (TG raqam, p_<digits>, e_<hex>) —
  // eskirgan /^ref_\d+$/ telefon-userlarning (p_...) havolasini jimgina
  // tashlab yuborardi; parseReferralParam = server'dagi YAGONA canonical manba.
  const refId = parseReferralParam(param)
  if (param?.startsWith('ref_')) {
    if (!refId) {
      console.warn(`[bot] ref start_param noto'g'ri id shaklida: ${param}`)
    } else {
      await ctx.reply(
        "🚗 Do'stingiz sizni KIVVI'ga taklif qildi!\n\n" +
        "Ilovani oching va qulay tarzda o'rganishni boshlang!",
        { reply_markup: new InlineKeyboard().webApp("📱 Ilovani ochish", `${BASE_URL}?ref=${refId}`) },
      )
    }
    return
  }
  if (param && (/^duel-[a-z0-9]{4,16}$/.test(param) || /^\d{4,8}$/.test(param))) {
    const pin = param.replace(/^duel-/, '')
    const formattedPin = pin.length === 6 ? `${pin.slice(0, 3)} ${pin.slice(3)}` : pin
    await ctx.reply(
      `🤺 Siz duelga taklif qilindingiz!\n\n📌 Xona PIN-kodi: ${formattedPin}\n\nQuyidagi tugmani bosib do'stingiz bilan bellashuvni boshlang:`,
      // QUERY param — hash emas! Telegram hash'li web_app URL'da eski
      // sessiyani (Dashboard'da qolgan) ochadi; query esa ilovani QAYTA YUKLAYDI.
      { reply_markup: new InlineKeyboard().webApp("⚔️ Duelga qo'shilish", `${BASE_URL}?duel=${param}`) },
    )
    return
  }

  await ctx.reply(
    "Xush kelibsiz! 🎓\n\nKIVVI — barcha fanlar uchun zamonaviy ta'lim platformasi: testlar, biletlar va real vaqtli o'yinlar — hammasi bitta ilovada.",
    { reply_markup: appKeyboard() }
  )
})

// ── Contact handler — Telegram Login flow (raqam ulashilganda) ──────────────
// M-8: contact'ni QABUL qilganda sessiya HALI bog'lanmaydi — faqat tasdiqlash
// tugmasi yuboriladi; sessiya FAQAT 'tglogin_ok' callback'da yaratiladi.
bot.on('message:contact', async (ctx) => {
  const from = ctx.from
  if (!from) return
  const { authRepository } = await import('../modules/auth/auth.repository')
  const pending = await authRepository.findPendingTelegramLoginByTgUserId(String(from.id))
  if (!pending) {
    // ── Mini App requestContact fast-path (SMS'siz telefon ulash, 2026-08-28) ──
    // Ilovadagi "Telefon qo'shish" → requestContact'da rozi bo'lgan user uchun
    // Telegram O'ZI shu chat'ga imzolangan contact xabarini yuboradi —
    // contact.user_id === from.id bo'lsa egalik isboti Telegram darajasida
    // (SMS OTP shart emas). Client bu yozuvni GET /users/:id/phone bilan
    // bir necha soniya poll qiladi; yetib kelmasa eski OTP oqimiga tushadi.
    const phone = extractOwnContactPhone(ctx.message?.contact, from.id)
    if (!phone) return   // begona kontakt forward'i yoki login-flow'siz tasodifiy ulash — ignore
    try {
      const { usersService } = await import('../modules/users/users.service')
      await usersService.applyVerifiedPhone(String(from.id), phone)
      await ctx.reply(`✅ Telefon raqamingiz tasdiqlandi va hisobingizga ulandi: ${phone}`)
    } catch (err) {
      // User hali /init'dan o'tmagan (qator yo'q) — raqam yozilmaydi
      console.warn('[bot] contact phone-link yozilmadi:', err instanceof Error ? err.message : err)
      await ctx.reply(
        "ℹ️ Raqamingiz qabul qilindi, lekin hisob topilmadi — avval ilovani ochib ro'yxatdan o'ting.",
        { reply_markup: appKeyboard() },
      )
    }
    return
  }

  const contact = ctx.message.contact
  if (contact.user_id !== from.id) {
    await ctx.reply("❌ Faqat o'zingizning raqamingizni ulashishingiz mumkin.", { reply_markup: { remove_keyboard: true } })
    await authRepository.resetTelegramLoginPending(pending.code)
    return
  }

  // Kontakt DB'ga saqlanadi — sessiya faqat aniq tasdiqlashdan keyin (M-8 anti-phishing)
  await authRepository.attachContactToTelegramLoginCode(pending.code, contact.phone_number, {
    id: from.id, first_name: from.first_name, last_name: from.last_name, username: from.username,
  })
  const kb = new InlineKeyboard()
    .text('✅ Ha, bu men — kirishni tasdiqlash', 'tglogin_ok').row()
    .text('❌ Bekor qilish', 'tglogin_no')
  await ctx.reply(
    "🖥 *Brauzerdan KIVVI hisobingizga kirish so'raldi\\.*\n\n" +
    `📱 Raqam: \`${contact.phone_number}\`\n\n` +
    "Agar bu SIZ bo'lmasangiz — *Bekor qilish*ni bosing\\.",
    { parse_mode: 'MarkdownV2', reply_markup: kb },
  )
})

// ── Login tasdiqlash (M-8): FAQAT shu yerda sessiya yaratiladi ──────────────
bot.callbackQuery(/^tglogin_(ok|no)$/, async (ctx) => {
  const from = ctx.from
  const { authRepository } = await import('../modules/auth/auth.repository')
  const pending = from ? await authRepository.findPendingTelegramLoginByTgUserId(String(from.id)) : null
  await ctx.answerCallbackQuery()
  if (!from || !pending || !pending.phone || !pending.profile) {
    try { await ctx.editMessageText('⏳ Sessiya kodi eskurgan — kirish oqimini qaytadan boshlang.') } catch { /* edit xatosi jimgina */ }
    return
  }
  await authRepository.resetTelegramLoginPending(pending.code)
  try { await ctx.deleteMessage() } catch { /* eski xabar o'chmasa ham OK */ }

  if (ctx.match[1] === 'no') {
    await ctx.reply('❌ Bekor qilindi — brauzer sessiyasi OCHILMADI. Agar bu urinish sizniki bo\'lmasa, hech qayerga yozilmang.')
    return
  }

  try {
    const tgProfile = pending.profile as { id: number; first_name?: string; last_name?: string; username?: string }
    const { authService } = await import('../modules/auth/auth.service')
    const result = await authService.completeTelegramLoginByPhone(pending.code, pending.phone, tgProfile)
    await ctx.reply(result.message)
  } catch (err) {
    console.error('[bot] telegram-login confirm error:', err)
    await ctx.reply("❌ Xatolik yuz berdi — qayta urinib ko'ring.")
  }
})

// ── /premium — Stars to'lov oqimi ───────────────────────────────────────────
bot.command('premium', async (ctx) => { await sendPremiumChooser(ctx) })

// Tarif tanlansa (inline tugma) → aniq shu tarif invoice'i
bot.callbackQuery(/^buy_(month|year|lifetime)$/, async (ctx) => {
  const planKey = ctx.match[1] as PlanKey
  await ctx.answerCallbackQuery()
  await sendPremiumInvoice(ctx, planKey)
})

// Checkout faqat payload, payer, summa va currency shared tarifga mos bo'lsa tasdiqlanadi.
bot.on('pre_checkout_query', async (ctx) => {
  const query = ctx.preCheckoutQuery
  const validation = validatePremiumPayment({
    payerId: String(ctx.from.id),
    payload: query.invoice_payload,
    currency: query.currency,
    totalAmount: query.total_amount,
  })
  if (!validation.ok) {
    await ctx.answerPreCheckoutQuery(false, { error_message: paymentErrorMessage(validation.reason) })
    return
  }
  await ctx.answerPreCheckoutQuery(true)
})

// To'lov muvaffaqiyatli → ledger va entitlement bitta atomik SQL statementda yoziladi.
bot.on('message:successful_payment', async (ctx) => {
  const uid = ctx.from?.id
  const payment = ctx.message?.successful_payment
  if (!uid || !payment) return

  const validation = validatePremiumPayment({
    payerId: String(uid),
    payload: payment.invoice_payload,
    currency: payment.currency,
    totalAmount: payment.total_amount,
  })
  if (!validation.ok) {
    Sentry.captureMessage('Invalid successful Telegram payment', {
      level: 'error',
      extra: { reason: validation.reason, telegramUserId: String(uid) },
    })
    await ctx.reply("To'lov qabul qilindi, lekin invoice tekshiruvidan o'tmadi. @kiwi_uz_bot'ga yozing.")
    return
  }

  try {
    // Bot invoice Mini App birinchi ochilishidan oldin ham to'lanishi mumkin.
    // L-2 (audit): FAQAT FK-talqin uchun ensure — mavjud profilga TEGILMAYDI
    // (avval upsert({photoUrl: null}) har xaridda TG avatar'ni o'chirardi).
    await usersRepository.ensureExists(validation.userId, {
      firstName: ctx.from.first_name,
      lastName: ctx.from.last_name ?? null,
      username: ctx.from.username ?? null,
    })

    const result = await paymentRepository.complete({
      telegramChargeId: payment.telegram_payment_charge_id,
      providerChargeId: payment.provider_payment_charge_id,
      userId: validation.userId,
      plan: validation.plan.key,
      days: validation.plan.days,
      amount: payment.total_amount,
      currency: payment.currency,
      payload: payment.invoice_payload,
      rawUpdate: ctx.update as unknown as Record<string, unknown>,
    })

    if (result === 'user_not_found') {
      throw new Error(`Payment payer is not initialized: ${uid}`)
    }
    if (result === 'duplicate') {
      await ctx.reply("✅ Bu to'lov avval faollashtirilgan. Premium holatingiz saqlangan.")
      return
    }

    await ctx.reply(
      `🎉 Tabriklaymiz — Premium ${validation.plan.periodUz}ga faollashtirildi!\n\n` +
      "Endi barcha funksiyalardan cheksiz foydalaning. Ilova: /start",
    )
  } catch (err) {
    console.error('[bot] premium activation failed:', err)
    Sentry.captureException(err)
    await ctx.reply("To'lov qabul qilindi, lekin faollashtirishda xato. @kiwi_uz_bot'ga yozing — tezda yechamiz.")
  }
})

// ── Yopiq guruhga kirish so'rovi (chat_join_request — 1-variant) ────────────
// Guruhda "Approve new members" yoqilgan bo'lsa, Telegram so'rov yuboradi.
// Bot foydalanuvchining Premium obunasi borligini tekshiradi:
//  - Bor bo'lsa: darhol approveChatJoinRequest + tabrik xabari
//  - Yo'q bo'lsa: declineChatJoinRequest + obuna bo'lish eslatmasi
bot.on('chat_join_request', async (ctx) => {
  const req = ctx.chatJoinRequest
  if (!req) return

  const from = req.from
  const chatId = req.chat.id
  const userId = String(from.id)
  const chatTitle = req.chat.title || 'Yopiq guruh'

  // L-3 (audit) GURUH ALLOWLIST: bot admin bo'lgan HAR QANDAY guruhda
  // approve/decline qilmasligi kerak — FAQAT sozlangan VIP guruhlar
  // (TG_GROUP_RUSTILI / TG_GROUP_YHQ). Sozlanmagan bo'lsa fail-closed:
  // hech qanday avtomatik harakat yo'q (qo'lda tasdiqlanadi).
  const allowedChatIds = [config.groups.rustili, config.groups.yhq]
    .filter((id): id is string => Boolean(id))
  if (!allowedChatIds.includes(String(chatId))) return

  try {
    const user = await usersRepository.findById(userId)
    const isPremium = user != null && (
      user.tariff === 'premium' ||
      (user.premiumUntil != null && new Date(user.premiumUntil) > new Date())
    )

    if (isPremium) {
      await ctx.api.approveChatJoinRequest(chatId, from.id)
      try {
        await ctx.api.sendMessage(
          from.id,
          `🎉 Tabriklaymiz, ${from.first_name}!\n\n` +
          `«${chatTitle}» yopiq guruhiga qo'shilish so'rovingiz tasdiqlandi. Guruhga xush kelibsiz!`,
        )
      } catch {
        // PM xabari yuborilmasa ham (masalan, bot bloklangan) ruxsat berish amalga oshgan
      }
    } else {
      await ctx.api.declineChatJoinRequest(chatId, from.id)
      try {
        await ctx.api.sendMessage(
          from.id,
          `🔒 «${chatTitle}» faqat KIVVI Premium obunachilari uchun mo'ljallangan.\n\n` +
          `Guruhga kirish uchun avval ilovada obunani faollashtiring, so'ngra qayta so'rov yuboring.`,
          {
            reply_markup: new InlineKeyboard().webApp("📱 Ilovani ochish", APP_URL),
          },
        )
      } catch {
        // PM xabari yuborilmasa ham rad etish amalga oshgan
      }
    }
  } catch (err) {
    console.error('[bot] chat_join_request error:', err)
    Sentry.captureException(err)
  }
})

// ── Guruhdagi servis xabarlarini (qo'shildi / qabul qilindi / chiqdi) avtomatik tozalash ──
bot.on(['message:new_chat_members', 'message:left_chat_member'], async (ctx) => {
  try {
    await ctx.deleteMessage()
  } catch {
    // Guruhda 'can_delete_messages' huquqi bo'lsa darhol o'chiriladi
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
    "ℹ️ KIVVI — Barcha fanlar uchun zamonaviy ta'lim platformasi.\n\n" +
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
    const userId = String(from.id)   // canonical TEXT user id
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
