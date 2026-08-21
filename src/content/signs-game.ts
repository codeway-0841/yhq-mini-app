/**
 * BELGILAR O'YINI — haqiqiy YHQ belgilari katalogi (curated subset, SSOT).
 *
 * Sof statik kontent (AGENTS: content/ kod import qilmaydi).
 * Ko'rinish: SXEMATIK chizma (shakl + fon + ramka + piktogramma) —
 * belgilarning farqlash kaliti aynan shu xususiyatlarda. Emoji faqat
 * piktogramma o'rnida; haqiqiy rasm banki kelgach FAQAT shu fayl
 * almashtiriladi (renderer o'zgarmaydi).
 *
 * `num` — rasmiy tartib raqami faqat nashrdan nashrga o'zgarmagan
 * belgilar uchun; noaniq raqamli o'larda null (soxta aniqlik ko'rsatilmaydi).
 * Desync'ni tests/unit/features/sign-game.test.ts ushlaydi.
 */

export type SignShape = 'triangle' | 'triangle-down' | 'octagon' | 'circle' | 'square' | 'diamond'

export interface GameSign {
  id: string
  /** Rasmiy tartib raqami (mas: '3.1'); ishonchsizlar uchun null */
  num: string | null
  name: { uz: string; ru: string }
  shape: SignShape
  /** Asosiy fon rangi */
  bg: string
  /** Ramka/kontur rangi (null = yo'q) */
  rim: string | null
  /** Ichki belgi turi */
  content: { kind: 'emoji' | 'text' | 'bar' | 'cross' | 'slash' | 'none'; value?: string; color?: string }
}

const WHITE = '#ffffff'
const RED = '#dc2626'
const BLUE = '#1d4ed8'
const GREEN = '#16a34a'
const YELLOW = '#facc15'
const BLACK = '#111827'

