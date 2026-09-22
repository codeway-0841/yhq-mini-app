/**
 * CamAi yuz aniqlash hook'i — kamera + MediaPipe FaceDetector lifecycle.
 *
 * MAXFIYLIK: video FAQAT qurilmada qayta ishlanadi (on-device WASM), hech qayerga
 * yuborilmaydi; yuzlar tanib olinMAYDI — faqat anonim slot sifatida kuzatiladi.
 *
 * WASM `public/mediapipe/wasm/`dan, model `public/models/`dan yuklanadi
 * (self-host — APK offline ishlaydi, CDN'ga bog'liq emas; copy skript:
 * scripts/copy-mediapipe-assets.mjs, predev + build'da avtomatik).
 */
import { useEffect, useRef, useState, type RefObject } from 'react'
import type { FaceDetector } from '@mediapipe/tasks-vision'
import { matchDetectionsToSlots, computeFaceCrop, type FaceBox, type Slot } from './camai-logic'

export type CamStatus = 'idle' | 'loading' | 'camera' | 'running' | 'denied' | 'error'

const WASM_BASE = '/mediapipe/wasm'
const MODEL_PATH = '/models/blaze_face_short_range.tflite'

interface DetectorModule {
  FilesetResolver: typeof import('@mediapipe/tasks-vision').FilesetResolver
  FaceDetector: typeof import('@mediapipe/tasks-vision').FaceDetector
}

let modulePromise: Promise<DetectorModule> | null = null
/** ~6MB JS+WASM chunk FAQAT CamAi ochilganda tortiladi (heic2any pattern'i). */
function loadModule(): Promise<DetectorModule> {
  modulePromise ??= import('@mediapipe/tasks-vision')
  return modulePromise
}

export function useFaceDetection(
  videoRef: RefObject<HTMLVideoElement>,
  active: boolean,
): { slots: Slot[]; status: CamStatus; photos: Record<number, string> } {
  const [slots, setSlots] = useState<Slot[]>([])
  const [status, setStatus] = useState<CamStatus>('idle')
  /** Slot id → mini foto (96px data URL) — slot BIRINCHI aniqlanganda qirqib olinadi */
  const [photos, setPhotos] = useState<Record<number, string>>({})
  // render'dan mustaqil kuzatuv holati (rAF loop ichida to'g'ri qiymat)
  const stateRef = useRef<{ slots: Slot[]; nextId: number }>({ slots: [], nextId: 1 })
  const photosRef = useRef<Map<number, string>>(new Map())

  useEffect(() => {
    if (!active) return
    let cancelled = false
    let raf = 0
    let stream: MediaStream | null = null
    let detector: FaceDetector | null = null
    let videoEl: HTMLVideoElement | null = null
    let lastTimestamp = -1

    stateRef.current = { slots: [], nextId: 1 }
    photosRef.current.clear()
    setSlots([])
    setPhotos({})
    setStatus('loading')

    const fail = (s: CamStatus) => {
      if (!cancelled) setStatus(s)
    }

    void (async () => {
      try {
        const { FilesetResolver, FaceDetector } = await loadModule()
        const vision = await FilesetResolver.forVisionTasks(WASM_BASE)
        detector = await FaceDetector.createFromOptions(vision, {
          baseOptions: { modelAssetPath: MODEL_PATH },
          runningMode: 'VIDEO',
          minDetectionConfidence: 0.5,
        })
        if (cancelled) return

        setStatus('camera')
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            // 1080p ideal: uzoq qatordagi yuzlar ham aniqlansin (30-40 o'quvchi)
            video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
            audio: false,
          })
        } catch {
          // Orqa kamera yo'q/rad etildi — old kamera bilan urinib ko'ramiz
          try {
            stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
          } catch {
            fail('denied')
            return
          }
        }
        if (cancelled) return

        const video = videoRef.current
        if (!video) {
          fail('error')
          return
        }
        videoEl = video
        video.srcObject = stream
        await video.play().catch(() => fail('error'))
        if (cancelled) return
        setStatus('running')

        const loop = () => {
          if (cancelled || !detector) return
          if (video.readyState >= 2 && video.currentTime !== lastTimestamp) {
            lastTimestamp = video.currentTime
            try {
              const result = detector.detectForVideo(video, performance.now())
              const boxes: FaceBox[] = result.detections
                .map((d) => d.boundingBox)
                .filter((b): b is NonNullable<typeof b> => !!b)
                .map((b) => ({
                  x: b.originX / video.videoWidth,
                  y: b.originY / video.videoHeight,
                  width: b.width / video.videoWidth,
                  height: b.height / video.videoHeight,
                }))
              const matched = matchDetectionsToSlots(stateRef.current.slots, boxes, stateRef.current.nextId)
              stateRef.current = matched
              setSlots(matched.slots)
              // Yangi slotlarga mini-foto (bir marta, 96px) — reytingda tanish oson
              let photosChanged = false
              for (const s of matched.slots) {
                if (s.missed === 0 && !photosRef.current.has(s.id)) {
                  const rect = computeFaceCrop(s.box, video.videoWidth, video.videoHeight, 1.6)
                  if (rect && rect.size >= 16) {
                    const canvas = document.createElement('canvas')
                    canvas.width = 96
                    canvas.height = 96
                    const ctx = canvas.getContext('2d')
                    if (ctx) {
                      ctx.drawImage(video, rect.x, rect.y, rect.size, rect.size, 0, 0, 96, 96)
                      try {
                        photosRef.current.set(s.id, canvas.toDataURL('image/jpeg', 0.7))
                        photosChanged = true
                      } catch { /* keyingi kadrda urinadi */ }
                    }
                  }
                }
              }
              if (photosChanged) setPhotos(Object.fromEntries(photosRef.current))
            } catch {
              // Bitta kadr xatosi — loop'ni to'xtatmaymiz
            }
          }
          raf = requestAnimationFrame(loop)
        }
        raf = requestAnimationFrame(loop)
      } catch {
        fail('error')
      }
    })()

    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
      stream?.getTracks().forEach((t) => t.stop())
      detector?.close()
      const video = videoEl
      if (video) video.srcObject = null
    }
  }, [active, videoRef])

  return { slots, status, photos }
}
