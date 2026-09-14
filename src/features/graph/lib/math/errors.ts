/** Ifoda xatolari — kod bo'yicha i18n xabari ko'rsatiladi (matn serverga yuborilmaydi). */
export type ExprErrorCode =
  | 'empty'
  | 'too_long'
  | 'too_complex'
  | 'unexpected_token'
  | 'unexpected_end'
  | 'bad_function'
  | 'arity'

export class ExprError extends Error {
  readonly code: ExprErrorCode
  readonly pos: number
  readonly detail?: string

  constructor(code: ExprErrorCode, pos: number, detail?: string) {
    super(`${code}@${pos}${detail ? `:${detail}` : ''}`)
    this.name = 'ExprError'
    this.code = code
    this.pos = pos
    this.detail = detail
  }
}
