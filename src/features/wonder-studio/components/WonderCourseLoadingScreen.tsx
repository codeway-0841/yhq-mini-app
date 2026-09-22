import { WonderLoadingBlob } from './WonderIcons'

interface WonderCourseLoadingScreenProps {
  message?: string
  className?: string
}

/**
 * 1:1 Authentic Wondering Course Loading Screen
 * Faithfully recreated from course_path_view.png
 */
export default function WonderCourseLoadingScreen({
  message = 'Loading course...',
  className = '',
}: WonderCourseLoadingScreenProps) {
  return (
    <div
      className={`size-full min-h-[460px] flex-1 flex flex-col items-center justify-center bg-[#F6F4EE] dark:bg-[#150F0D] select-none animate-in fade-in duration-150 ${className}`}
    >
      <WonderLoadingBlob size={72} />
      <p className="mt-4 text-xs sm:text-sm font-sans font-medium text-[#7B6E60] dark:text-stone-400">
        {message}
      </p>
    </div>
  )
}
