import { useEffect } from 'react'
import LessonLaunch from './LessonLaunch'
import PracticeWarmUpLaunch from './course-engine/PracticeWarmUpLaunch'
import {
  cancelLessonTransition,
  finishLessonTransition,
  preloadBrilliantTransitionAssets,
  registerLessonTransitionHost,
  useLessonTransitionSnapshot,
} from './lesson-transition'

/**
 * Root-level Brilliant transition host mounted once inside `App.tsx`.
 * Keeps `LessonLaunch` / `PracticeWarmUpLaunch` alive across route navigations
 * (e.g. CourseMap -> TestPage or CourseHome -> CourseMap) so the destination
 * renders underneath and crossfades cleanly without abrupt unmounting.
 */
export default function LessonTransitionHost() {
  const active = useLessonTransitionSnapshot()

  useEffect(() => {
    preloadBrilliantTransitionAssets()
    return registerLessonTransitionHost()
  }, [])

  if (!active) return null

  if (active.kind === 'warmup') {
    return (
      <PracticeWarmUpLaunch
        key={active.id}
        lang={active.lang}
        accent={active.accent}
        colorVariant={active.colorVariant}
        isReady={active.isReady}
        zIndex={70}
        onReveal={active.onReveal}
        onFinish={() => finishLessonTransition(active.id)}
        onCancel={() => cancelLessonTransition(active.id)}
      />
    )
  }

  return (
    <LessonLaunch
      key={active.id}
      origin={active.origin ?? { x: 195, y: 420, size: 48, sink: 36 }}
      lang={active.lang}
      accent={active.accent}
      colorVariant={active.colorVariant}
      isLevel={active.isLevel}
      isReady={active.isReady}
      zIndex={70}
      onReveal={active.onReveal}
      onFinish={() => finishLessonTransition(active.id)}
      onCancel={() => cancelLessonTransition(active.id)}
    />
  )
}
