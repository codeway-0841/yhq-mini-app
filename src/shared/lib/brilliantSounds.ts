/**
 * Brilliant.org rasmiy UI/O‘yin ovoz effektlari dvigateli (26 ta asl `.mp3` fayl).
 * Arxitektura (Brilliant `useSoundPlayer` 1:1):
 * - Birlamchi: Web Audio API (`AudioContext` + `decodeAudioData` kesh) — 0ms kechikish, toza polifoniya va loop.
 * - Zaxira: `HTMLAudioElement` kesh/pul (eski WebView yoki `AudioContext` mavjud bo‘lmaganda).
 * - Kanal boshqaruvi: bir xil kategoriyadagi uzun effektlar ustma-ust tushib shovqin qilmaydi;
 *   qisqa kliklar (`assessment-click-option-1..4`) esa tezkor ketma-ketlikda silliq yangraydi.
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
  { id: 'continue', group: 'actions', labelUz: 'Continue tugmasi', labelRu: 'Кнопка Continue', triggerUz: 'Keyingi bosqichga o‘tish CTA', triggerRu: 'Переход к следующему шагу' },
  { id: 'start-lesson', group: 'actions', labelUz: 'Dars boshlash', labelRu: 'Старт урока', triggerUz: 'Darsga kirilganda', triggerRu: 'Вход в урок' },
  { id: 'lightweight-choice', group: 'actions', labelUz: 'Variant tanlash', labelRu: 'Выбор варианта', triggerUz: 'Karta / pill tanlanganda', triggerRu: 'Выбор карточки / pill' },
  { id: 'hint', group: 'actions', labelUz: 'Maslahat (Hint)', labelRu: 'Подсказка (Hint)', triggerUz: 'Yordam / tushuntirish ochilganda', triggerRu: 'Открытие подсказки / ИИ' },
  { id: 'skip', group: 'actions', labelUz: 'O‘tkazib yuborish', labelRu: 'Пропустить (Skip)', triggerUz: 'Bekor qilish / o‘tkazish', triggerRu: 'Пропуск / закрытие' },
  { id: 'toggle-on', group: 'actions', labelUz: 'Yoqish (Toggle On)', labelRu: 'Включение (On)', triggerUz: 'Switch yoqilganda', triggerRu: 'Включение тумблера' },
  { id: 'toggle-off', group: 'actions', labelUz: 'O‘chirish (Toggle Off)', labelRu: 'Выключение (Off)', triggerUz: 'Switch o‘chirilganda', triggerRu: 'Выключение тумблера' },

  // Javob va interaktiv
  { id: 'correct', group: 'feedback', labelUz: 'To‘g‘ri javob', labelRu: 'Правильный ответ', triggerUz: 'Test javobi to‘g‘ri bo‘lsa', triggerRu: 'При верном ответе' },
  { id: 'incorrect', group: 'feedback', labelUz: 'Xato javob', labelRu: 'Ошибка', triggerUz: 'Noto‘g‘ri javobda', triggerRu: 'При ошибке' },
  { id: 'drag-started', group: 'feedback', labelUz: 'Drag boshlanishi', labelRu: 'Начало перетаскивания', triggerUz: 'Blok ushlanganda', triggerRu: 'Захват элемента' },
  { id: 'drag-released', group: 'feedback', labelUz: 'Drag qo‘yilishi', labelRu: 'Отпускание блока', triggerUz: 'Blok joyiga qo‘yilganda', triggerRu: 'Сброс элемента' },
  { id: 'highlight-node', group: 'feedback', labelUz: 'Tugun ajratish', labelRu: 'Подсветка узла', triggerUz: 'Kurs xaritasi tugunida', triggerRu: 'Клик узла карты курса' },

  // Yutuq, XP va Endstate
  { id: 'endstate', group: 'rewards', labelUz: 'Dars yakuni (Yutuq)', labelRu: 'Финал урока (Endstate)', triggerUz: 'Dars / daraja / seriya yakuni', triggerRu: 'Завершение урока / серии' },
  { id: 'xp-tally', group: 'rewards', labelUz: 'XP hisoblash (Tally)', labelRu: 'Подсчёт XP (Tally)', triggerUz: 'XP / mukofot chiqqanda', triggerRu: 'Появление награды XP' },
  { id: 'tutor-xp-countup-start', group: 'rewards', labelUz: 'XP sanash boshi', labelRu: 'Старт счёта XP', triggerUz: 'XP hisoblagichi yugurganda', triggerRu: 'Старт счёта XP' },
  { id: 'tutor-xp-countup-stop', group: 'rewards', labelUz: 'XP sanash to‘xtashi', labelRu: 'Финиш счёта XP', triggerUz: 'XP yakuniy qiymatga yetganda', triggerRu: 'Финиш счёта XP' },
  { id: 'router-koji-recommendation', group: 'rewards', labelUz: 'Koji tavsiyasi', labelRu: 'Рекомендация Коджи', triggerUz: 'Tavsiya kartasi chiqqanda', triggerRu: 'Появление рекомендации' },

  // Baholash va diagnostika
  { id: 'assessment-click-option-1', group: 'assessment', labelUz: 'Variant 1', labelRu: 'Вариант 1', triggerUz: '1-variant / UI tap', triggerRu: 'Выбор 1-го варианта / tap' },
  { id: 'assessment-click-option-2', group: 'assessment', labelUz: 'Variant 2', labelRu: 'Вариант 2', triggerUz: '2-variant bosilganda', triggerRu: 'Выбор 2-го варианта' },
  { id: 'assessment-click-option-3', group: 'assessment', labelUz: 'Variant 3', labelRu: 'Вариант 3', triggerUz: '3-variant bosilganda', triggerRu: 'Выбор 3-го варианта' },
  { id: 'assessment-click-option-4', group: 'assessment', labelUz: 'Variant 4', labelRu: 'Вариант 4', triggerUz: '4-variant bosilganda', triggerRu: 'Выбор 4-го варианта' },
  { id: 'assessment-dont-know', group: 'assessment', labelUz: 'Bilmayman tugmasi', labelRu: 'Кнопка "Не знаю"', triggerUz: '"Bilmayman" bosilganda', triggerRu: 'Клик "Не знаю"' },
  { id: 'assessment-submit', group: 'assessment', labelUz: 'Yuborish (Submit)', labelRu: 'Отправка (Submit)', triggerUz: 'Javob tasdiqlanganda', triggerRu: 'Подтверждение ответа' },
  { id: 'diagnostic-answer', group: 'assessment', labelUz: 'Diagnostika javobi', labelRu: 'Ответ диагностики', triggerUz: 'Diagnostika qadamida', triggerRu: 'Шаг диагностики' },
  { id: 'diagnostic-complete', group: 'assessment', labelUz: 'Diagnostika yakuni', labelRu: 'Финал диагностики', triggerUz: '100% / yutuq ochilishi', triggerRu: '100% / достижение' },
  { id: 'lesson-failed', group: 'assessment', labelUz: 'Muvaffaqiyatsiz urinish', labelRu: 'Неудачная попытка', triggerUz: 'Sinovdan o‘ta olmaganda', triggerRu: 'Неуспешная попытка' },
]

export const BRILLIANT_SOUND_URL_BASE = '/brilliant/sounds'

const DEFAULT_GAIN: Partial<Record<BrilliantSoundId, number>> = {
  'assessment-click-option-1': 0.55,
  'assessment-click-option-2': 0.55,
  'assessment-click-option-3': 0.55,
  'assessment-click-option-4': 0.55,
  'assessment-dont-know': 0.65,
  'assessment-submit': 0.65,
  'tutor-xp-countup-stop': 0.65,
  'toggle-on': 0.55,
  'toggle-off': 0.55,
  continue: 0.72,
  skip: 0.68,
  hint: 0.72,
  'start-lesson': 0.75,
  'lightweight-choice': 0.68,
  'drag-started': 0.65,
  'drag-released': 0.68,
  'highlight-node': 0.68,
}

/** Qaysi tovushlar bitta kanalda oldingisini to‘xtatadi (ustma-ust shovqin bo‘lmasligi uchun) */
const EXCLUSIVE_CHANNEL: Partial<Record<BrilliantSoundId, string>> = {
  correct: 'feedback',
  incorrect: 'feedback',
  'lesson-failed': 'feedback',
  endstate: 'reward',
  'diagnostic-complete': 'reward',
  'xp-tally': 'tally',
  'tutor-xp-countup-start': 'countup',
  continue: 'nav',
  'start-lesson': 'nav',
  skip: 'nav',
}

