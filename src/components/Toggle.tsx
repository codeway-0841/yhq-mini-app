// size: 'sm' (w-10/h-5) | 'md' (w-11/h-6, default)
export default function Toggle({ checked, onChange = () => {}, size = 'md' }: {
  checked: boolean
  onChange?: (checked: boolean) => void
  size?: 'sm' | 'md'
}) {
  const track = size === 'sm' ? 'w-10 h-5' : 'w-11 h-6'
  const thumb = size === 'sm' ? 'w-4 h-4 top-0.5' : 'w-5 h-5 top-0.5'
  return (
    <button
      type="button"
      role="switch"
      aria-checked={!!checked}
      onClick={() => onChange(!checked)}
      className={`relative ${track} rounded-full transition-colors ${
        checked ? 'bg-[#1f6feb]' : 'bg-[#30363d]'
      }`}
    >
      <span
        className={`absolute ${thumb} bg-white rounded-full shadow transition-transform ${
          checked
            ? size === 'sm' ? 'translate-x-5' : 'translate-x-[22px]'
            : 'translate-x-0.5'
        }`}
      />
    </button>
  )
}
