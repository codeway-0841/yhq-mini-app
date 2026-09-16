/**
 * Son formatlash SSOT — butun ilovada minglik ajratgich BIR XIL (oddiy bo'shliq).
 *
 * Nega markaziy: `Number.toLocaleString()` brauzer locale'iga bog'liq
 * (vergul/nuqta/tor bo'shliq aralashar edi — Shop `fmtCoins`, MerchSection
 * `ru-RU`, BossCard default locale uch xil ko'rinardi). `formatUzs`
 * (so'm + til qo'shimchasi) `shared/premium-plans.ts`da qoladi — bu faqat
 * sof raqamlar (coin, HP, statistika) uchun.
 */
export function formatCoins(n: number): string {
  const int = Number.isFinite(n) ? Math.trunc(n) : 0
  return int.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
}
