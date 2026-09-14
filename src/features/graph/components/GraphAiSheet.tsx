/**
 * AI ko'radi — canvas'ni PNG qilib /api/tutor/graph-analyze'ga yuboradi,
 * Gemini Vision grafikni tahlil qiladi (ildiz, ekstremum, davr, asimptota...).
 * Kvota foto-yechish bilan umumiy (free 2 / premium 30 kunlik).
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { Sheet, SheetBody, SheetClose, SheetHeader, SheetTitle } from '../../../shared/components/ui/sheet'
import MathText from '../../../shared/components/MathText'
import { useT } from '../../../shared/i18n'
import { api, ApiError } from '../../../shared/api'

interface Props {
  open: boolean
  onClose: () => void
  language: 'uz' | 'ru'
  canvasRef: { current: HTMLCanvasElement | null }
  context: string
  onPremium: () => void
}

export default function GraphAiSheet({ open, onClose, language, canvasRef, context, onPremium }: Props) {
  const tt = useT(language)
  const [analysis, setAnalysis] = useState<string | null>(null)
  const [image, setImage] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [quotaError, setQuotaError] = useState(false)
  const [failed, setFailed] = useState(false)
  const [runKey, setRunKey] = useState(0)

  const run = useCallback(async () => {
    const canvas = canvasRef.current
    if (!canvas) { setFailed(true); return }
    let dataUrl: string
    try {
      dataUrl = canvas.toDataURL('image/png')
    } catch {
      setFailed(true)
      return
    }
    setImage(dataUrl)
    setLoading(true)
    setAnalysis(null)
    setQuotaError(false)
    setFailed(false)
    try {
      const res = await api.analyzeGraph({ image: dataUrl, language, context })
      setAnalysis(res.analysis)
    } catch (err) {
      if (err instanceof ApiError && (err.code === 'daily_limit' || err.code === 'free_limit_exceeded')) {
        setQuotaError(true)
      } else {
        setFailed(true)
      }
    } finally {
      setLoading(false)
    }
  }, [canvasRef, language, context])

  const runRef = useRef(run)
  runRef.current = run

  useEffect(() => {
    if (!open) return
    void runRef.current()
  }, [open, runKey])

  if (!open) return null

  return (
    <Sheet open={open} onClose={onClose}>
      <SheetHeader>
        <SheetTitle>{tt('graphAiVisionTitle')}</SheetTitle>
      </SheetHeader>
      <SheetClose onClose={onClose} label={tt('graphClose')} />
      <SheetBody className="flex max-h-[70dvh] flex-col gap-3 overflow-y-auto">
        {image && (
          <img
            src={image}
            alt={tt('graphAiVisionTitle')}
            className="max-h-36 w-full rounded-2xl object-contain"
          />
        )}

        {loading && (
          <p className="py-4 text-center text-[12.5px] text-pmuted">{tt('graphAiVisionLoading')}</p>
        )}

        {quotaError && (
          <div className="rounded-2xl bg-psurface p-4 text-center">
            <p className="text-[12.5px] text-pmuted">{tt('snapSolveQuotaExceeded')}</p>
            <button
              type="button"
              onClick={() => { onClose(); onPremium() }}
              className="mt-3 h-10 w-full rounded-xl bg-pprimary text-[13px] font-semibold text-ponprimary"
            >
              {tt('aiTestPremiumOnly')}
            </button>
          </div>
        )}

        {failed && !loading && (
          <div className="rounded-2xl bg-psurface p-4 text-center">
            <p className="text-[12.5px] text-pmuted">{tt('graphOpenError')}</p>
            <button
              type="button"
              onClick={() => setRunKey((k) => k + 1)}
              className="mt-3 inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-psurface px-4 text-[13px] font-semibold text-pfg shadow-2xs"
            >
              <RotateCcw size={14} strokeWidth={1.75} />
              {tt('graphAiVisionRetry')}
            </button>
          </div>
        )}

        {analysis && !loading && (
          <MathText text={analysis} as="div" className="text-[13px] leading-relaxed text-pfg" />
        )}
      </SheetBody>
    </Sheet>
  )
}
