/**
 * One-off bot onboarding — run once after deploy:
 *   npm run bot:profile
 *
 * Sets commands (menu), description, short description and the
 * persistent Menu Button that opens the Mini App directly.
 */

import 'dotenv/config'
import { Bot } from 'grammy'
import { config } from './config'

const token = config.telegram.botToken
if (!token) throw new Error('BOT_TOKEN is unset')

const APP_URL = config.deploy.appUrl

const bot = new Bot(token)

await bot.api.setMyCommands([
  { command: 'start',       description: "Ilovani ochish" },
  { command: 'stats',       description: "Statistikangiz" },
  { command: 'daily',       description: "Bugungi savol" },
  { command: 'random',      description: "Tasodifiy savol" },
  { command: 'leaderboard', description: "Top-10 reyting" },
  { command: 'help',        description: "Yordam" },
  { command: 'about',       description: "Ilova haqida" },
])

await bot.api.setMyDescription(
  "KIWI — Barcha fanlar uchun zamonaviy ta'lim platformasi.\n\n" +
  "• Biletlar va mavzular bo'yicha testlar\n" +
  "• Xatolar ustida ishlash\n" +
  "• Oktagon — do'stlar bilan bellashuv\n\n" +
  "Boshlash uchun /start bosing!"
)

await bot.api.setMyShortDescription(
  "Barcha fanlar uchun zamonaviy ta'lim platformasi 🎓"
)

// Persistent menu button (bottom-left of the chat) opening the Mini App
await bot.api.setChatMenuButton({
  menu_button: { type: 'web_app', text: 'KIWI', web_app: { url: APP_URL } },
})

const webhookUrl = 'https://app.kivvi.uz/api/bot'
if (config.telegram.webhookSecret) {
  await bot.api.setWebhook(webhookUrl, { secret_token: config.telegram.webhookSecret })
  console.log('✅ Webhook set →', webhookUrl)
}

console.log('✅ Bot profile set: commands, description, menu button →', APP_URL)
process.exit(0)
