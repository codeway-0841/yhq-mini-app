import { PathMascot } from '../../lessons'

/** Reuse the course character without its lesson tile. */
export default function TestHelperAvatar() {
  return (
    <span aria-hidden="true" className="relative block size-14 shrink-0 p-1.5">
      <PathMascot variant="avatar" />
    </span>
  )
}
