/**
 * Referral konstantalari — YAGONA MANBA.
 * users.service (init'da pending qayd) VA progress.repository (aktivlik
 * darajasida mukofot CTE) ikkalasi import qiladi — aylanma import bo'lmasligi
 * uchun konstantalar alohida modulda.
 */

/** Referrer VA refereega beriladigan mukofot (kun) */
export const REFERRAL_REWARD_DAYS = 3

/** Bitta referrer mukofot olishi mumkin bo'lgan MAKSIMAL referallar soni (farming himoyasi).
 *  Haqiqiy gate — har referee YANGI TG akkaunt (referee UNIQUE); telefon ulash
 *  trigger'i marketing (verified raqam) va qulaylik uchun. */
export const REFERRAL_MAX_REWARDED = 50
