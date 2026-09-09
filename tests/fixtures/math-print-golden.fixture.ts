/**
 * Golden Fixture Suite for Matematika Test Print Bank.
 * Defines the ground truth expectations for the 8 critical regression cases:
 * 1. Formula bleed between questions (mtp-algebra-001-02 / 001-03)
 * 2. System/cases split across two questions & duplicate marker (mtp-algebra-004-12 / 004-13)
 * 3. Duplicate option marker & formula bleeding (mtp-algebra-074-20)
 * 4. Fractions, radicals, and interval notations (mtp-algebra-032-08)
 * 5. Mixed fractions and exponents (mtp-algebra-096-03)
 * 6. Diagram coordinate labels leaking into text & bleeding (mtp-algebra-020-08)
 * 7. Geometry diagram labels leaking into question text (mtp-geometriya-017-06)
 * 8. Coordinate axis grid numbers leaking into question text (mtp-algebra-geometriya-104-22)
 */

export interface GoldenExpectation {
  externalId: string
  forbiddenInQuestion: string[]
  requiredInQuestion: string[]
  forbiddenInOptions: string[]
  expectedOptions: Record<string, string | RegExp>
  correctAnswer: string
  hasImage: boolean
}

export const GOLDEN_FIXTURES: Record<string, GoldenExpectation> = {
  'mtp-algebra-001-02': {
    externalId: 'mtp-algebra-001-02',
    forbiddenInQuestion: ['n^2', 'n_{2}', 'n + 3'],
    requiredInQuestion: ['Qaysi javobda berilgan xossa 1 soni uchun o‘rinli?'],
    forbiddenInOptions: ['n^2', 'n_{2}', 'n + 3', 'n+3'],
    expectedOptions: {
      A1: 'u tub son.',
      A2: 'u murakkab son.',
      A3: 'u na tub, na murakkab son.',
      A4: 'u eng kichik butun son.',
    },
    correctAnswer: 'A3',
    hasImage: false,
  },

  'mtp-algebra-001-03': {
    externalId: 'mtp-algebra-001-03',
    forbiddenInQuestion: [],
    requiredInQuestion: [
      'Agar n natural son uchun',
      'kasrning qiymati',
      '(2; 3) oralig‘ida joylashgan bo‘lsa',
    ],
    forbiddenInOptions: ['kasr'],
    expectedOptions: {
      A1: '2,75.',
      A2: '2,5.',
      A3: '2,25.',
      A4: '2,4.',
    },
    correctAnswer: 'A3',
    hasImage: false,
  },

  'mtp-algebra-004-12': {
    externalId: 'mtp-algebra-004-12',
    forbiddenInQuestion: ['⎧', '⎨', '⎪', '⎩', 'cases'],
    requiredInQuestion: ['tenglamaning a \\ge 3 bo‘lgandagi ildizlari yig‘indisini toping.'],
    forbiddenInOptions: ['⎧', '⎨', '⎪', '⎩', 'cases', '< x'],
    expectedOptions: {
      A1: '-4.',
      A2: '4.',
      A3: '-3.',
      A4: '0.',
    },
    correctAnswer: 'A4',
    hasImage: false,
  },

  'mtp-algebra-004-13': {
    externalId: 'mtp-algebra-004-13',
    forbiddenInQuestion: ['⎧', '⎨', '⎪', '⎩'], // Must be converted to LaTeX cases or semantic system
    requiredInQuestion: [
      'cases',
      'tengsizliklar sistemasining butun yechimlari yig‘indisini toping.',
    ],
    forbiddenInOptions: ['⎧', '⎨', '⎪', '⎩', 'cases'],
    expectedOptions: {
      A1: '7.',
      A2: '8.',
      A3: '9.',
      A4: '12.',
    },
    correctAnswer: 'A1',
    hasImage: false,
  },

  'mtp-algebra-074-20': {
    externalId: 'mtp-algebra-074-20',
    forbiddenInQuestion: ['A) 1.', 'A) 1', '3\\pi'],
    requiredInQuestion: ['Agar a = 2 bo‘lsa, ifodani soddalashtiring:'],
    forbiddenInOptions: ['3\\pi', '3pi'],
    expectedOptions: {
      A1: '1.',
      A2: '2.',
      A3: '3.',
      A4: '4.',
    },
    correctAnswer: 'A3',
    hasImage: false,
  },

  'mtp-algebra-032-08': {
    externalId: 'mtp-algebra-032-08',
    forbiddenInQuestion: ['6\\sqrt', '4 7 -x'],
    requiredInQuestion: ['funksiyaning aniqlanish sohasini toping.'],
    forbiddenInOptions: ['3 4', '3 7'],
    expectedOptions: {
      A1: /\\frac\{3\}\{7\}|3\/7/,
      A2: /\\cup/,
      A3: /\\frac\{3\}\{4\}|3\/4/,
      A4: /\\frac\{3\}\{4\}|3\/4/,
    },
    correctAnswer: 'A2',
    hasImage: false,
  },

  'mtp-algebra-096-03': {
    externalId: 'mtp-algebra-096-03',
    forbiddenInQuestion: ['382 -232'],
    requiredInQuestion: ['Ifodaning qiymatini toping:'],
    forbiddenInOptions: [],
    expectedOptions: {
      A1: '0,8.',
      A2: '0,1.',
      A3: '0,2.',
      A4: '0,4.',
    },
    correctAnswer: 'A4',
    hasImage: false,
  },

  'mtp-algebra-020-08': {
    externalId: 'mtp-algebra-020-08',
    forbiddenInQuestion: ['x y 0', 'x y', '0 x y'],
    requiredInQuestion: ['Grafigi chizmada keltirilgan', 'funksiya uchun to‘g‘ri tasdiqni ko‘rsating'],
    forbiddenInOptions: ['\\sqrt{4}', 'sqrt'],
    expectedOptions: {
      A1: 'ab > 0.',
      A2: 'bc < 0.',
      A3: 'aD < 0.',
      A4: 'bD < 0.',
    },
    correctAnswer: 'A1',
    hasImage: true,
  },

  'mtp-geometriya-017-06': {
    externalId: 'mtp-geometriya-017-06',
    forbiddenInQuestion: ['M N E O', '35^{\\circ}', '25^{\\circ}', '35◦', '25◦'],
    requiredInQuestion: ['Chizmadagi NOE burchakni toping.'],
    forbiddenInOptions: ['M', 'N', 'E', 'O'],
    expectedOptions: {
      A1: '105^{\\circ}.',
      A2: '110^{\\circ}.',
      A3: '120^{\\circ}.',
      A4: '135^{\\circ}.',
    },
    correctAnswer: 'A3',
    hasImage: true,
  },

  'mtp-algebra-geometriya-104-22': {
    externalId: 'mtp-algebra-geometriya-104-22',
    forbiddenInQuestion: ['1 2 3 4 5 6', '-1 -2 -3', 'y=f(x)', 'x y 0'],
    requiredInQuestion: ['funksiya grafigidan foydalanib', 'barcha yechimlari to‘plamini toping.'],
    forbiddenInOptions: [],
    expectedOptions: {
      A1: '{-1; 2; 3; 4; 5}.',
      A2: '{-1; 3; 5}.',
      A3: '{-1; 0; 2; 3; 5}.',
      A4: '{-1; 1; 3; 4; 5}.',
    },
    correctAnswer: 'A1',
    hasImage: true,
  },
}
