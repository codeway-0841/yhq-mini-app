/**
 * KUNLIK VAZIFALAR ("Battle Pass lite", FIXPLAN #40 Faza 2) — YAGONA MANBA.
 *
 * Har kun Toshkent sanasi (tashkentDate — daily_records bilan bir xil) bo'yicha
 * 3 ta oddiy vazifa; bajarilganda "Olish" tugmasi → coin mukofoti.
 *
 * QOIDALAR:
 * - `metric` — daily_records ustuni (answered | correct | fixed): progress va
 *   claim TEKSHIRUVI server'da SQL aggregate bilan o'lchanadi (client raqamiga
 *   ishonilmaydi — trust boundary).
 * - Mukofot FAQAT bitta marta: coin_transactions (user, 'task_claim', '<id>:<date>')
 *   UNIQUE — ikki marta claim imkonsiz.
 * - Reward nominal balans: mint alternativasi (~80c/kun javoblardan + ~35c/kun
 *   vazifalardan) — iqtisod: 500c tema ≈ 4-5 kun (Faza 1 qarori: sekin iqtisod).
 */

export type DailyTaskMetric = 'answered' | 'correct' | 'fixed'

export interface DailyTask {
  id: string
  metric: DailyTaskMetric
  target: number
  reward: number
  label: { uz: string; ru: string }
}

export const DAILY_TASKS = [
  { id: 'answers-20', metric: 'answered', target: 20, reward: 10,
    label: { uz: '20 ta savolga javob ber', ru: 'Ответь на 20 вопросов' } },
  { id: 'correct-15', metric: 'correct', target: 15, reward: 15,
    label: { uz: '15 ta to‘g‘ri javob',   ru: '15 правильных ответов'   } },
  { id: 'fix-5',      metric: 'fixed',   target: 5,  reward: 10,
    label: { uz: '5 ta xatoni tuzat',     ru: 'Исправь 5 ошибок'        } },
] as const satisfies readonly DailyTask[]

export type DailyTaskId = (typeof DAILY_TASKS)[number]['id']

export function getDailyTask(id: string): DailyTask | null {
  return (DAILY_TASKS as readonly DailyTask[]).find((t) => t.id === id) ?? null
}
