// iOS-uslub toggle — knob pozitsiyasi style orqali (brauzerdan mustaqil).
// ON: yashil track + knob o'ngda · OFF: kulrang track + knob chapda.
export default function Toggle({ checked, onChange = () => {}, size = 'md', label }: {
  checked: boolean
  onChange?: (checked: boolean) => void
  size?: 'sm' | 'md'
  /** Accessible name for screen readers */
  label?: string
}) {
  const trackCls = size === 'sm' ? 'w-9 h-5' : 'w-11 h-6'
  const knobPx   = size === 'sm' ? 16 : 20 // knob o'lchami (w/h)
  const padPx    = 2                       // ichki chet
  const travel   = (size === 'sm' ? 36 : 44) - knobPx - padPx * 2 // w-9=36, w-11=44

  return (
    <button
      type="button"
      role="switch"
      aria-checked={!!checked}
      aria-label={label ?? 'Toggle'}
      onClick={() => onChange(!checked)}
      className={`relative flex-none ${trackCls} rounded-full transition-colors duration-200 ${
        checked ? 'bg-duo-green' : 'bg-elevated border border-line'
      }`}
    >
      <span
        className="absolute top-1/2 -translate-y-1/2 bg-white rounded-full shadow transition-transform duration-200"
        style={{
          width: knobPx,
          height: knobPx,
          left: padPx,
          transform: `translateX(${checked ? travel : 0}px) translateY(-50%)`,
          transition: 'transform 0.2s ease',
        }}
      />
    </button>
  )
}
