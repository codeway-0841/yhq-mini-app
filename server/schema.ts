import { sql } from 'drizzle-orm'
import {
  pgTable, pgEnum, serial, bigint, text,
  integer, boolean, jsonb, timestamp, unique, index, check,
} from 'drizzle-orm/pg-core'

export const tariffEnum   = pgEnum('tariff',     ['free', 'premium'])
export const fontSizeEnum = pgEnum('font_size',  ['small', 'medium', 'large'])
export const fontStyleEnum= pgEnum('font_style', ['default', 'serif', 'mono'])
export const languageEnum = pgEnum('language',   ['uz', 'ru'])
export const themeEnum    = pgEnum('theme',       ['dark', 'light', 'system'])

/** Liga tartibi — YAGONA MANBA. `progress.league` CHECK constraint ham shunga bog'langan. */
export const LEAGUE_ORDER = ['bronze', 'silver', 'gold', 'platinum'] as const
export type League = typeof LEAGUE_ORDER[number]

export const users = pgTable('users', {
  id:        bigint('id', { mode: 'bigint' }).primaryKey(),
  firstName: text('first_name').notNull(),
  lastName:  text('last_name').default(''),
  username:  text('username').default(''),
  photoUrl:  text('photo_url').default(''),
  phone:     text('phone'),
  tariff:    tariffEnum('tariff').default('free').notNull(),
  /** Referal mukofoti: shu san'gacha premium (tariff='premium' umrbod ham bor) */
  premiumUntil: timestamp('premium_until'),
  /** Bepul trial bir marta berilgan vaqt — premiumUntil'dan alohida idempotency flag. */
  trialGrantedAt: timestamp('trial_granted_at'),
  /** Admin panel ruxsati (savol CRUD). Faqat qo'lda DB orqali beriladi. */
  isAdmin:    boolean('is_admin').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdateFn(() => new Date()).notNull(),
})

/** Telegram Stars to'lovlari — charge ID ledger va idempotency manbai. */
export const payments = pgTable('payments', {
  id:                       serial('id').primaryKey(),
  telegramPaymentChargeId:  text('telegram_payment_charge_id').notNull().unique(),
  providerPaymentChargeId:  text('provider_payment_charge_id').notNull(),
  userId:                   bigint('user_id', { mode: 'bigint' }).notNull().references(() => users.id, { onDelete: 'restrict' }),
  plan:                     text('plan').notNull(),
  amount:                   integer('amount').notNull(),
  currency:                 text('currency').notNull(),
  payload:                  text('payload').notNull(),
  status:                   text('status').default('completed').notNull(),
  rawUpdate:                jsonb('raw_update').$type<Record<string, unknown>>().default({}).notNull(),
  createdAt:                timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  index('idx_payments_user_created').on(t.userId, t.createdAt),
])

export const progress = pgTable('progress', {
  id:            serial('id').primaryKey(),
  userId:        bigint('user_id', { mode: 'bigint' }).notNull().references(() => users.id, { onDelete: 'cascade' }).unique(),
  totalCorrect:  integer('total_correct').default(0).notNull(),
  totalWrong:    integer('total_wrong').default(0).notNull(),
  totalAnswered: integer('total_answered').default(0).notNull(),
  streak:        integer('streak').default(0).notNull(),
  wrongByTicket: jsonb('wrong_by_ticket').$type<Record<string, number>>().default({}).notNull(),
  /** @deprecated Streak endi `daily_streaks` jadvalida (fan bo'yicha). Ustun eski migratsiyalar bilan moslik uchun saqlanadi. */
  dailyStreak:   integer('daily_streak').default(0).notNull(),
  /** @deprecated `daily_streaks.last_daily_date` ishlatiladi */
  lastDailyDate: text('last_daily_date'),
  /** Oktagon (PvP) g'alabalar soni — WS server match yakunida yozadi (Yutuqlar) */
  octagonWins:  integer('octagon_wins').default(0).notNull(),
  /** Haftalik liga darajasi — cron har dushanba 30% otiradi/tushiradi */
  league:       text('league').default('bronze').notNull(),
  updatedAt:     timestamp('updated_at').defaultNow().$onUpdateFn(() => new Date()).notNull(),
}, (t) => [
  // Leaderboard queries sort by totalCorrect
  index('idx_progress_total_correct').on(t.totalCorrect.desc()),
  // Data integrity: counterlar manfiy bo'la olmaydi va summa idempotent hisoblanishi shart
  check('chk_progress_nonnegative', sql`
    ${t.totalCorrect} >= 0 AND ${t.totalWrong} >= 0 AND ${t.totalAnswered} >= 0
    AND ${t.streak} >= 0 AND ${t.octagonWins} >= 0
  `),
  check('chk_progress_sum', sql`${t.totalAnswered} = ${t.totalCorrect} + ${t.totalWrong}`),
  // Registrydan tashqari liga qiymati yozilmasligi kerak (LEAGUE_ORDER bilan sinxron)
  check('chk_progress_league', sql`${t.league} IN ('bronze', 'silver', 'gold', 'platinum')`),
])

