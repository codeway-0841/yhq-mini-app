/** Bir xil seed uchun bir xil Fisher–Yates tartibi (frontend + server SSOT). */
export function seededShuffle<T>(arr: readonly T[], seed: number): T[] {
  const copy = [...arr]
  let state = seed
  const random = () => {
    state |= 0
    state = (state + 0x6D2B79F5) | 0
    let value = Math.imul(state ^ (state >>> 15), 1 | state)
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1))
    ;[copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]]
  }
  return copy
}

/** String seed (masalan `2026-08-04|yhq`) → int32 xash. */
export function hashSeed(value: string): number {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = (Math.imul(hash, 31) + value.charCodeAt(index)) | 0
  }
  return hash
}

/** Kriptografik tanlov uchun EMAS; oddiy UI tasodifiylashtirish. */
export function shuffleArray<T>(arr: readonly T[]): T[] {
  const copy = [...arr]
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    ;[copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]]
  }
  return copy
}
