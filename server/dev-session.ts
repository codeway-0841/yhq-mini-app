/**
 * Lokal preview uchun dev sessiya yaratadi (FAQAT lokal ishlab turgan
 * backend DB'sida — prod DB'ga ishlatmang, token konsolga chiqadi):
 *
 *   npx tsx server/dev-session.ts [user_id]     (default: 999999999)
 *
 * Chiqarilgan token'ni brauzer DevTools console'iga yozing:
 *   localStorage.setItem('yhq-session','<token>'); location.reload()
 *
 * user yo'q bo'lsa yaratiladi (initAtomic upsert) + telegram identity
 * (invariant: ('telegram', T).user_id = T). Sessiya 30 kunlik.
 */
import 'dotenv/config'
import { randomBytes } from 'crypto'
import { authRepository } from './modules/auth/auth.repository'
import { usersRepository } from './modules/users/users.repository'

const userId = process.argv[2] ?? '999999999'

await usersRepository.initAtomic({
  id: userId, firstName: 'Dev', lastName: '', username: '', photoUrl: '',
})
await authRepository.ensureIdentity('telegram', userId, userId)

const token = randomBytes(32).toString('hex')
await authRepository.createSession({
  token, userId, provider: 'telegram',
  expiresAt: new Date(Date.now() + 30 * 24 * 3_600_000),
})

console.log('\nDev sessiya yaratildi ✅')
console.log(`  userId: ${userId}  (30 kun)\n`)
console.log("Brauzerda F12 → Console'ga shu QATORNI yozib Enter bosing:\n")
console.log(`localStorage.setItem('yhq-session','${token}'); location.reload()`)
console.log('')
process.exit(0)