export const userSettings = pgTable('settings', {
  id:              serial('id').primaryKey(),
  userId:          bigint('user_id', { mode: 'bigint' }).notNull().references(() => users.id, { onDelete: 'cascade' }).unique(),
  autoNextCorrect: boolean('auto_next_correct').default(true).notNull(),
  autoNextWrong:   boolean('auto_next_wrong').default(false).notNull(),
  noAnimation:     boolean('no_animation').default(false).notNull(),
  shuffleOptions:  boolean('shuffle_options').default(false).notNull(),
  fontSize:        fontSizeEnum('font_size').default('medium').notNull(),
  fontStyle:       fontStyleEnum('font_style').default('default').notNull(),
  language:        languageEnum('language').default('uz').notNull(),
  theme:           themeEnum('theme').default('dark').notNull(),
  offlineMode:     boolean('offline_mode').default(false).notNull(),
})

export const topics = pgTable('topics', {
  id:     serial('id').primaryKey(),
  nameUz: text('name_uz').notNull(),
  nameRu: text('name_ru').notNull(),
  slug:   text('slug').notNull().unique(),
})

export const questions = pgTable('questions', {
  id:            integer('id').primaryKey(),
  questionUz:    text('question_uz').notNull(),
  questionRu:    text('question_ru').notNull(),
  optionsUz:     jsonb('options_uz').$type<Record<string, string>>().notNull(),
  optionsRu:     jsonb('options_ru').$type<Record<string, string>>().notNull(),
  correctAnswer: text('correct_answer').notNull(),
  image:         text('image'),
  topicId:       integer('topic_id').references(() => topics.id),
})

/**
 * Savolga oid STATIK tushuntirishlar — free foydalanuvchilar uchun
 * (AI Tutor premium-only). Bo'sh bo'lsa endpoint darslik darsidan
 * derive qilingan fallback matn qaytaradi; admin keyin per-question
 * aniq tushuntirish yozishi mumkin.
 */
export const questionExplanations = pgTable('question_explanations', {
  questionId:    integer('question_id').primaryKey().references(() => questions.id, { onDelete: 'cascade' }),
  explanationUz: text('explanation_uz').notNull(),
  explanationRu: text('explanation_ru').notNull(),
  updatedAt:     timestamp('updated_at').defaultNow().$onUpdateFn(() => new Date()).notNull(),
})

export const savedQuestions = pgTable('saved_questions', {
  id:         serial('id').primaryKey(),
  userId:     bigint('user_id', { mode: 'bigint' }).notNull().references(() => users.id, { onDelete: 'cascade' }),
  questionId: integer('question_id').notNull().references(() => questions.id, { onDelete: 'cascade' }),
}, (t) => [unique('uq_saved').on(t.userId, t.questionId)])

/** Referal qaydlari — referee faqat bir marta hisoblanadi (anti-farm). */
export const referrals = pgTable('referrals', {
  id:         serial('id').primaryKey(),
  referrerId: bigint('referrer_id', { mode: 'bigint' }).notNull().references(() => users.id, { onDelete: 'cascade' }),
  refereeId:  bigint('referee_id', { mode: 'bigint' }).notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt:  timestamp('created_at').defaultNow().notNull(),
}, (t) => [unique('uq_referral_referee').on(t.refereeId)])

