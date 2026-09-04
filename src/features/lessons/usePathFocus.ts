import { useEffect, useRef, type RefObject } from 'react'
import type { PathSelection } from './LearningPath'

export function nearestPathNode(centres: number[], top: number, bottom: number) {
  const target = top + (bottom - top) * .6
  let best = -1
  let distance = Infinity
  centres.forEach((centre, index) => {
    if (centre < top || centre > bottom) return
    const next = Math.abs(centre - target)
    if (next < distance) { distance = next; best = index }
  })
  return best
}

/** One passive listener for the course. React updates only when the focused node changes. */
export function usePathFocus(root: RefObject<HTMLDivElement>, paused: boolean,
  onFocus: (selection: PathSelection, node: HTMLButtonElement) => void) {
  const callback = useRef(onFocus)
  callback.current = onFocus
  useEffect(() => {
    if (paused || !root.current) return
    const course = root.current
    const nodes = Array.from(course.querySelectorAll<HTMLButtonElement>('[data-path-node]'))
    let frame = 0
    const measure = () => {
      frame = 0
      const headerBottom = course.querySelector('header')?.getBoundingClientRect().bottom ?? 60
      const dockTop = course.querySelector('.lesson-preview-wrap')?.getBoundingClientRect().top ?? window.innerHeight - 180
      const top = Math.max(0, headerBottom) + 90
      const bottom = Math.max(top + 100, Math.min(dockTop - 12, window.innerHeight - 110))
      const centres = nodes.map(node => {
        const box = node.getBoundingClientRect()
        return box.height > 0 ? box.top + box.height * .66 : -Infinity
      })
      const index = nearestPathNode(centres, top, bottom)
      if (index < 0) return
      const node = nodes[index]
      callback.current({
        moduleId: Number(node.dataset.module),
        idx: Number(node.dataset.lesson),
        check: node.dataset.check === 'true',
      }, node)
    }
    const schedule = () => { if (!frame) frame = requestAnimationFrame(measure) }
    schedule()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
    }
  }, [root, paused])
}
