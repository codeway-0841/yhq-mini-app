/**
 * Boot splash ekrandan chiqqanini bildiruvchi signal.
 *
 * Video referensi (3.8–4.6s): ko'k launch ekran ilova ustida SO'NIB o'tadi
 * (cross-fade), ilova bloklari ko'k ostidan ko'rina boshlaydi. React'da
 * unmount bo'layotgan elementni animatsiya qilib bo'lmaydi, shuning uchun
 * SplashScreen unmount paytida shu signalni beradi — LaunchExitOverlay esa
 * splash'ning "so'nayotgan" nusxasini ilova ustida 300ms chizadi.
 */
type Listener = () => void

const listeners = new Set<Listener>()

export function onLaunchDismissed(fn: Listener): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

export function notifyLaunchDismissed(): void {
  // Nusxa bo'yicha iteratsiya: listener o'zini ichida olib tashlashi mumkin
  for (const fn of [...listeners]) fn()
}