/** KPI eventlar (1 haftalik sinov) — activation/retention/premium_click o'lchash */
export const analyticsEvents = pgTable('analytics_events', {  id:        serial('id').primaryKey(),
  userId:    bigint('user_id', { mode: 'bigint' }).references(() => users.id, { onDelete: 'set null' }),
  event:     text('event').notNull(),
  props:     jsonb('props').$type<Record<string, unknown>>().default({}).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  index('idx_events_user_time').on(t.userId, t.createdAt),
  index('idx_events_name_time').on(t.event, t.createdAt),
])

/**
 * Kunlik topshiriq seriyasi — HAR BIR FAN UCHUN ALOHIDA.
 * (user_id, subject_id) juftligi bo'yicha bitta qator: o'sha fanning
 * ketma-ket bajarilgan kunlari soni va oxirgi bajarilgan sana.
 */
/** Cron period ledger — bir job bir davrda faqat bir marta bajariladi. */
export const jobRuns = pgTable('job_runs', {
  id:         serial('id').primaryKey(),
  jobName:    text('job_name').notNull(),
  periodKey:  text('period_key').notNull(),
  status:     text('status').default('running').notNull(),
  startedAt:  timestamp('started_at').defaultNow().notNull(),
  finishedAt: timestamp('finished_at'),
  details:    jsonb('details').$type<Record<string, unknown>>().default({}).notNull(),
}, (t) => [
  unique('uq_job_run_period').on(t.jobName, t.periodKey),
])

export const dailyStreaks = pgTable('daily_streaks', {
  id:            serial('id').primaryKey(),
  userId:        bigint('user_id', { mode: 'bigint' }).notNull().references(() => users.id, { onDelete: 'cascade' }),
  subjectId:     text('subject_id').notNull(),
  /** Shu fan bo'yicha ketma-ket bajarilgan kunlar soni */
  streak:        integer('streak').default(0).notNull(),
  /** Shu fan bo'yicha oxirgi kunlik topshiriq sanasi — 'YYYY-MM-DD' (client local) */
  lastDailyDate: text('last_daily_date'),
  updatedAt:     timestamp('updated_at').defaultNow().$onUpdateFn(() => new Date()).notNull(),
}, (t) => [
  unique('uq_daily_streak').on(t.userId, t.subjectId),
  check('chk_daily_streak_nonnegative', sql`${t.streak} >= 0`),
  check('chk_daily_streak_date_fmt', sql`${t.lastDailyDate} IS NULL OR ${t.lastDailyDate} ~ '^\\d{4}-\\d{2}-\\d{2}$'`),
])

/**
 * Kunlik topshiriq yozuvlari — har kun + fan uchun bitta qator.
 * dailyStreak hisoblash `daily_streaks` jadvalida (lastDailyDate asosida),
 * bu jadval esa tarix/kunlik statistika uchun.
 */
export const dailyRecords = pgTable('daily_records', {
  id:          serial('id').primaryKey(),
  userId:      bigint('user_id', { mode: 'bigint' }).notNull().references(() => users.id, { onDelete: 'cascade' }),
  /** 'YYYY-MM-DD' — client local sanasi (Telegram user o'z vaqt zonasi) */
  date:        text('date').notNull(),
  subjectId:   text('subject_id').notNull(),
  answered:    integer('answered').default(0).notNull(),
  correct:     integer('correct').default(0).notNull(),
  /** Shu kunda tuzatilgan eski xatolar soni (Intizom sahifasidagi "TUZATILDI") */
  fixed:       integer('fixed').default(0).notNull(),
  /** Kunlik 5 talik topshiriq yakunlandimi (Dashboard'dagi "Tayyor" belgisi) */
  challengeDone: boolean('challenge_done').default(false).notNull(),
  completedAt: timestamp('completed_at').defaultNow().notNull(),
}, (t) => [
  unique('uq_daily_record').on(t.userId, t.date, t.subjectId),
  index('idx_daily_user_date').on(t.userId, t.date),
  // Data integrity: answered/correct/fixed manfiy bo'lmasligi va correct answered'dan
  // oshmasligi shart (bug yoki xato requestdan shubhali statistika paydo bo'lmasin).
  check('chk_daily_record_nonnegative', sql`${t.answered} >= 0 AND ${t.fixed} >= 0`),
  check('chk_daily_record_correct_le', sql`${t.correct} BETWEEN 0 AND ${t.answered}`),
  check('chk_daily_record_date_fmt', sql`${t.date} ~ '^\\d{4}-\\d{2}-\\d{2}$'`),
])
