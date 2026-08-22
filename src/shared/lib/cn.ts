import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Tailwind klasslarni birlashtiradi va TO'QNASHUVLARNI hal qiladi.
 * `clsx` shartli klasslarni yig'adi, `twMerge` esa bir xil guruhdagi
 * oxirgi klassni qoldiradi (`px-4 px-6` → `px-6`) — variant + override
 * naqshi shu tufayli ishlaydi:
 *   <Button className="px-6" />  ← variant'dagi px-4 ni bosadi
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
