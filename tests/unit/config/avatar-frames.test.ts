/**
 * Avatar ramkalari config (src/shared/config/avatar-frames.ts) ↔ index.css sinxronligi.
 * Har ramka uchun `.avatar-frame-<id>` klassi CSS'da bo'lishi shart —
 * aks holda sotib olingan ramka "ko'rinmay" qoladi (pulga xatolik).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { AVATAR_FRAMES, getAvatarFrame } from '../../../src/shared/config/avatar-frames'

describe('config/avatar-frames — data integrity', () => {
  it("barcha id'lar unikal", () => {
    const ids = AVATAR_FRAMES.map((f) => f.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('barcha ramkalarda i18n label + hex color', () => {
    for (const f of AVATAR_FRAMES) {
      expect(f.label.uz.trim()).not.toBe('')
      expect(f.label.ru.trim()).not.toBe('')
      expect(f.color).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })

  it('har ramka uchun index.css da klass bor', () => {
    const css = readFileSync(resolve(__dirname, '../../../src/index.css'), 'utf8')
    expect(css).toContain('.avatar-frame {')   // baza klassi
    for (const f of AVATAR_FRAMES) {
      expect({ id: f.id, ok: css.includes(`.${f.cssClass} {`) }).toEqual({ id: f.id, ok: true })
    }
  })

  it('getAvatarFrame: nomaʼlum/null id → null', () => {
    expect(getAvatarFrame(null)).toBeNull()
    expect(getAvatarFrame(undefined)).toBeNull()
    expect(getAvatarFrame('???')).toBeNull()
    expect(getAvatarFrame(AVATAR_FRAMES[0].id)?.id).toBe(AVATAR_FRAMES[0].id)
  })
})
