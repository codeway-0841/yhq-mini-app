import {
  pgTable, pgEnum, serial, bigint, text,
  integer, boolean, jsonb, timestamp, unique, index,
} from 'drizzle-orm/pg-core'

export const tariffEnum   = pgEnum('tariff',     ['free', 'premium'])
export const fontSizeEnum = pgEnum('font_size',  ['small', 'medium', 'large'])
export const fontStyleEnum= pgEnum('font_style', ['default', 'serif', 'mono'])
export const languageEnum = pgEnum('language',   ['uz', 'ru'])
export const themeEnum    = pgEnum('theme',       ['dark', 'light', 'system'])

export const users = pgTable('users', {
  id:        bigint('id', { mode: 'bigint' }).primaryKey(),
  firstName: text('first_name').notNull(),
  lastName:  text('last_name').default(''),
  username:  text('username').default(''),
  photoUrl:  text('photo_url').default(''),
  phone:     text('phone'),
  tariff:    tariffEnum('tariff').default('free').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdateFn(() => new Date()).notNull(),
})

export const progress = pgTable('progress', {
  id:            serial('id').primaryKey(),
  userId:        bigint('user_id', { mode: 'bigint' }).notNull().references(() => users.id, { onDelete: 'cascade' }).unique(),
  totalCorrect:  integer('total_correct').default(0).notNull(),
  totalWrong:    integer('total_wrong').default(0).notNull(),
  totalAnswered: integer('total_answered').default(0).notNull(),
  streak:        integer('streak').default(0).notNull(),
  wrongByTicket: jsonb('wrong_by_ticket').$type<Record<string, number>>().default({}).notNull(),
  updatedAt:     timestamp('updated_at').defaultNow().$onUpdateFn(() => new Date()).notNull(),
}, (t) => [
  // Leaderboard queries sort by totalCorrect
  index('idx_progress_total_correct').on(t.totalCorrect.desc()),
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

export const savedQuestions = pgTable('saved_questions', {
  id:         serial('id').primaryKey(),
  userId:     bigint('user_id', { mode: 'bigint' }).notNull().references(() => users.id, { onDelete: 'cascade' }),
  questionId: integer('question_id').notNull().references(() => questions.id, { onDelete: 'cascade' }),
}, (t) => [unique('uq_saved').on(t.userId, t.questionId)])
