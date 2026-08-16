import type { Page } from '@playwright/test'

export const mockProfile = {
  user: {
    id: '123456789',
    firstName: 'Test',
    username: 'testuser',
    tariff: 'free',
    photoUrl: '',
  },
  progress: {
    totalCorrect: 50,
    totalWrong: 5,
    totalAnswered: 55,
    streak: 5,
    wrongByTicket: {},
    solvedQuestions: [],
  },
  settings: {
    autoNextCorrect: true,
    autoNextWrong: false,
    noAnimation: true,
    shuffleOptions: false,
    fontSize: 'medium',
    fontStyle: 'default',
    language: 'uz',
    theme: 'dark',
    offlineMode: false,
    dailyReminder: false,
    dailyReminderTime: '20:00',
  },
  savedQuestions: [],
  providers: ['telegram'],
}

const mockQuestions = Array.from({ length: 40 }, (_, i) => ({
  id: i + 1,
  bankId: 'traffic_rules_db',
  externalId: String(i + 1),
  questionUz: `Test savol ${i + 1}`,
  questionRu: `Тестовый вопрос ${i + 1}`,
  optionsUz: { a: 'Variant A', b: 'Variant B', c: 'Variant C' },
  optionsRu: { a: 'Вариант А', b: 'Вариант Б', c: 'Вариант В' },
  topicId: 1,
  image: null,
}))

const mockTopics = [
  { id: 1, nameUz: 'Umumiy qoidalar', nameRu: 'Общие правила', bankId: 'traffic_rules_db' },
]

export async function injectTelegramWebApp(page: Page, overrides: Record<string, any> = {}) {
  // Mock API requests — strictly match /api/* routes and NOT /src/shared/api/* source files
  await page.route(
    (url) => url.pathname.startsWith('/api/') && !url.pathname.includes('/src/'),
    async (route) => {
      const url = route.request().url()
      if (
        url.includes('/api/init') ||
        url.includes('/api/auth/me') ||
        url.includes('/api/profile') ||
        url.includes('/api/users/')
      ) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockProfile),
        })
      } else if (url.includes('/api/questions')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockQuestions),
        })
      } else if (url.includes('/api/topics')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockTopics),
        })
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ok: true }),
        })
      }
    },
  )

  await page.addInitScript((data) => {
    try {
      localStorage.setItem('yhq-onboarded', '1')
      localStorage.setItem(
        'yhq-app-store',
        JSON.stringify({
          state: {
            user: {
              id: '123456789',
              firstName: 'Test',
              username: 'testuser',
              photoUrl: '',
              tariff: 'free',
            },
            settings: {
              language: 'uz',
              theme: 'dark',
              sound: false,
              vibration: false,
              autoNext: true,
              fontSize: 'medium',
              noAnimation: true,
              lowDataMode: false,
            },
            initialized: true,
            streak: 5,
            totalCorrect: 50,
            totalWrong: 5,
            totalAnswered: 55,
            tariff: 'free',
            accent: 'classic',
          },
          version: 0,
        }),
      )
    } catch {
      // ignore
    }

    ;(window as any).Telegram = {
      WebApp: {
        ready: () => {},
        expand: () => {},
        close: () => {},
        openTelegramLink: () => {},
        shareURL: () => {},
        initData:
          'query_id=mock&user=%7B%22id%22%3A123456789%2C%22first_name%22%3A%22Test%22%2C%22username%22%3A%22testuser%22%7D&auth_date=1700000000&hash=mockhash',
        initDataUnsafe: {
          user: { id: 123456789, first_name: 'Test', username: 'testuser' },
          auth_date: 1700000000,
          hash: 'mockhash',
        },
        colorScheme: 'dark',
        themeParams: {
          bg_color: '#0f172a',
          text_color: '#f8fafc',
          button_color: '#22c55e',
          button_text_color: '#ffffff',
        },
        MainButton: {
          text: '',
          isVisible: false,
          isActive: true,
          setText(t: string) {
            this.text = t
          },
          show() {
            this.isVisible = true
          },
          hide() {
            this.isVisible = false
          },
          enable() {
            this.isActive = true
          },
          disable() {
            this.isActive = false
          },
          onClick(fn: () => void) {
            ;(window as any).__mainButtonClick = fn
          },
          offClick() {
            ;(window as any).__mainButtonClick = null
          },
        },
        BackButton: {
          isVisible: false,
          show() {
            this.isVisible = true
          },
          hide() {
            this.isVisible = false
          },
          onClick() {},
          offClick() {},
        },
        HapticFeedback: {
          impactOccurred: () => {},
          notificationOccurred: () => {},
          selectionChanged: () => {},
        },
        showAlert: (_msg: string, cb?: () => void) => cb?.(),
        showConfirm: (_msg: string, cb?: (ok: boolean) => void) => cb?.(true),
        version: '7.0',
        platform: 'android',
        ...data,
      },
    }
  }, overrides)
}
