import { PathMascot } from '../../lessons'

/** Reuse the course character without its lesson tile. */
export default function TestHelperAvatar() {
  return (
    <span aria-hidden="true" className="relative block size-16 shrink-0 [&>.learning-mascot]:left-3 [&>.learning-mascot]:top-3 [&>.learning-mascot]:h-10 [&>.learning-mascot]:w-10">
      <PathMascot />
    </span>
  )
}
