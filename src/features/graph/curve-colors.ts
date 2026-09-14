/** Egri chiziq ranglari — dark/light ikkalasida ham ko'rinadigan palitra. */
export const CURVE_COLORS = [
  '#2f80ed',
  '#e5484d',
  '#30a46c',
  '#f5a524',
  '#8e4ec6',
  '#e93d82',
] as const

export function curveColor(colorIdx: number): string {
  return CURVE_COLORS[((colorIdx % CURVE_COLORS.length) + CURVE_COLORS.length) % CURVE_COLORS.length]
}
