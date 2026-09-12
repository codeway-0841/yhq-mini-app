/**
 * Client-side image compressor:
 * 1. HEIC/HEIF (iOS) rasmlarini JPEG ga o'giradi (heic2any).
 * 2. Canvas orqali o'lchamni max 1280px gacha proportsional kichraytiradi.
 * 3. 0.82 sifatli WebP (yoki JPEG fallback) ga siqadi (~150-250KB).
 * Bu tarmoq trafigini 10-20 barobar tejaydi va Gemini API ga bir zumda yetib boradi.
 */

export interface CompressedImageResult {
  base64: string
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp'
  width: number
  height: number
  sizeBytes: number
}

const MAX_DIMENSION = 1280
const QUALITY = 0.82

export async function compressImageFile(file: File | Blob): Promise<CompressedImageResult> {
  let imageBlob = file

  // iOS HEIC fayllarni tekshirish
  if (file.type === 'image/heic' || file.type === 'image/heif' || (file instanceof File && /\.(heic|heif)$/i.test(file.name))) {
    try {
      const heic2any = (await import('heic2any')).default
      const converted = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.85 })
      imageBlob = Array.isArray(converted) ? converted[0] : converted
    } catch (e) {
      console.warn('[image-compress] heic2any failed, fallbacking to native:', e)
    }
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error("Faylni o'qishda xatolik yuz berdi"))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error("Rasmni yuklashda xatolik"))
      img.onload = () => {
        let width = img.naturalWidth || img.width
        let height = img.naturalHeight || img.height

        // Proportsional kichraytirish
        if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
          if (width > height) {
            height = Math.round((height * MAX_DIMENSION) / width)
            width = MAX_DIMENSION
          } else {
            width = Math.round((width * MAX_DIMENSION) / height)
            height = MAX_DIMENSION
          }
        }

        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          return reject(new Error("Canvas kontekstini olish imkonsiz"))
        }

        // Silliqlash algoritmi
        ctx.imageSmoothingEnabled = true
        ctx.imageSmoothingQuality = 'high'
        ctx.drawImage(img, 0, 0, width, height)

        // WebP formatini tekshirish
        let mimeType: 'image/webp' | 'image/jpeg' = 'image/webp'
        let dataUrl = canvas.toDataURL('image/webp', QUALITY)
        if (!dataUrl.startsWith('data:image/webp')) {
          mimeType = 'image/jpeg'
          dataUrl = canvas.toDataURL('image/jpeg', QUALITY)
        }

        const base64 = dataUrl.split(',')[1] || ''
        const sizeBytes = Math.round((base64.length * 3) / 4)

        resolve({
          base64: dataUrl,
          mimeType,
          width,
          height,
          sizeBytes,
        })
      }
      img.src = reader.result as string
    }
    reader.readAsDataURL(imageBlob)
  })
}
