/**
 * Bot profil rasmini yangilash — public/images/brand-badge.png'ni Telegram
 * `setMyProfilePhoto` orqali yuklaydi. Logo almashganda qayta ishga tushiriladi:
 *
 *   npx tsx server/set-bot-photo.ts
 *
 * DIQQAT (2026-08-31): Bot API 9.x+ bu metodda `photo` parametr sifatida
 * InputProfilePhoto JSON obyektini kutadi ({type:'static', photo:'attach://…'})
 * — to'g'ridan-to'g'ri fayl maydoni ("photo=@f") endi "photo isn't specified"
 * xatosini beradi. grammY'ning o'rnatilgan versiyasi bu yangi shaklni bilmaydi
 * (attach:// string yuborib "can't parse photo JSON object" oladi), shuning
 * uchun bu yerda xom FormData ishlatiladi.
 */
import 'dotenv/config'
import { readFileSync } from 'node:fs'
import { config } from './config'

const token = config.telegram.botToken
if (!token) throw new Error('BOT_TOKEN env topilmadi')

const file = readFileSync('public/images/brand-badge.png')
const form = new FormData()
form.append('photo', JSON.stringify({ type: 'static', photo: 'attach://badge' }))
form.append('badge', new Blob([file], { type: 'image/png' }), 'badge.png')

const res = await fetch(`https://api.telegram.org/bot${token}/setMyProfilePhoto`, {
  method: 'POST',
  body: form,
})
const json = (await res.json()) as { ok: boolean; description?: string }
if (!json.ok) throw new Error(`setMyProfilePhoto failed: ${json.description ?? res.status}`)
console.log('✅ Bot profil rasmi yangilandi → public/images/brand-badge.png')