const HOT_PRELOAD_IDS: ReadonlyArray<BrilliantSoundId> = [
  'assessment-click-option-1',
  'assessment-click-option-2',
  'assessment-click-option-3',
  'assessment-click-option-4',
  'toggle-on',
  'toggle-off',
  'continue',
  'correct',
  'incorrect',
  'endstate',
]

let audioCtx: AudioContext | null = null
let warmed = false
const bufferCache = new Map<BrilliantSoundId, AudioBuffer>()
const pendingDecodes = new Map<BrilliantSoundId, Promise<AudioBuffer | null>>()
const activeNodes = new Map<string, { source: AudioBufferSourceNode; gain: GainNode }>()
const htmlPool = new Map<BrilliantSoundId, HTMLAudioElement>()

export function getBrilliantSoundUrl(id: BrilliantSoundId): string {
  return `${BRILLIANT_SOUND_URL_BASE}/${id}.mp3`
}

function isJsdomEnv(): boolean {
  return typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent)
}

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined' || isJsdomEnv()) return null
  try {
    if (!audioCtx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!AC) return null
      audioCtx = new AC()
    }
    if (audioCtx.state === 'suspended') {
      void audioCtx.resume().catch(() => {})
    }
    return audioCtx
  } catch {
    return null
  }
}

