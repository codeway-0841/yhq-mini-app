import { useEffect, useRef } from 'react'

export interface UseShakeGestureOptions {
  onShake: () => void
  enabled?: boolean
  /** Akseleratsiya o'zgarishi chegarasi (standart: 16 m/s) */
  threshold?: number
  /** Ikki marta silkitish orasidagi cooldown (standart: 900ms) */
  timeout?: number
}

/**
 * Qurilmani silkitish (DeviceMotionEvent) gesture hook'i.
 * Qoralamani tozalash yoki tezkor harakatlar uchun apparat sensori.
 */
export function useShakeGesture({
  onShake,
  enabled = true,
  threshold = 16,
  timeout = 900,
}: UseShakeGestureOptions) {
  const onShakeRef = useRef(onShake)
  useEffect(() => {
    onShakeRef.current = onShake
  })

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return

    let initialized = false
    let lastX = 0
    let lastY = 0
    let lastZ = 0
    let lastUpdate = 0
    let lastTriggerTime = 0
    let shakeCount = 0
    let lastShakeTime = 0

    const handleMotion = (event: DeviceMotionEvent) => {
      const current = event.accelerationIncludingGravity || event.acceleration
      if (!current || current.x === null || current.y === null || current.z === null) return

      const now = performance.now()
      if (!initialized) {
        lastX = current.x
        lastY = current.y
        lastZ = current.z
        lastUpdate = now
        initialized = true
        return
      }

      if (now - lastUpdate < 80) return // ~12Hz throttle

      const dt = now - lastUpdate
      lastUpdate = now

      const dx = Math.abs(current.x - lastX)
      const dy = Math.abs(current.y - lastY)
      const dz = Math.abs(current.z - lastZ)

      lastX = current.x
      lastY = current.y
      lastZ = current.z

      const speed = ((dx + dy + dz) / (dt || 1)) * 100

      if (speed > threshold) {
        if (now - lastShakeTime > 500) {
          shakeCount = 1
        } else {
          shakeCount += 1
        }
        lastShakeTime = now

        // Tasodifiy qimirlashdan saqlash: 500ms ichida kamida 2 ta tebranish
        if (shakeCount >= 2 && now - lastTriggerTime > timeout) {
          lastTriggerTime = now
          shakeCount = 0
          onShakeRef.current()
        }
      }
    }

    window.addEventListener('devicemotion', handleMotion, { passive: true })
    return () => {
      window.removeEventListener('devicemotion', handleMotion)
    }
  }, [enabled, threshold, timeout])
}
