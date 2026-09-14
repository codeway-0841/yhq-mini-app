import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import jbig2WasmUrl from 'pdfjs-dist/wasm/jbig2.wasm?url'
import openJpegWasmUrl from 'pdfjs-dist/wasm/openjpeg.wasm?url'

let pdfJsPromise: Promise<typeof import('pdfjs-dist')> | null = null

const WASM_ASSETS: Record<string, string> = {
  'jbig2.wasm': jbig2WasmUrl,
  'openjpeg.wasm': openJpegWasmUrl,
}

/**
 * Vite WASM fayllarini hash'langan asset nomlari bilan chiqaradi, PDF.js esa
 * odatda bitta `wasmUrl` papkasini kutadi. Factory har decoder nomini Vite
 * bergan aniq URL'ga bog'lab, JPEG2000/JBIG2 rasmlarni WebView'da ham chizadi.
 */
export class BundledPdfWasmFactory {
  async fetch({ filename }: { filename: string }): Promise<Uint8Array> {
    const url = WASM_ASSETS[filename]
    if (!url) throw new Error(`Noma'lum PDF decoder: ${filename}`)

    const response = await fetch(url)
    if (!response.ok) throw new Error(`PDF decoder yuklanmadi: ${response.status}`)
    return new Uint8Array(await response.arrayBuffer())
  }
}

/**
 * PDF.js og'ir chunk'ini faqat kitob reader'i ochilganda yuklaydi.
 * Worker ham Vite asset URL orqali shu build bilan birga versiyalanadi.
 */
export function loadPdfJs(): Promise<typeof import('pdfjs-dist')> {
  if (!pdfJsPromise) {
    pdfJsPromise = import('pdfjs-dist').then((pdfjs) => {
      pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl
      return pdfjs
    })
  }
  return pdfJsPromise
}