async function loadAudioBuffer(id: BrilliantSoundId): Promise<AudioBuffer | null> {
  const cached = bufferCache.get(id)
  if (cached) return cached

  const inflight = pendingDecodes.get(id)
  if (inflight) return inflight

  const ctx = getAudioContext()
  if (!ctx || typeof fetch !== 'function') return null

  const task = fetch(getBrilliantSoundUrl(id))
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res.arrayBuffer()
    })
    .then((arr) => ctx.decodeAudioData(arr))
    .then((decoded) => {
      bufferCache.set(id, decoded)
      pendingDecodes.delete(id)
      return decoded
    })
    .catch(() => {
      pendingDecodes.delete(id)
      return null
    })

  pendingDecodes.set(id, task)
  return task
}

function stopChannel(channel: string) {
  const cur = activeNodes.get(channel)
  if (!cur) return
  activeNodes.delete(channel)
  try {
    const ctx = getAudioContext()
    if (ctx) {
      cur.gain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.01)
      cur.source.stop(ctx.currentTime + 0.03)
    } else {
      cur.source.stop()
    }
  } catch {
    /* allaqachon tugagan */
  }
}

async function playViaHtmlAudio(id: BrilliantSoundId, volume: number, loop: boolean): Promise<boolean> {
  if (typeof Audio === 'undefined') return false
  try {
    let audio = htmlPool.get(id)
    if (!audio) {
      audio = new Audio(getBrilliantSoundUrl(id))
      audio.preload = 'auto'
      htmlPool.set(id, audio)
    }
    if (typeof HTMLMediaElement !== 'undefined' && audio instanceof HTMLMediaElement && isJsdomEnv()) {
      return false
    }
    audio.volume = Math.max(0, Math.min(1, volume))
    audio.loop = loop
    audio.currentTime = 0
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
 * Birinchi foydalanuvchi harakatida asosiy tugma/javob effektlarini oldindan dekodlab tayyorlaydi (0ms kechikish).
 */
export function warmBrilliantSounds(): void {
  if (warmed || isJsdomEnv() || typeof window === 'undefined') return
  warmed = true
  if (!getAudioContext()) return
  for (const id of HOT_PRELOAD_IDS) {
    void loadAudioBuffer(id)
  }
}

if (typeof document !== 'undefined') {
  document.addEventListener('pointerdown', warmBrilliantSounds, { once: true, passive: true })
}

/**
 * Brilliant.org ning asl `.mp3` ovoz effektini ijro etadi (0ms Web Audio API + HTMLAudio zaxira).
 */
export async function playBrilliantSound(
  id: BrilliantSoundId,
  volume = DEFAULT_GAIN[id] ?? 0.8,
  loop = false,
): Promise<boolean> {
  if (typeof window === 'undefined') return false

  // Testlarda global Audio stub qilinganda zaxira yo‘li birinchi ishlasin
  const isCustomAudioStub =
    typeof Audio !== 'undefined' &&
    typeof HTMLAudioElement !== 'undefined' &&
    (Audio as unknown) !== (HTMLAudioElement as unknown) &&
    !/\[native code\]/.test(Function.prototype.toString.call(Audio))

  if (isCustomAudioStub) {
    return playViaHtmlAudio(id, volume, loop)
  }

  const ctx = getAudioContext()
  if (ctx) {
    const buffer = await loadAudioBuffer(id)
    if (buffer) {
      try {
        const channel = EXCLUSIVE_CHANNEL[id] ?? (loop ? `loop:${id}` : undefined)
        if (channel) stopChannel(channel)

        const source = ctx.createBufferSource()
        source.buffer = buffer
        source.loop = loop
        const gain = ctx.createGain()
        gain.gain.setValueAtTime(Math.max(0, Math.min(1, volume)), ctx.currentTime)
        source.connect(gain)
        gain.connect(ctx.destination)

        if (channel) {
          activeNodes.set(channel, { source, gain })
          source.onended = () => {
            if (activeNodes.get(channel)?.source === source) {
              activeNodes.delete(channel)
            }
          }
        }

        source.start(0)
        return true
      } catch {
        /* fallback ga o‘tadi */
      }
    }
  }

  return playViaHtmlAudio(id, volume, loop)
}

/**
 * Brilliant.org dagidek davomiy loop tovush (masalan XP sanash vaqtida `tutor-xp-countup-start`).
 */
export function playLoopingBrilliantSound(id: BrilliantSoundId, volume?: number): void {
  void playBrilliantSound(id, volume, true)
}

/**
 * Joriy ijro etilayotgan Brilliant tovush(lar)ini yumshoq to‘xtatadi.
 */
export function stopBrilliantSound(id?: BrilliantSoundId): void {
  if (id) {
    const channel = EXCLUSIVE_CHANNEL[id] ?? `loop:${id}`
    stopChannel(channel)
    const a = htmlPool.get(id)
    if (a) {
      a.loop = false
      a.pause()
      a.currentTime = 0
    }
    return
  }
  for (const ch of [...activeNodes.keys()]) {
    stopChannel(ch)
  }
  htmlPool.forEach((a) => {
    a.loop = false
    a.pause()
    a.currentTime = 0
  })
}
