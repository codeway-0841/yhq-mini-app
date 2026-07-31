import { Loader2 } from 'lucide-react'

/** Full-area spinner used as the Suspense fallback while lazy pages load. */
export default function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]" role="status" aria-label="Yuklanmoqda">
      <Loader2 size={28} className="text-[#1f6feb] animate-spin" />
    </div>
  )
}
