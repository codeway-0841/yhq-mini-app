/**
 * Ovozli o'qish (TTS) — Web Speech API, audio fayl KERAK EMAS.
 * Uzbekcha ovoz bo'lmasa brauzer default'iga tushadi (talaffuz biroz
 * boshqa bo'lishi mumkin — bu normal).
 */

function voiceFor(lang: 'uz' | 'ru'): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices()
  if (voices.length === 0) return null
  const pref = lang === 'ru' ? ['ru-RU', 'ru_RU', 'ru'] : ['uz-UZ', 'uz_UZ', 'uz']
  for (const p of pref) {
    const v = voices.find((x) => x.lang.startsWith(p))
    if (v) return v
  }
  return null
}

export function speak(text: string, lang: 'uz' | 'ru'): void {
  try {
    stopSpeaking()
    const u = new SpeechSynthesisUtterance(text)
    const v = voiceFor(lang)
    if (v) u.voice = v
    u.lang = v?.lang ?? (lang === 'ru' ? 'ru-RU' : 'uz-UZ')
    u.rate = 0.96
    u.pitch = 1
    window.speechSynthesis.speak(u)
  } catch { /* eski webview — jim */ }
}

export function stopSpeaking(): void {
  try { window.speechSynthesis.cancel() } catch { /* jim */ }
}

export function isSpeaking(): boolean {
  return typeof window !== 'undefined' && window.speechSynthesis.speaking
}
