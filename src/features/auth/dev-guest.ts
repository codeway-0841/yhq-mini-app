import type { AuthResponse } from '../../shared/api'
import type { Lang } from '../../shared/i18n'
import { applyAuthSession } from './apply-auth-session'

/**
 * DEV-only: backend/bot sozlanmagan lokal muhitda Telegram login o'rniga
 * lokal mehmon sessiyasi. LoginPage ham, onboarding Telegram qadami ham shu
 * yo'lni ishlatadi — prod build'da `import.meta.env.DEV` false bo'lgani uchun
 * butunlay tree-shake qilinadi.
 */
export function applyDevGuestSession(language: Lang): void {
  const data: AuthResponse = {
    user: {
      id: '999999999',
      firstName: 'Lokal Mehmon',
      lastName: '',
      username: 'lokal_user',
      photoUrl: undefined,
      phone: undefined,
      tariff: 'free',
      coins: 100,
      ownedItems: [],
      avatarFrame: null,
    },
    progress: {
      totalCorrect: 0,
      totalWrong: 0,
      totalAnswered: 0,
      streak: 1,
      wrongByTicket: {},
      solvedQuestions: [],
      xp: 50,
    },
    settings: {
      autoNextCorrect: true,
      autoNextWrong: false,
      noAnimation: false,
      shuffleOptions: false,
      fontSize: 'medium',
      fontStyle: 'default',
      language,
      theme: 'dark',
      offlineMode: false,
      dailyReminder: true,
      dailyReminderTime: '20:00',
    },
    savedQuestions: [],
    providers: ['telegram'],
    sessionToken: '0123456789abcdef0123456789abcdef',
  }
  applyAuthSession(data)
}
