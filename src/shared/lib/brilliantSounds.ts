/**
 * Brilliant.org rasmiy UI/O‘yin ovoz effektlari (26 ta haqiqiy `.mp3` fayl).
 * Manba: Brilliant veb-ilovasi `useSoundPlayer` (37 ta action ID dan 26 ta aktiv `.mp3`;
 * qolgan 11 ta tutor/voice actionlar `getSoundOverrideUrl` orqali dinamik beriladi).
 */

export type BrilliantSoundGroupId = 'actions' | 'feedback' | 'rewards' | 'assessment'

export type BrilliantSoundId =
  | 'continue'
  | 'start-lesson'
  | 'skip'
  | 'hint'
  | 'toggle-on'
  | 'toggle-off'
  | 'lightweight-choice'
  | 'correct'
  | 'incorrect'
  | 'drag-started'
  | 'drag-released'
  | 'highlight-node'
  | 'endstate'
  | 'xp-tally'
  | 'tutor-xp-countup-start'
  | 'tutor-xp-countup-stop'
  | 'router-koji-recommendation'
  | 'assessment-click-option-1'
  | 'assessment-click-option-2'
  | 'assessment-click-option-3'
  | 'assessment-click-option-4'
  | 'assessment-dont-know'
  | 'assessment-submit'
  | 'diagnostic-answer'
  | 'diagnostic-complete'
  | 'lesson-failed'

export interface BrilliantSoundMeta {
  id: BrilliantSoundId
  group: BrilliantSoundGroupId
  labelUz: string
  labelRu: string
  triggerUz: string
  triggerRu: string
}

export const BRILLIANT_SOUND_GROUPS: ReadonlyArray<{
  id: BrilliantSoundGroupId
  titleUz: string
  titleRu: string
}> = [
  { id: 'actions', titleUz: 'Tugma va interfeys (7)', titleRu: 'Кнопки и интерфейс (7)' },
  { id: 'feedback', titleUz: 'Javob va drag-drop (5)', titleRu: 'Ответы и drag-drop (5)' },
  { id: 'rewards', titleUz: 'Yutuq, XP va Endstate (5)', titleRu: 'Награды, XP и Endstate (5)' },
  { id: 'assessment', titleUz: 'Test va diagnostika (9)', titleRu: 'Тест и диагностика (9)' },
]

