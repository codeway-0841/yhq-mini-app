import type { AuthResponse } from '../../shared/api'
import { config } from '../../shared/config'
import { setSessionToken } from '../../shared/lib/session'
import { ensureAccountOwner } from '../../shared/store/account'
import { useAppStore } from '../../shared/store/useAppStore'
import { useQuestionsStore } from '../../shared/store/useQuestionsStore'
import { flushOutbox } from '../../shared/lib/outbox'

/**
 * Kirish / ro'yxatdan o'tish / ulash muvaffaqiyatining YAGONA hydrate yo'li.
 *
 * LoginPage ham, onboarding'ning Telegram qadami ham AYNAN shu funksiyani
 * chaqiradi — aks holda ikki xil sessiya holati paydo bo'lardi (AGENTS:
 * "Auth: multi-provider ... canonical user ID", yagona hydrate yo'li).
 */
export function applyAuthSession(data: AuthResponse): void {
  ensureAccountOwner(data.user.id)
  setSessionToken(data.sessionToken)
  useAppStore.getState().hydrateFromProfile(data)

  // v2: faqat metadata (full-bank preload YO'Q)
  if (config.testSessionsV2Enabled) {
    void useQuestionsStore.getState().loadTopics().catch(() => {})
  } else {
    void useQuestionsStore.getState().load(data.settings.language).catch(() => {})
  }
  void flushOutbox(data.user.id)

  if (typeof window !== 'undefined') {
    window.location.hash = '#/'
  }
  useAppStore.setState({ initialized: true })
}
