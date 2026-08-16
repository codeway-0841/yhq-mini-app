/**
 * features/auth — PUBLIC API barrel.
 * LoginPage'ni App.tsx (composition root) TO'G'RIDAN-TO'G'RI lazy import qiladi
 * (barrel orqali emas — code splitting uchun). Bu barrel faqat boshqa
 * feature'larga kerak bo'lgan sof logika/hook'larni eksport qiladi
 * (import-boundary qoidasi: feature → feature FAQAT index.ts orqali).
 */
export { authErrorKey, isValidPhone, isValidPassword, toE164 } from './validation'
export { usePhoneInput } from './hooks/usePhoneInput'
// Profil (LinkAccountSection) adaptiv OTP bosqichi uchun — barrel orqali (qoida 1a)
export { default as OTPInput } from './components/OTPInput'
