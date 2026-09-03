import { Skeleton, SkeletonCard } from './ui/skeleton'

/**
 * Lazy sahifa yuklanayotgandagi Suspense fallback.
 *
 * v3: aylanuvchi spinner O'RNIGA kontent shakliga mos skelet — foydalanuvchi
 * "nima kelayotganini" ko'radi va sahifa chizilganda layout sakramaydi.
 * Skeletning o'zi `motion-safe:` orqali animatsiyalanadi.
 */
export default function PageLoader() {
  return (
    <div role="status" aria-label="Yuklanmoqda">
      {/* Tepa safe-area bo'sh qolib miltillamasligi uchun soxta header qoplamasi */}
      <div className="-mt-[var(--safe-top-body,0px)] pt-[var(--safe-top,0px)] bg-pcanvas" />
      <div className="px-5 pt-6">
      <div className="mb-6 flex items-center gap-3">
        <Skeleton className="size-9 rounded-xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-2.5 w-20" />
        </div>
      </div>
      <SkeletonCard className="mb-6 h-20" />
      <div className="mb-2.5 flex items-center justify-between">
        <Skeleton className="h-3.5 w-24" />
        <Skeleton className="h-3 w-12" />
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <SkeletonCard className="h-[58px]" />
        <SkeletonCard className="h-[58px]" />
        <SkeletonCard className="h-[58px]" />
        <SkeletonCard className="h-[58px]" />
      </div>
      </div>
    </div>
  )
}
