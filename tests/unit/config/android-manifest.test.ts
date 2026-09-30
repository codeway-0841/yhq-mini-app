import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * AndroidManifest regression-guard ([P1] APK mikrofon permission yo'q edi):
 * WebRTC audio capture WebView'da RECORD_AUDIO runtime permissionni talab qiladi.
 * Manifest'da bo'lmasa mic jim ishlamaydi (APK'da ustoz audiosi/mic muammosi).
 */
describe('AndroidManifest — mic permission', () => {
  const xml = readFileSync(join(__dirname, '../../../android/app/src/main/AndroidManifest.xml'), 'utf8')

  it('RECORD_AUDIO permission bor', () => {
    expect(xml).toContain('android.permission.RECORD_AUDIO')
  })

  it('MODIFY_AUDIO_SETTINGS permission bor (echo/noise yo‘li)', () => {
    expect(xml).toContain('android.permission.MODIFY_AUDIO_SETTINGS')
  })

  it('microphone hardware feature e’lon qilingan (required=false)', () => {
    expect(xml).toContain('android.hardware.microphone')
  })
})
