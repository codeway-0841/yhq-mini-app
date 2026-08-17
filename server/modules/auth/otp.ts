/**
 * SMS OTP tekshiruvining UMUMIY qatlami (cycle'siz): auth.service (login /
 * register / link) VA users.service (PATCH /users/:userId/phone — H-2 audit)
 * bir xil consume+lockout semantikasidan foydalanadi. auth.service →
 * users.service import qilgani uchun bu helper NEUTRAL modulga ko'chirilgan.
 */
import { AppError } from '../../middleware/error-handler'
import { authRepository } from './auth.repository'
import { hashOTP } from '../../utils/sms'

export const OTP_MAX_ATTEMPTS = 5            // shu urinishdan keyin kod o'chadi (yangi kod shart)

/**
 * OTP verify + brute-force lockout: noto'g'ri har urinish ATOMIK sanaladi;
 * limitga yetganda kod butunlay o'chadi (faqat yangi SMS kod yordam beradi).
 * consumeOTP faqat TO'G'RI kodda o'chiradi — hisoblagich bu yo'lda to'liq.
 */
export async function consumeOTPWithLockout(phone: string, code: string): Promise<void> {
  const valid = await authRepository.consumeOTP(phone, hashOTP(code))
  if (valid) return
  const attempts = await authRepository.incrementOTPAttempts(phone)
  if (attempts >= OTP_MAX_ATTEMPTS) {
    await authRepository.deleteOTP(phone)
    throw new AppError(429, 'otp_locked: Juda ko\'p noto\'g\'ri urinish — yangi kod so\'rang')
  }
  throw new AppError(401, 'invalid_otp')
}
