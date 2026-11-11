import {
  BRILLIANT_SOUNDS,
  playBrilliantSound,
  playLoopingBrilliantSound,
  stopBrilliantSound,
  type BrilliantSoundId,
} from './brilliantSounds'

/**
 * KIVVI yagona UI ovoz tizimi — 100% Brilliant.org asl `.mp3` effektlari (`public/brilliant/sounds/*.mp3`).
 * Har bir hodisa davomiyligi va vazifasiga qat'iy moslangan (double-trigger va global pointerdown xatolarisiz).
 */

export type LegacySoundKind =
  | 'click'
  | 'success'
  | 'error'
  | 'coins'
  | 'chime'
  | 'win'
  | 'achievement'
  | 'combo'
  | 'match'
  | 'toggle'
  | 'emote_pop'
  | 'emote_whoosh'
  | 'emote_splash'

export type SoundKind = LegacySoundKind | BrilliantSoundId

const BRILLIANT_ID_SET = new Set<string>(BRILLIANT_SOUNDS.map((s) => s.id))

const LEGACY_TO_BRILLIANT: Record<LegacySoundKind, BrilliantSoundId> = {
  click: 'assessment-click-option-1', // 131ms toza mikro-tap (avvalgidek 1.25s cho'zilmaydi)
  toggle: 'toggle-on',
  success: 'correct',
  error: 'incorrect',
  coins: 'xp-tally',
  chime: 'xp-tally',
  win: 'endstate',
  achievement: 'diagnostic-complete',
  combo: 'correct',
  match: 'highlight-node',
  emote_pop: 'drag-started',
  emote_whoosh: 'skip',
  emote_splash: 'drag-released',
}

export function resolveBrilliantSound(kind: SoundKind): BrilliantSoundId {
  if (BRILLIANT_ID_SET.has(kind)) {
    return kind as BrilliantSoundId
  }
  return LEGACY_TO_BRILLIANT[kind as LegacySoundKind] ?? 'assessment-click-option-1'
}

/** Master ovoz funksiyasi — ilovadagi barcha ovozlar shu orqali Brilliant `.mp3` sifatida ijro etiladi */
export function playSound(kind: SoundKind) {
  void playBrilliantSound(resolveBrilliantSound(kind))
}

/** Davomiy loop ovoz (masalan XP sanash vaqtida `tutor-xp-countup-start`) */
export function playLoopingSound(kind: SoundKind) {
  playLoopingBrilliantSound(resolveBrilliantSound(kind))
}

/** Joriy tovush(lar)ni to‘xtatadi */
export function stopSound(kind?: SoundKind) {
  stopBrilliantSound(kind ? resolveBrilliantSound(kind) : undefined)
}

export { playBrilliantSound, playLoopingBrilliantSound, stopBrilliantSound, type BrilliantSoundId }
