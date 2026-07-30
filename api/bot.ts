import { Bot, InlineKeyboard, webhookCallback } from 'grammy'

const token = process.env['BOT_TOKEN']
if (!token) throw new Error('BOT_TOKEN is unset')

const APP_URL = process.env['APP_URL'] ?? 'https://yhq-mini-app.vercel.app'

const bot = new Bot(token)

bot.command('start', async (ctx) => {
  const keyboard = new InlineKeyboard().webApp('YHQ Mini App ochish', APP_URL)
  await ctx.reply(
    'Yo\'llar harakati qoidalari bo\'yicha test topshiring!\n\nQuyidagi tugmani bosing:',
    { reply_markup: keyboard }
  )
})

export default webhookCallback(bot, 'https')
