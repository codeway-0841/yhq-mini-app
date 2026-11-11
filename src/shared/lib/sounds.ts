import {
  BRILLIANT_SOUNDS,
  playBrilliantSound,
  stopBrilliantSound,
  type BrilliantSoundId,
} from './brilliantSounds'

/**
 * KIVVI yagona UI ovoz tizimi — 100% Brilliant.org asl `.mp3` effektlari (`public/brilliant/sounds/*.mp3`).
 * Avvalgi Web Audio sintez kodlari to‘liq olib tashlangan.
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
  click: 'lightweight-choice',
  toggle: 'toggle-on',
  success: 'correct',
  error: 'incorrect',
  coins: 'xp-tally',
  chime: 'xp-tally',
  win: 'endstate',
  achievement: 'diagnostic-complete',
  combo: 'tutor-xp-countup-start',
  match: 'highlight-node',
  emote_pop: 'drag-started',
  emote_whoosh: 'skip',
  emote_splash: 'drag-released',
}

export function resolveBrilliantSound(kind: SoundKind): BrilliantSoundId {
  if (BRILLIANT_ID_SET.has(kind)) {
    return kind as BrilliantSoundId
  }
  return LEGACY_TO_BRILLIANT[kind as LegacySoundKind] ?? 'lightweight-choice'
}

/** Master ovoz funksiyasi — ilovadagi barcha ovozlar shu orqali Brilliant `.mp3` sifatida ijro etiladi */
export function playSound(kind: SoundKind) {
  void playBrilliantSound(resolveBrilliantSound(kind))
}

export { playBrilliantSound, stopBrilliantSound, type BrilliantSoundId }

/* ── Global: asosiy CTA tugmalar bosilganda Brilliant `continue.mp3` ──────
   Event delegation — har sahifaga alohida yozish shart emas. */
if (typeof document !== 'undefined') {
  document.addEventListener('pointerdown', (e) => {
    const el = (e.target as HTMLElement | null)?.closest?.('button.bg-pprimary')
    if (el && !(el as HTMLButtonElement).disabled) playSound('continue')
  })
}
