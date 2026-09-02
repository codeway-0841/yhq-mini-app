/** Landing konfigi — barcha CTA'lar ilova subdomeniga olib boradi. */

/** Ilova (Mini App / veb) manzili — "Boshlash" shu yerga o'tadi */
export const APP_URL =
  typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? '/app.html'
    : 'https://app.kivvi.uz'

/** Telegram bot — ikkilamchi CTA */
export const BOT_URL = 'https://t.me/kiwi_uz_bot'

/** Google Play ilovasi */
export const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=uz.kivvi.app'

/** Maxfiylik siyosati (public/privacy.html) */
export const PRIVACY_URL = '/privacy.html'