export const BRILLIANT_SOUNDS: ReadonlyArray<BrilliantSoundMeta> = [
  // Tugma va interfeys
  { id: 'continue', group: 'actions', labelUz: 'Continue tugmasi', labelRu: 'Кнопка Continue', triggerUz: 'Asosiy CTA bosilganda', triggerRu: 'Нажатие главной CTA' },
  { id: 'start-lesson', group: 'actions', labelUz: 'Dars boshlash', labelRu: 'Старт урока', triggerUz: 'Darsga kirilganda', triggerRu: 'Вход в урок' },
  { id: 'lightweight-choice', group: 'actions', labelUz: 'Variant tanlash', labelRu: 'Выбор варианта', triggerUz: 'Kartochka / pill bosilganda', triggerRu: 'Клик по карточке / pill' },
  { id: 'hint', group: 'actions', labelUz: 'Maslahat (Hint)', labelRu: 'Подсказка (Hint)', triggerUz: 'Yordam ochilganda', triggerRu: 'Открытие подсказки' },
  { id: 'skip', group: 'actions', labelUz: 'O‘tkazib yuborish', labelRu: 'Пропустить (Skip)', triggerUz: 'Savol o‘tkazilganda', triggerRu: 'Пропуск вопроса' },
  { id: 'toggle-on', group: 'actions', labelUz: 'Yoqish (Toggle On)', labelRu: 'Включение (On)', triggerUz: 'Switch yoqilganda', triggerRu: 'Включение тумблера' },
  { id: 'toggle-off', group: 'actions', labelUz: 'O‘chirish (Toggle Off)', labelRu: 'Выключение (Off)', triggerUz: 'Switch o‘chirilganda', triggerRu: 'Выключение тумблера' },

  // Javob va interaktiv
  { id: 'correct', group: 'feedback', labelUz: 'To‘g‘ri javob', labelRu: 'Правильный ответ', triggerUz: 'Test javobi to‘g‘ri bo‘lsa', triggerRu: 'При верном ответе' },
  { id: 'incorrect', group: 'feedback', labelUz: 'Xato javob', labelRu: 'Ошибка', triggerUz: 'Noto‘g‘ri javobda', triggerRu: 'При ошибке' },
  { id: 'drag-started', group: 'feedback', labelUz: 'Drag boshlanishi', labelRu: 'Начало перетаскивания', triggerUz: 'Blok ushlanganda', triggerRu: 'Захват элемента' },
  { id: 'drag-released', group: 'feedback', labelUz: 'Drag qo‘yilishi', labelRu: 'Отпускание блока', triggerUz: 'Blok joyiga qo‘yilganda', triggerRu: 'Сброс элемента' },
  { id: 'highlight-node', group: 'feedback', labelUz: 'Tugun ajratish', labelRu: 'Подсветка узла', triggerUz: 'Xarita tuguni bosilganda', triggerRu: 'Клик узла карты' },

  // Yutuq, XP va Endstate
  { id: 'endstate', group: 'rewards', labelUz: 'Dars yakuni (Yutuq)', labelRu: 'Финал урока (Endstate)', triggerUz: 'Dars / daraja tugaganda', triggerRu: 'Завершение урока / уровня' },
  { id: 'xp-tally', group: 'rewards', labelUz: 'XP hisoblash (Tally)', labelRu: 'Подсчёт XP (Tally)', triggerUz: 'XP natija ekrani chiqqanda', triggerRu: 'Появление блока XP' },
  { id: 'tutor-xp-countup-start', group: 'rewards', labelUz: 'XP sanash boshi', labelRu: 'Старт счёта XP', triggerUz: 'Raqam yugura boshlaganda', triggerRu: 'Старт анимации XP' },
  { id: 'tutor-xp-countup-stop', group: 'rewards', labelUz: 'XP sanash to‘xtashi', labelRu: 'Финиш счёта XP', triggerUz: 'Yakuniy XP ga yetganda', triggerRu: 'Финиш анимации XP' },
  { id: 'router-koji-recommendation', group: 'rewards', labelUz: 'Koji tavsiyasi', labelRu: 'Рекомендация Коджи', triggerUz: 'Tavsiya kartasi chiqqanda', triggerRu: 'Появление рекомендации' },

  // Baholash va diagnostika
  { id: 'assessment-click-option-1', group: 'assessment', labelUz: 'Variant 1', labelRu: 'Вариант 1', triggerUz: '1-variant bosilganda', triggerRu: 'Выбор 1-го варианта' },
  { id: 'assessment-click-option-2', group: 'assessment', labelUz: 'Variant 2', labelRu: 'Вариант 2', triggerUz: '2-variant bosilganda', triggerRu: 'Выбор 2-го варианта' },
  { id: 'assessment-click-option-3', group: 'assessment', labelUz: 'Variant 3', labelRu: 'Вариант 3', triggerUz: '3-variant bosilganda', triggerRu: 'Выбор 3-го варианта' },
  { id: 'assessment-click-option-4', group: 'assessment', labelUz: 'Variant 4', labelRu: 'Вариант 4', triggerUz: '4-variant bosilganda', triggerRu: 'Выбор 4-го варианта' },
  { id: 'assessment-dont-know', group: 'assessment', labelUz: 'Bilmayman tugmasi', labelRu: 'Кнопка "Не знаю"', triggerUz: '"Bilmayman" bosilganda', triggerRu: 'Клик "Не знаю"' },
  { id: 'assessment-submit', group: 'assessment', labelUz: 'Yuborish (Submit)', labelRu: 'Отправка (Submit)', triggerUz: 'Javob tasdiqlanganda', triggerRu: 'Подтверждение ответа' },
  { id: 'diagnostic-answer', group: 'assessment', labelUz: 'Diagnostika javobi', labelRu: 'Ответ диагностики', triggerUz: 'Diagnostika qadamida', triggerRu: 'Шаг диагностики' },
  { id: 'diagnostic-complete', group: 'assessment', labelUz: 'Diagnostika yakuni', labelRu: 'Финал диагностики', triggerUz: 'Diagnostika tugaganda', triggerRu: 'Конец диагностики' },
  { id: 'lesson-failed', group: 'assessment', labelUz: 'Muvaffaqiyatsiz urinish', labelRu: 'Неудачная попытка', triggerUz: 'Ball yetmaganda', triggerRu: 'Недостаточный балл' },
]

export const BRILLIANT_SOUND_URL_BASE = '/brilliant/sounds'

const audioPool = new Map<BrilliantSoundId, HTMLAudioElement>()

export function getBrilliantSoundUrl(id: BrilliantSoundId): string {
  return `${BRILLIANT_SOUND_URL_BASE}/${id}.mp3`
}

/**
 * Brilliant.org ning asl `.mp3` ovoz effektini ijro etadi (brauzer va APK uchun xavfsiz).
 */
export async function playBrilliantSound(id: BrilliantSoundId, volume = 0.85): Promise<boolean> {
  if (typeof window === 'undefined' || typeof Audio === 'undefined') return false
  try {
    let audio = audioPool.get(id)
    if (!audio) {
      audio = new Audio(getBrilliantSoundUrl(id))
      audio.preload = 'auto'
      audioPool.set(id, audio)
    }
    audio.volume = Math.max(0, Math.min(1, volume))
    audio.currentTime = 0
    const isJsdomNative =
      typeof HTMLMediaElement !== 'undefined' &&
      audio instanceof HTMLMediaElement &&
      typeof navigator !== 'undefined' &&
      /jsdom/i.test(navigator.userAgent)
    if (isJsdomNative) return false
    const res = audio.play()
    if (res && typeof res.then === 'function') {
      await res
    }
    return true
  } catch {
    return false
  }
}

/**
 * Joriy ijro etilayotgan Brilliant tovush(lar)ini to‘xtatadi.
 */
export function stopBrilliantSound(id?: BrilliantSoundId): void {
  if (id) {
    const a = audioPool.get(id)
    if (a) {
      a.pause()
      a.currentTime = 0
    }
    return
  }
  audioPool.forEach((a) => {
    a.pause()
    a.currentTime = 0
  })
}
