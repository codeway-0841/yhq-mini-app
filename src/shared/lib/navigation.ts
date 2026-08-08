import type { NavigateFunction } from 'react-router-dom'

/**
 * Xavfsiz "Orqaga" — Telegram WebView'da sahifa RELOAD bo'lganda browser
 * history'da faqat bitta yozuv qoladi; `navigate(-1)` bunday holda hech narsa
 * qilmaydi va foydalanuvchi sahifada "qotib" qolardi.
 * History bo'lsa — orqaga; bo'lmasa — bosh sahifaga.
 */
export function goBack(navigate: NavigateFunction): void {
  const idx = (window.history.state as { idx?: number } | null)?.idx
  if (typeof idx === 'number' && idx > 0) navigate(-1)
  else navigate('/', { replace: true })
}