export const GAME_SIGNS: readonly GameSign[] = [
  // ── Ogohlantiruvchi (qizil uchburchak) ──
  { id: 'svetofor',       num: '1.8', name: { uz: 'Svetofor',                    ru: 'Светофор'                  }, shape: 'triangle', bg: WHITE, rim: RED, content: { kind: 'emoji', value: '🚦' } },
  { id: 'bolalar',        num: null,  name: { uz: 'Bolalar',                     ru: 'Дети'                      }, shape: 'triangle', bg: WHITE, rim: RED, content: { kind: 'emoji', value: '👶' } },
  { id: 'chorva',         num: null,  name: { uz: 'Chorva hayvonlari',           ru: 'Перегон скота'             }, shape: 'triangle', bg: WHITE, rim: RED, content: { kind: 'emoji', value: '🐄' } },
  { id: 'yovvoyi',        num: null,  name: { uz: 'Yovvoyi hayvonlar',           ru: 'Дикие животные'            }, shape: 'triangle', bg: WHITE, rim: RED, content: { kind: 'emoji', value: '🦌' } },
  { id: 'temir-yol',      num: '1.1', name: { uz: "Temir yo'l kesishmasi",       ru: 'Железнодорожный переезд'   }, shape: 'triangle', bg: WHITE, rim: RED, content: { kind: 'emoji', value: '🚂' } },
  { id: 'ikki-tomonlama', num: null,  name: { uz: 'Ikki tomonlama harakat',      ru: 'Двустороннее движение'     }, shape: 'triangle', bg: WHITE, rim: RED, content: { kind: 'text', value: '⇅', color: BLACK } },

  // ── Imtiyoz ──
  { id: 'asosiy-yol',     num: '2.1', name: { uz: "Asosiy yo'l",                 ru: 'Главная дорога'            }, shape: 'diamond', bg: YELLOW, rim: BLACK, content: { kind: 'none' } },
  { id: 'yol-bering',     num: '2.4', name: { uz: "Yo'l bering",                 ru: 'Уступите дорогу'           }, shape: 'triangle-down', bg: WHITE, rim: RED, content: { kind: 'none' } },
  { id: 'stop',           num: '2.5', name: { uz: 'STOP — to\'xtash shart',      ru: 'Остановка обязательна'     }, shape: 'octagon', bg: RED, rim: WHITE, content: { kind: 'text', value: 'STOP', color: WHITE } },

  // ── Taqiqlovchi (qizil doira) ──
  { id: 'kirish-taqiq',   num: '3.1', name: { uz: 'Kirish taqiqlangan',          ru: 'Въезд запрещён'            }, shape: 'circle', bg: RED, rim: null, content: { kind: 'bar' } },
  { id: 'harakat-taqiq',  num: '3.2', name: { uz: 'Harakat taqiqlangan',         ru: 'Движение запрещено'        }, shape: 'circle', bg: WHITE, rim: RED, content: { kind: 'none' } },
  { id: 'velo-taqiq',     num: null,  name: { uz: 'Velosiped taqiqlangan',       ru: 'Велосипед запрещён'        }, shape: 'circle', bg: WHITE, rim: RED, content: { kind: 'emoji', value: '🚲' } },
  { id: 'quvish-taqiq',   num: '3.20', name: { uz: 'Quvish taqiqlangan',         ru: 'Обгон запрещён'            }, shape: 'circle', bg: WHITE, rim: RED, content: { kind: 'emoji', value: '🚗' } },
  { id: 'tezlik-60',      num: '3.24', name: { uz: 'Tezlik cheklangan',          ru: 'Ограничение скорости'      }, shape: 'circle', bg: WHITE, rim: RED, content: { kind: 'text', value: '60', color: BLACK } },
  { id: 'toxtash-taqiq',  num: '3.27', name: { uz: "To'xtash taqiqlangan",       ru: 'Остановка запрещена'       }, shape: 'circle', bg: BLUE, rim: RED, content: { kind: 'cross' } },
  { id: 'turish-taqiq',   num: '3.28', name: { uz: "To'xtatib turish taqiqlangan", ru: 'Стоянка запрещена'       }, shape: 'circle', bg: BLUE, rim: RED, content: { kind: 'slash' } },

  // ── Buyuruvchi (ko'k doira) ──
  { id: 'togri-yurish',   num: '4.1.1', name: { uz: "To'g'riga harakatlanish",   ru: 'Движение прямо'            }, shape: 'circle', bg: BLUE, rim: null, content: { kind: 'text', value: '↑', color: WHITE } },
  { id: 'ongga-yurish',   num: '4.1.2', name: { uz: "O'ngga harakatlanish",      ru: 'Движение направо'          }, shape: 'circle', bg: BLUE, rim: null, content: { kind: 'text', value: '→', color: WHITE } },
  { id: 'chapga-yurish',  num: '4.1.3', name: { uz: 'Chapga harakatlanish',      ru: 'Движение налево'           }, shape: 'circle', bg: BLUE, rim: null, content: { kind: 'text', value: '←', color: WHITE } },
  { id: 'aylanma',        num: '4.3', name: { uz: 'Aylanma harakat',             ru: 'Круговое движение'         }, shape: 'circle', bg: BLUE, rim: null, content: { kind: 'text', value: '↻', color: WHITE } },

  // ── Axborot-ishora ──
  { id: 'piyodalar',      num: '5.19.1', name: { uz: "Piyodalar o'tish joyi",    ru: 'Пешеходный переход'        }, shape: 'square', bg: BLUE, rim: WHITE, content: { kind: 'emoji', value: '🚶' } },
  { id: 'avtomagistral',  num: '5.3', name: { uz: 'Avtomagistral',               ru: 'Автомагистраль'            }, shape: 'square', bg: GREEN, rim: WHITE, content: { kind: 'emoji', value: '🛣️' } },
  { id: 'turargoh',       num: '6.14', name: { uz: 'Avtoturargoh',               ru: 'Парковка'                  }, shape: 'square', bg: BLUE, rim: WHITE, content: { kind: 'text', value: 'P', color: WHITE } },

  // ── Servis ──
  { id: 'yoqilgi',        num: null,  name: { uz: "Yoqilg'i stansiyasi",         ru: 'Заправка'                  }, shape: 'square', bg: WHITE, rim: BLUE, content: { kind: 'emoji', value: '⛽' } },
  { id: 'ovqat',          num: null,  name: { uz: 'Oziq-ovqat punkti',           ru: 'Пункт питания'             }, shape: 'square', bg: WHITE, rim: BLUE, content: { kind: 'emoji', value: '🍴' } },
  { id: 'texnik',         num: null,  name: { uz: 'Texnik xizmat',               ru: 'Техническое обслуживание'  }, shape: 'square', bg: WHITE, rim: BLUE, content: { kind: 'emoji', value: '🔧' } },
  { id: 'mehmonxona',     num: null,  name: { uz: 'Mehmonxona',                  ru: 'Гостиница'                 }, shape: 'square', bg: WHITE, rim: BLUE, content: { kind: 'emoji', value: '🏨' } },
] as const

export function getGameSign(id: string): GameSign | null {
  return GAME_SIGNS.find((s) => s.id === id) ?? null
}
