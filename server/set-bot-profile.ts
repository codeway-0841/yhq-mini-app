/**
 * One-off bot onboarding — run once after deploy:
 *   npm run bot:profile
 *
 * Sets commands (menu), description, short description and the
 * persistent Menu Button that opens the Mini App directly.
 */

import 'dotenv/config'
import { Bot } from 'grammy'

const token = process.env['BOT_TOKEN']
if (!token) throw new Error('BOT_TOKEN is unset')

const APP_URL = process.env['APP_URL'] ?? 'https://yhq-mini-app.vercel.app'

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
  "YHQ Test — Yo'l harakati qoidalari bo'yicha imtihonga tayyorlanish.\n\n" +
  "• Biletlar va mavzular bo'yicha testlar\n" +
  "• Xatolar ustida ishlash\n" +
  "• Yo'l belgilari va darslik\n" +
  "• Oktagon — do'stlar bilan bellashuv\n\n" +
  "Boshlash uchun /start bosing!"
)

await bot.api.setMyShortDescription(
  "YHQ imtihoniga tayyorlaning: testlar, biletlar, yo'l belgilari 🚗"
)

// Persistent menu button (bottom-left of the chat) opening the Mini App
await bot.api.setChatMenuButton({
  menu_button: { type: 'web_app', text: 'YHQ Test', web_app: { url: APP_URL } },
})

console.log('✅ Bot profile set: commands, description, menu button →', APP_URL)
process.exit(0)
