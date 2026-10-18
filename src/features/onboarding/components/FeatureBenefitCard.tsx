import type { LucideIcon } from 'lucide-react'

interface FeatureBenefitCardProps {
  icon: LucideIcon
  iconColor: string
  title: string
}

/**
 * Welcome ekranidagi afzallik qatori — IMG_0928.MOV 1:1.
 * Video o'lchovi: 342×54px, radius 16px, fon #1B1A20, ikonka 18px (chapdan
 * 20px), matn 16px (ikonkadan 17px keyin).
 */
export function FeatureBenefitCard({
  icon: Icon,
  iconColor,
  title,
}: FeatureBenefitCardProps) {
  return (
    <div className="flex h-[clamp(46px,6.77vh,54px)] w-full items-center gap-[17px] rounded-2xl bg-white/[0.08] px-5 text-left select-none">
      <Icon size={18} className={`shrink-0 ${iconColor}`} strokeWidth={2.5} />
      <span className="truncate text-[16px] font-medium tracking-[-0.01em] text-white">
        {title}
      </span>
    </div>
  )
}
