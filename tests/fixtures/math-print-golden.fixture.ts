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
      A1: /\\frac\{3\}\{4\}|3\/4/,
      A2: /\\cup/,
      A3: /4/,
      A4: /7/,
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
    forbiddenInQuestion: ['M N E O', '35◦', '25◦'],
    requiredInQuestion: ['Chizmadagi NOE burchakni toping.'],
    forbiddenInOptions: ['M', 'N', 'E', 'O'],
    expectedOptions: {
      A1: /105/,
      A2: /110/,
      A3: /120/,
      A4: /135/,
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
      A1: /\{[- ]*1;\s*2;\s*3;\s*4;\s*5\}/,
      A2: /\{[- ]*1;\s*3;\s*5\}/,
      A3: /\{[- ]*1;\s*0;\s*2;\s*3;\s*5\}/,
      A4: /\{[- ]*1;\s*1;\s*3;\s*4;\s*5\}/,
    },
    correctAnswer: 'A1',
    hasImage: true,
  },

  'mtp-algebra-006-09': {
    externalId: 'mtp-algebra-006-09',
    forbiddenInQuestion: ['⎧', '⎨', '⎪', '⎩', '√'],
    requiredInQuestion: ["Chizmada qaysi funksiya g"],
    forbiddenInOptions: ['⎧', '⎨', '⎪', '⎩', '√'],
    expectedOptions: {
      A1: "y = sin x + \\frac{\\pi}{6} .",
      A2: "y = sin x + \\frac{\\pi}{3} .\n\u0006 \u0007.",
      A3: "y = sin x - \\pi .",
      A4: "y = sin x .",
    },
    correctAnswer: 'A3',
    hasImage: true,
  },

  'mtp-algebra-005-13': {
    externalId: 'mtp-algebra-005-13',
    forbiddenInQuestion: ['⎧', '⎨', '⎪', '⎩', '√'],
    requiredInQuestion: ["\\begin{cases}"],
    forbiddenInOptions: ['⎧', '⎨', '⎪', '⎩', '√'],
    expectedOptions: {
      A1: "-10.",
      A2: "-2.",
      A3: "4.",
      A4: "9.",
    },
    correctAnswer: 'A1',
    hasImage: false,
  },

  'mtp-algebra-001-05': {
    externalId: 'mtp-algebra-001-05',
    forbiddenInQuestion: ['⎧', '⎨', '⎪', '⎩', '√'],
    requiredInQuestion: ["\\frac{1}{2} + \\frac{1}{3}"],
    forbiddenInOptions: ['⎧', '⎨', '⎪', '⎩', '√'],
    expectedOptions: {
      A1: "15.",
      A2: "14.",
      A3: "8.",
      A4: "13.",
    },
    correctAnswer: 'A2',
    hasImage: false,
  },

  'mtp-algebra-001-07': {
    externalId: 'mtp-algebra-001-07',
    forbiddenInQuestion: ['⎧', '⎨', '⎪', '⎩', '√'],
    requiredInQuestion: ["[] \\frac{a3-b3}{a2+ ab + "],
    forbiddenInOptions: ['⎧', '⎨', '⎪', '⎩', '√'],
    expectedOptions: {
      A1: "1.",
      A2: "2.",
      A3: "a .",
      A4: "1 / (a + b).",
    },
    correctAnswer: 'A2',
    hasImage: false,
  },

  'mtp-algebra-001-01': {
    externalId: 'mtp-algebra-001-01',
    forbiddenInQuestion: ['⎧', '⎨', '⎪', '⎩', '√'],
    requiredInQuestion: ["1234...798081 soni necha "],
    forbiddenInOptions: ['⎧', '⎨', '⎪', '⎩', '√'],
    expectedOptions: {
      A1: "81.",
      A2: "90.",
      A3: "152.",
      A4: "153.",
    },
    correctAnswer: 'A4',
    hasImage: false,
  },

  'mtp-algebra-040-28': {
    externalId: 'mtp-algebra-040-28',
    forbiddenInQuestion: ['⎧', '⎨', '⎪', '⎩', '√'],
    requiredInQuestion: ["Rasmda y = x 2 funksiya v"],
    forbiddenInOptions: ['⎧', '⎨', '⎪', '⎩', '√'],
    expectedOptions: {
      A1: "1.",
      A2: "2.",
      A3: "3.",
      A4: "4.",
    },
    correctAnswer: 'A3',
    hasImage: true,
  },

  'mtp-algebra-037-10': {
    externalId: 'mtp-algebra-037-10',
    forbiddenInQuestion: ['⎧', '⎨', '⎪', '⎩', '√'],
    requiredInQuestion: ["\\begin{cases}"],
    forbiddenInOptions: ['⎧', '⎨', '⎪', '⎩', '√'],
    expectedOptions: {
      A1: "- \\frac{5}{6} .",
      A2: "\\frac{1}{6} .",
      A3: "\\frac{5}{6} .",
      A4: "\\frac{4}{5} .",
    },
    correctAnswer: 'A3',
    hasImage: false,
  },

  'mtp-algebra-031-06': {
    externalId: 'mtp-algebra-031-06',
    forbiddenInQuestion: ['⎧', '⎨', '⎪', '⎩', '√'],
    requiredInQuestion: ["Agar xy > 0 va xy - 1 + x"],
    forbiddenInOptions: ['⎧', '⎨', '⎪', '⎩', '√'],
    expectedOptions: {
      A1: "0.",
      A2: "2.",
      A3: "1.",
      A4: "-1.",
    },
    correctAnswer: 'A4',
    hasImage: false,
  },

  'mtp-algebra-031-05': {
    externalId: 'mtp-algebra-031-05',
    forbiddenInQuestion: ['⎧', '⎨', '⎪', '⎩', '√'],
    requiredInQuestion: ["Ko\u2018phadni ko\u2018paytuvchilar"],
    forbiddenInOptions: ['⎧', '⎨', '⎪', '⎩', '√'],
    expectedOptions: {
      A1: "(x + 6) x 2 + x + \\frac{6}{6} .\n\\sqrt{} [\\sqrt{}].",
      A2: "(x + \\frac{6)}{6)} x 2 - x + .\n\\sqrt{} [\\sqrt{}].",
      A3: "(x - x 2 - x - \\frac{6}{6} .\n\\sqrt{} [\\sqrt{}].",
      A4: "(x - 6) x 2 + x - .",
    },
    correctAnswer: 'A3',
    hasImage: false,
  },

  'mtp-algebra-031-01': {
    externalId: 'mtp-algebra-031-01',
    forbiddenInQuestion: ['⎧', '⎨', '⎪', '⎩', '√'],
    requiredInQuestion: ["25^{64} \\cdot 64^{25} son"],
    forbiddenInOptions: ['⎧', '⎨', '⎪', '⎩', '√'],
    expectedOptions: {
      A1: "7.",
      A2: "14.",
      A3: "21.",
      A4: "28.",
    },
    correctAnswer: 'A2',
    hasImage: false,
  },

  'mtp-algebra-066-20': {
    externalId: 'mtp-algebra-066-20',
    forbiddenInQuestion: ['⎧', '⎨', '⎪', '⎩', '√'],
    requiredInQuestion: ["Chizmada [- 7; 6] kesmada"],
    forbiddenInOptions: ['⎧', '⎨', '⎪', '⎩', '√'],
    expectedOptions: {
      A1: "(- 4; 4).",
      A2: "[- 4; 0] \\cup [2; 4].",
      A3: "(- 4; 0) \\cup (2; 4).",
      A4: "[- 7; - 4) \\cup (0; 2) \\cup (4; 6].",
    },
    correctAnswer: 'A4',
    hasImage: true,
  },

  'mtp-algebra-065-10': {
    externalId: 'mtp-algebra-065-10',
    forbiddenInQuestion: ['⎧', '⎨', '⎪', '⎩', '√'],
    requiredInQuestion: ["\\begin{cases}"],
    forbiddenInOptions: ['⎧', '⎨', '⎪', '⎩', '√'],
    expectedOptions: {
      A1: "0.",
      A2: "1,5.",
      A3: "2.",
      A4: "-2.",
    },
    correctAnswer: 'A3',
    hasImage: false,
  },

  'mtp-algebra-061-03': {
    externalId: 'mtp-algebra-061-03',
    forbiddenInQuestion: ['⎧', '⎨', '⎪', '⎩', '√'],
    requiredInQuestion: ["\\frac{0,725 + 0,6 ++}{13}"],
    forbiddenInOptions: ['⎧', '⎨', '⎪', '⎩', '√'],
    expectedOptions: {
      A1: "1/2.",
      A2: "1.",
      A3: "2.",
      A4: "4.",
    },
    correctAnswer: 'A2',
    hasImage: false,
  },

  'mtp-algebra-062-06': {
    externalId: 'mtp-algebra-062-06',
    forbiddenInQuestion: ['⎧', '⎨', '⎪', '⎩', '√'],
    requiredInQuestion: ["\\left(\\frac{3}{2} \\frac{3"],
    forbiddenInOptions: ['⎧', '⎨', '⎪', '⎩', '√'],
    expectedOptions: {
      A1: "- 2.",
      A2: "2.",
      A3: "0.",
      A4: "2.",
    },
    correctAnswer: 'A2',
    hasImage: false,
  },

  'mtp-algebra-061-01': {
    externalId: 'mtp-algebra-061-01',
    forbiddenInQuestion: ['⎧', '⎨', '⎪', '⎩', '√'],
    requiredInQuestion: ["Xaltadagi yong\u2018oqlarni 2 "],
    forbiddenInOptions: ['⎧', '⎨', '⎪', '⎩', '√'],
    expectedOptions: {
      A1: "61.",
      A2: "71.",
      A3: "121.",
      A4: "131.",
    },
    correctAnswer: 'A1',
    hasImage: false,
  },

  'mtp-algebra-102-02': {
    externalId: 'mtp-algebra-102-02',
    forbiddenInQuestion: ['⎧', '⎨', '⎪', '⎩', '√'],
    requiredInQuestion: ["Rasmda A va B nuqtalar so"],
    forbiddenInOptions: ['⎧', '⎨', '⎪', '⎩', '√'],
    expectedOptions: {
      A1: "8.",
      A2: "9,5.",
      A3: "6,5.",
      A4: "12,5.",
    },
    correctAnswer: 'A3',
    hasImage: true,
  },

  'mtp-algebra-096-12': {
    externalId: 'mtp-algebra-096-12',
    forbiddenInQuestion: ['⎧', '⎨', '⎪', '⎩', '√'],
    requiredInQuestion: ["\\begin{cases}"],
    forbiddenInOptions: ['⎧', '⎨', '⎪', '⎩', '√'],
    expectedOptions: {
      A1: "2.",
      A2: "3.",
      A3: "7.",
      A4: "10.",
    },
    correctAnswer: 'A3',
    hasImage: false,
  },

  'mtp-algebra-091-02': {
    externalId: 'mtp-algebra-091-02',
    forbiddenInQuestion: ['⎧', '⎨', '⎪', '⎩', '√'],
    requiredInQuestion: ["Hisoblang: [] [] 2020 \\fr"],
    forbiddenInOptions: ['⎧', '⎨', '⎪', '⎩', '√'],
    expectedOptions: {
      A1: "3.",
      A2: "4.",
      A3: "1.",
      A4: "2.",
    },
    correctAnswer: 'A1',
    hasImage: false,
  },

  'mtp-algebra-091-06': {
    externalId: 'mtp-algebra-091-06',
    forbiddenInQuestion: ['⎧', '⎨', '⎪', '⎩', '√'],
    requiredInQuestion: ["x + 2 a \\frac{a + a\\sqrt{"],
    forbiddenInOptions: ['⎧', '⎨', '⎪', '⎩', '√'],
    expectedOptions: {
      A1: "0.",
      A2: "\\sqrt[4]{} a .",
      A3: "4 \\sqrt[3]{} a .",
      A4: "2 \\sqrt[3]{} a + \\sqrt[2]{} a .",
    },
    correctAnswer: 'A3',
    hasImage: false,
  },

  'mtp-algebra-091-01': {
    externalId: 'mtp-algebra-091-01',
    forbiddenInQuestion: ['⎧', '⎨', '⎪', '⎩', '√'],
    requiredInQuestion: ["2017^{3} + 1017^{2} -2016"],
    forbiddenInOptions: ['⎧', '⎨', '⎪', '⎩', '√'],
    expectedOptions: {
      A1: "13402017.",
      A2: "1036017.",
      A3: "1132017.",
      A4: "1034017.",
    },
    correctAnswer: 'A2',
    hasImage: false,
  },

  'mtp-algebra-trigonometriya-003-11': {
    externalId: 'mtp-algebra-trigonometriya-003-11',
    forbiddenInQuestion: ['⎧', '⎨', '⎪', '⎩', '√'],
    requiredInQuestion: ["y = f (x) funksiyaning an"],
    forbiddenInOptions: ['⎧', '⎨', '⎪', '⎩', '√'],
    expectedOptions: {
      A1: "[- 9; 18].",
      A2: "[- 1; 2]. [.",
      A3: "[- 6; 12].",
      A4: "- \\frac{3}{2}; 3 .",
    },
    correctAnswer: 'A1',
    hasImage: true,
  },

  'mtp-algebra-trigonometriya-002-23': {
    externalId: 'mtp-algebra-trigonometriya-002-23',
    forbiddenInQuestion: ['⎧', '⎨', '⎪', '⎩', '√'],
    requiredInQuestion: ["\\begin{cases}"],
    forbiddenInOptions: ['⎧', '⎨', '⎪', '⎩', '√'],
    expectedOptions: {
      A1: "7.",
      A2: "9.",
      A3: "14.",
      A4: "16.",
    },
    correctAnswer: 'A1',
    hasImage: false,
  },

  'mtp-algebra-trigonometriya-001-05': {
    externalId: 'mtp-algebra-trigonometriya-001-05',
    forbiddenInQuestion: ['⎧', '⎨', '⎪', '⎩', '√'],
    requiredInQuestion: ["\\frac{7}{3} kasr ma\u2019noga "],
    forbiddenInOptions: ['⎧', '⎨', '⎪', '⎩', '√'],
    expectedOptions: {
      A1: "2.",
      A2: "-1.",
      A3: "1.",
      A4: "-2.",
    },
    correctAnswer: 'A3',
    hasImage: false,
  },

  'mtp-algebra-trigonometriya-001-09': {
    externalId: 'mtp-algebra-trigonometriya-001-09',
    forbiddenInQuestion: ['⎧', '⎨', '⎪', '⎩', '√'],
    requiredInQuestion: ["\u0006 \u0007 \\frac{1}{a -ab} \\frac"],
    forbiddenInOptions: ['⎧', '⎨', '⎪', '⎩', '√'],
    expectedOptions: {
      A1: "1.",
      A2: "2.",
      A3: "a .",
      A4: ".",
    },
    correctAnswer: 'A2',
    hasImage: false,
  },

  'mtp-algebra-trigonometriya-001-01': {
    externalId: 'mtp-algebra-trigonometriya-001-01',
    forbiddenInQuestion: ['⎧', '⎨', '⎪', '⎩', '√'],
    requiredInQuestion: ["1234...798081 soni necha "],
    forbiddenInOptions: ['⎧', '⎨', '⎪', '⎩', '√'],
    expectedOptions: {
      A1: "81.",
      A2: "90.",
      A3: "152.",
      A4: "153.",
    },
    correctAnswer: 'A4',
    hasImage: false,
  },

  'mtp-algebra-geometriya-123-25': {
    externalId: 'mtp-algebra-geometriya-123-25',
    forbiddenInQuestion: ['⎧', '⎨', '⎪', '⎩', '√'],
    requiredInQuestion: ["Agar rasmdagi o\u2018rinli bo\u2018"],
    forbiddenInOptions: ['⎧', '⎨', '⎪', '⎩', '√'],
    expectedOptions: {
      A1: "65 ^{\\\\circ} .",
      A2: "45 ^{\\\\circ} .",
      A3: "50 ^{\\\\circ} .",
      A4: "70 ^{\\\\circ} .",
    },
    correctAnswer: 'A3',
    hasImage: true,
  },

  'mtp-algebra-geometriya-121-08': {
    externalId: 'mtp-algebra-geometriya-121-08',
    forbiddenInQuestion: ['⎧', '⎨', '⎪', '⎩', '√'],
    requiredInQuestion: ["\\begin{cases}"],
    forbiddenInOptions: ['⎧', '⎨', '⎪', '⎩', '√'],
    expectedOptions: {
      A1: "168.",
      A2: "216.",
      A3: "108.",
      A4: "84.",
    },
    correctAnswer: 'A4',
    hasImage: false,
  },

  'mtp-algebra-geometriya-121-02': {
    externalId: 'mtp-algebra-geometriya-121-02',
    forbiddenInQuestion: ['⎧', '⎨', '⎪', '⎩', '√'],
    requiredInQuestion: ["\\frac{732-272}{732+ 2 \\cd"],
    forbiddenInOptions: ['⎧', '⎨', '⎪', '⎩', '√'],
    expectedOptions: {
      A1: "0,4.",
      A2: "0,46.",
      A3: "0,6.",
      A4: "4,6.",
    },
    correctAnswer: 'A2',
    hasImage: false,
  },

  'mtp-algebra-geometriya-121-05': {
    externalId: 'mtp-algebra-geometriya-121-05',
    forbiddenInQuestion: ['⎧', '⎨', '⎪', '⎩', '√'],
    requiredInQuestion: ["\\sqrt{} \\sqrt{} Hisoblang"],
    forbiddenInOptions: ['⎧', '⎨', '⎪', '⎩', '√'],
    expectedOptions: {
      A1: "7 + 5.",
      A2: "7.",
      A3: "7 - 5.",
      A4: "5.",
    },
    correctAnswer: 'A2',
    hasImage: false,
  },

  'mtp-algebra-geometriya-121-01': {
    externalId: 'mtp-algebra-geometriya-121-01',
    forbiddenInQuestion: ['⎧', '⎨', '⎪', '⎩', '√'],
    requiredInQuestion: ["3^{101} sonini 101 ga bo\u2018"],
    forbiddenInOptions: ['⎧', '⎨', '⎪', '⎩', '√'],
    expectedOptions: {
      A1: "1.",
      A2: "27.",
      A3: "3.",
      A4: "9.",
    },
    correctAnswer: 'A3',
    hasImage: false,
  },

  'mtp-algebra-geometriya-151-24': {
    externalId: 'mtp-algebra-geometriya-151-24',
    forbiddenInQuestion: ['⎧', '⎨', '⎪', '⎩', '√'],
    requiredInQuestion: ["\\sqrt{} 2 + 3 Agar OB || "],
    forbiddenInOptions: ['⎧', '⎨', '⎪', '⎩', '√'],
    expectedOptions: {
      A1: "10 ^{\\\\circ} .",
      A2: "15 ^{\\\\circ} .",
      A3: "20 ^{\\\\circ} .",
      A4: "30 ^{\\\\circ} .",
    },
    correctAnswer: 'A1',
    hasImage: true,
  },

  'mtp-algebra-geometriya-152-09': {
    externalId: 'mtp-algebra-geometriya-152-09',
    forbiddenInQuestion: ['⎧', '⎨', '⎪', '⎩', '√'],
    requiredInQuestion: ["\\begin{cases}"],
    forbiddenInOptions: ['⎧', '⎨', '⎪', '⎩', '√'],
    expectedOptions: {
      A1: "7.",
      A2: "8.",
      A3: "9.",
      A4: "12.",
    },
    correctAnswer: 'A1',
    hasImage: false,
  },

  'mtp-algebra-geometriya-151-02': {
    externalId: 'mtp-algebra-geometriya-151-02',
    forbiddenInQuestion: ['⎧', '⎨', '⎪', '⎩', '√'],
    requiredInQuestion: ["\\frac{215\\cdot 547}{94\\cd"],
    forbiddenInOptions: ['⎧', '⎨', '⎪', '⎩', '√'],
    expectedOptions: {
      A1: "3 13 \\cdot 2 8 .",
      A2: "3 16 \\cdot 2 8 .",
      A3: "3 19 \\cdot 2 8 .",
      A4: "3 20 \\cdot 2 8 .",
    },
    correctAnswer: 'A3',
    hasImage: false,
  },

  'mtp-algebra-geometriya-151-04': {
    externalId: 'mtp-algebra-geometriya-151-04',
    forbiddenInQuestion: ['⎧', '⎨', '⎪', '⎩', '√'],
    requiredInQuestion: ["\\frac{3a7+ 2a6-3a -2}{(3a"],
    forbiddenInOptions: ['⎧', '⎨', '⎪', '⎩', '√'],
    expectedOptions: {
      A1: "\u00b1 3.",
      A2: "\u00b1 7.",
      A3: "2.",
      A4: "\u00b1 2.",
    },
    correctAnswer: 'A1',
    hasImage: false,
  },

  'mtp-algebra-geometriya-151-01': {
    externalId: 'mtp-algebra-geometriya-151-01',
    forbiddenInQuestion: ['⎧', '⎨', '⎪', '⎩', '√'],
    requiredInQuestion: ["Agar n + 5 har doim juft "],
    forbiddenInOptions: ['⎧', '⎨', '⎪', '⎩', '√'],
    expectedOptions: {
      A1: "n^{4} -5.",
      A2: "2^{n} + n^{2}.",
      A3: "3^{n} + n^{2}.",
      A4: "3^{n} + n^{3} + 2018.",
    },
    correctAnswer: 'A2',
    hasImage: false,
  },

  'mtp-algebra-geometriya-004-24': {
    externalId: 'mtp-algebra-geometriya-004-24',
    forbiddenInQuestion: ['⎧', '⎨', '⎪', '⎩', '√'],
    requiredInQuestion: ["Rasmda berilganlarga ko\u2018r"],
    forbiddenInOptions: ['⎧', '⎨', '⎪', '⎩', '√'],
    expectedOptions: {
      A1: "13.",
      A2: "14.",
      A3: "15.",
      A4: "16.",
    },
    correctAnswer: 'A1',
    hasImage: true,
  },

  'mtp-algebra-geometriya-006-08': {
    externalId: 'mtp-algebra-geometriya-006-08',
    forbiddenInQuestion: ['⎧', '⎨', '⎪', '⎩', '√'],
    requiredInQuestion: ["\\begin{cases}"],
    forbiddenInOptions: ['⎧', '⎨', '⎪', '⎩', '√'],
    expectedOptions: {
      A1: "0.",
      A2: "1,5.",
      A3: "2.",
      A4: "-2.",
    },
    correctAnswer: 'A3',
    hasImage: false,
  },

  'mtp-algebra-geometriya-001-03': {
    externalId: 'mtp-algebra-geometriya-001-03',
    forbiddenInQuestion: ['⎧', '⎨', '⎪', '⎩', '√'],
    requiredInQuestion: ["Ifodani qiymatini toping:"],
    forbiddenInOptions: ['⎧', '⎨', '⎪', '⎩', '√'],
    expectedOptions: {
      A1: "1,2.",
      A2: "-1,2.",
      A3: "2,4.",
      A4: "-2,4.",
    },
    correctAnswer: 'A2',
    hasImage: false,
  },

  'mtp-algebra-geometriya-001-05': {
    externalId: 'mtp-algebra-geometriya-001-05',
    forbiddenInQuestion: ['⎧', '⎨', '⎪', '⎩', '√'],
    requiredInQuestion: ["\\sqrt{} Agar a = 3 [\\frac"],
    forbiddenInOptions: ['⎧', '⎨', '⎪', '⎩', '√'],
    expectedOptions: {
      A1: "5.",
      A2: "3 3.",
      A3: "23.",
      A4: "12 3.",
    },
    correctAnswer: 'A3',
    hasImage: false,
  },

  'mtp-algebra-geometriya-001-01': {
    externalId: 'mtp-algebra-geometriya-001-01',
    forbiddenInQuestion: ['⎧', '⎨', '⎪', '⎩', '√'],
    requiredInQuestion: ["1234...798081 soni necha "],
    forbiddenInOptions: ['⎧', '⎨', '⎪', '⎩', '√'],
    expectedOptions: {
      A1: "81.",
      A2: "90.",
      A3: "152.",
      A4: "153.",
    },
    correctAnswer: 'A4',
    hasImage: false,
  },

  'mtp-algebra-geometriya-031-07': {
    externalId: 'mtp-algebra-geometriya-031-07',
    forbiddenInQuestion: ['⎧', '⎨', '⎪', '⎩', '√'],
    requiredInQuestion: ["Grafik ko\u2018rinishda berilg"],
    forbiddenInOptions: ['⎧', '⎨', '⎪', '⎩', '√'],
    expectedOptions: {
      A1: "[- 4; - 1) \\cup (- 1; 3].",
      A2: "[- 3; - 2] \\cup [2; 5].",
      A3: "[- 3; 7).",
      A4: "[- 4; 3].",
    },
    correctAnswer: 'A4',
    hasImage: true,
  },

  'mtp-algebra-geometriya-041-09': {
    externalId: 'mtp-algebra-geometriya-041-09',
    forbiddenInQuestion: ['⎧', '⎨', '⎪', '⎩', '√'],
    requiredInQuestion: ["\\begin{cases}"],
    forbiddenInOptions: ['⎧', '⎨', '⎪', '⎩', '√'],
    expectedOptions: {
      A1: "a = \\frac{13}{5}; b = \\frac{12}{5} .",
      A2: "a = \\frac{18}{5}; b = \\frac{12}{5} .",
      A3: "a = \\frac{18}{5}; b = \\frac{13}{5} .",
      A4: "a = \\frac{11}{5}; b = \\frac{13}{5} .",
    },
    correctAnswer: 'A2',
    hasImage: false,
  },

  'mtp-algebra-geometriya-031-04': {
    externalId: 'mtp-algebra-geometriya-031-04',
    forbiddenInQuestion: ['⎧', '⎨', '⎪', '⎩', '√'],
    requiredInQuestion: ["Agar x 2 + \\frac{2}{x} = "],
    forbiddenInOptions: ['⎧', '⎨', '⎪', '⎩', '√'],
    expectedOptions: {
      A1: "-2.",
      A2: "4.",
      A3: "2.",
      A4: "5.",
    },
    correctAnswer: 'A3',
    hasImage: false,
  },

  'mtp-algebra-geometriya-031-13': {
    externalId: 'mtp-algebra-geometriya-031-13',
    forbiddenInQuestion: ['⎧', '⎨', '⎪', '⎩', '√'],
    requiredInQuestion: ["\\sqrt{} (x + 2) 3 - 2 x -"],
    forbiddenInOptions: ['⎧', '⎨', '⎪', '⎩', '√'],
    expectedOptions: {
      A1: "[- 3; - 2].",
      A2: "(-\\infty; - 3].",
      A3: "[- 3; - 2] {1} .",
      A4: "(-\\infty; - 2].",
    },
    correctAnswer: 'A3',
    hasImage: false,
  },

  'mtp-algebra-geometriya-031-01': {
    externalId: 'mtp-algebra-geometriya-031-01',
    forbiddenInQuestion: ['⎧', '⎨', '⎪', '⎩', '√'],
    requiredInQuestion: ["25^{64} \\cdot 64^{25} son"],
    forbiddenInOptions: ['⎧', '⎨', '⎪', '⎩', '√'],
    expectedOptions: {
      A1: "7.",
      A2: "14.",
      A3: "21.",
      A4: "28.",
    },
    correctAnswer: 'A2',
    hasImage: false,
  },

  'mtp-algebra-geometriya-065-07': {
    externalId: 'mtp-algebra-geometriya-065-07',
    forbiddenInQuestion: ['⎧', '⎨', '⎪', '⎩', '√'],
    requiredInQuestion: ["Rasmda qaysi funksiyaning"],
    forbiddenInOptions: ['⎧', '⎨', '⎪', '⎩', '√'],
    expectedOptions: {
      A1: "f (x) = 2 | x | - 1.",
      A2: "f (x) = | x + 1 | + 1.",
      A3: "f (x) = 3 | x + 2 | .",
      A4: "f (x) = 2 | x + 1 | + 1.",
    },
    correctAnswer: 'A4',
    hasImage: true,
  },

  'mtp-algebra-geometriya-061-02': {
    externalId: 'mtp-algebra-geometriya-061-02',
    forbiddenInQuestion: ['⎧', '⎨', '⎪', '⎩', '√'],
    requiredInQuestion: ["Quyidagi sonlardan nechta"],
    forbiddenInOptions: ['⎧', '⎨', '⎪', '⎩', '√'],
    expectedOptions: {
      A1: "1.",
      A2: "2.",
      A3: "4.",
      A4: "3.",
    },
    correctAnswer: 'A4',
    hasImage: false,
  },

  'mtp-algebra-geometriya-061-05': {
    externalId: 'mtp-algebra-geometriya-061-05',
    forbiddenInQuestion: ['⎧', '⎨', '⎪', '⎩', '√'],
    requiredInQuestion: ["\\frac{33ax2-a2x}{3a2-23ax"],
    forbiddenInOptions: ['⎧', '⎨', '⎪', '⎩', '√'],
    expectedOptions: {
      A1: "1.",
      A2: "\\sqrt[6]{} a .",
      A3: "- \\sqrt[6]{} x .",
      A4: "(\\sqrt[3]{} a + \\sqrt[3]{} x).\n\\sqrt{} x + 1 + \\sqrt{}.",
    },
    correctAnswer: 'A2',
    hasImage: false,
  },

  'mtp-algebra-geometriya-061-01': {
    externalId: 'mtp-algebra-geometriya-061-01',
    forbiddenInQuestion: ['⎧', '⎨', '⎪', '⎩', '√'],
    requiredInQuestion: ["Xaltadagi yong\u2018oqlarni 2 "],
    forbiddenInOptions: ['⎧', '⎨', '⎪', '⎩', '√'],
    expectedOptions: {
      A1: "61.",
      A2: "71.",
      A3: "121.",
      A4: "131.",
    },
    correctAnswer: 'A1',
    hasImage: false,
  },

  'mtp-algebra-geometriya-061-03': {
    externalId: 'mtp-algebra-geometriya-061-03',
    forbiddenInQuestion: ['⎧', '⎨', '⎪', '⎩', '√'],
    requiredInQuestion: ["Quyidagi sonlardan qaysi "],
    forbiddenInOptions: ['⎧', '⎨', '⎪', '⎩', '√'],
    expectedOptions: {
      A1: "0,5^{-0,5} \\cdot 2^{0,3}.",
      A2: "1,7^{0,9} \\cdot 1,3^{1,3}.",
      A3: "0,7^{-0,4} \\cdot 0,3^{0,4}.",
      A4: "3^{0,5} \\cdot 0,3^{-0,2}.",
    },
    correctAnswer: 'A3',
    hasImage: false,
  },

  'mtp-algebra-geometriya-092-27': {
    externalId: 'mtp-algebra-geometriya-092-27',
    forbiddenInQuestion: ['⎧', '⎨', '⎪', '⎩', '√'],
    requiredInQuestion: ["Yoyiq burchakning A nuqta"],
    forbiddenInOptions: ['⎧', '⎨', '⎪', '⎩', '√'],
    expectedOptions: {
      A1: "60 ^{\\\\circ} .",
      A2: "80 ^{\\\\circ} .",
      A3: "90 ^{\\\\circ} .",
      A4: "40 ^{\\\\circ} .",
    },
    correctAnswer: 'A2',
    hasImage: true,
  },

  'mtp-algebra-geometriya-100-09': {
    externalId: 'mtp-algebra-geometriya-100-09',
    forbiddenInQuestion: ['⎧', '⎨', '⎪', '⎩', '√'],
    requiredInQuestion: ["\\begin{cases}"],
    forbiddenInOptions: ['⎧', '⎨', '⎪', '⎩', '√'],
    expectedOptions: {
      A1: "- 3.",
      A2: "5.",
      A3: "- 2.",
      A4: "1.",
    },
    correctAnswer: 'A4',
    hasImage: false,
  },

  'mtp-algebra-geometriya-091-03': {
    externalId: 'mtp-algebra-geometriya-091-03',
    forbiddenInQuestion: ['⎧', '⎨', '⎪', '⎩', '√'],
    requiredInQuestion: ["\\frac{x2 + ax -3x -3a}{x2"],
    forbiddenInOptions: ['⎧', '⎨', '⎪', '⎩', '√'],
    expectedOptions: {
      A1: "-1.",
      A2: "0.",
      A3: "1.",
      A4: "\\frac{a -x}{a + x}\n.",
    },
    correctAnswer: 'A3',
    hasImage: false,
  },

  'mtp-algebra-geometriya-091-05': {
    externalId: 'mtp-algebra-geometriya-091-05',
    forbiddenInQuestion: ['⎧', '⎨', '⎪', '⎩', '√'],
    requiredInQuestion: ["\\sqrt{} \\frac{11 + 1}{2} "],
    forbiddenInOptions: ['⎧', '⎨', '⎪', '⎩', '√'],
    expectedOptions: {
      A1: "1 \\frac{-}{11} \\sqrt{} 11.",
      A2: "\\sqrt{} 11 - 2.",
      A3: "- 1.",
      A4: "11 + 1.",
    },
    correctAnswer: 'A3',
    hasImage: false,
  },

  'mtp-algebra-geometriya-091-01': {
    externalId: 'mtp-algebra-geometriya-091-01',
    forbiddenInQuestion: ['⎧', '⎨', '⎪', '⎩', '√'],
    requiredInQuestion: ["2017^{3} + 1017^{2} -2016"],
    forbiddenInOptions: ['⎧', '⎨', '⎪', '⎩', '√'],
    expectedOptions: {
      A1: "13402017.",
      A2: "1036017.",
      A3: "1132017.",
      A4: "1034017.",
    },
    correctAnswer: 'A2',
    hasImage: false,
  },

  'mtp-geometriya-001-09': {
    externalId: 'mtp-geometriya-001-09',
    forbiddenInQuestion: ['⎧', '⎨', '⎪', '⎩', '√'],
    requiredInQuestion: ["Rasmda berilganlarga ko\u2018r"],
    forbiddenInOptions: ['⎧', '⎨', '⎪', '⎩', '√'],
    expectedOptions: {
      A1: "2.",
      A2: "2 2.",
      A3: "4.",
      A4: "2 3.",
    },
    correctAnswer: 'A3',
    hasImage: true,
  },

  'mtp-geometriya-001-25': {
    externalId: 'mtp-geometriya-001-25',
    forbiddenInQuestion: ['⎧', '⎨', '⎪', '⎩', '√'],
    requiredInQuestion: ["3 A (- 4; 1; 1), B (1; 4;"],
    forbiddenInOptions: ['⎧', '⎨', '⎪', '⎩', '√'],
    expectedOptions: {
      A1: "30 ^{\\\\circ} .",
      A2: "45 ^{\\\\circ} .",
      A3: "60 ^{\\\\circ} .",
      A4: "90 ^{\\\\circ} .",
    },
    correctAnswer: 'A4',
    hasImage: false,
  },

  'mtp-geometriya-001-02': {
    externalId: 'mtp-geometriya-001-02',
    forbiddenInQuestion: ['⎧', '⎨', '⎪', '⎩', '√'],
    requiredInQuestion: ["Uchburchakning b va c tom"],
    forbiddenInOptions: ['⎧', '⎨', '⎪', '⎩', '√'],
    expectedOptions: {
      A1: "12 2.",
      A2: "16 2.",
      A3: "12 3.",
      A4: "16 3.",
    },
    correctAnswer: 'A4',
    hasImage: false,
  },

  'mtp-geometriya-001-01': {
    externalId: 'mtp-geometriya-001-01',
    forbiddenInQuestion: ['⎧', '⎨', '⎪', '⎩', '√'],
    requiredInQuestion: ["Agar d < \\alpha < 2d bo\u2018l"],
    forbiddenInOptions: ['⎧', '⎨', '⎪', '⎩', '√'],
    expectedOptions: {
      A1: "o\u2018tkir.",
      A2: "o\u2018tmas.",
      A3: "to\u2018g\u2018ri.",
      A4: "yoyiq.",
    },
    correctAnswer: 'A2',
    hasImage: false,
  },

  'mtp-kombinatorika-001-15': {
    externalId: 'mtp-kombinatorika-001-15',
    forbiddenInQuestion: ['⎧', '⎨', '⎪', '⎩', '√'],
    requiredInQuestion: ["Rasmda A, B va C to\u2018plaml"],
    forbiddenInOptions: ['⎧', '⎨', '⎪', '⎩', '√'],
    expectedOptions: {
      A1: "{a, b, c, d, g, h, f}.",
      A2: "{a, b, c, d, e, f}.",
      A3: "{a, b, c, d}.",
      A4: "{a, c, d, f}.",
    },
    correctAnswer: 'A4',
    hasImage: true,
  },

  'mtp-kombinatorika-002-07': {
    externalId: 'mtp-kombinatorika-002-07',
    forbiddenInQuestion: ['⎧', '⎨', '⎪', '⎩', '√'],
    requiredInQuestion: ["Aziz Lutfullaga qarab: \u201dH"],
    forbiddenInOptions: ['⎧', '⎨', '⎪', '⎩', '√'],
    expectedOptions: {
      A1: ".",
      A2: ".",
      A3: ".",
      A4: ".",
    },
    correctAnswer: 'A1',
    hasImage: false,
  },

  'mtp-kombinatorika-003-21': {
    externalId: 'mtp-kombinatorika-003-21',
    forbiddenInQuestion: ['⎧', '⎨', '⎪', '⎩', '√'],
    requiredInQuestion: ["A = [- \\sqrt{} 3; \\sqrt{}"],
    forbiddenInOptions: ['⎧', '⎨', '⎪', '⎩', '√'],
    expectedOptions: {
      A1: "[- 3; 3].",
      A2: "- 3; .",
      A3: "- \\frac{\\pi}{2}; \\pi .",
      A4: "[- \\sqrt{} 5; \\sqrt{}.",
    },
    correctAnswer: 'A2',
    hasImage: false,
  },

  'mtp-kombinatorika-001-01': {
    externalId: 'mtp-kombinatorika-001-01',
    forbiddenInQuestion: ['⎧', '⎨', '⎪', '⎩', '√'],
    requiredInQuestion: ["{x | x \\in N, 0 \\le x < 5"],
    forbiddenInOptions: ['⎧', '⎨', '⎪', '⎩', '√'],
    expectedOptions: {
      A1: "16.",
      A2: "5.",
      A3: "4.",
      A4: "32.",
    },
    correctAnswer: 'A1',
    hasImage: false,
  },

  'mtp-kombinatorika-001-02': {
    externalId: 'mtp-kombinatorika-001-02',
    forbiddenInQuestion: ['⎧', '⎨', '⎪', '⎩', '√'],
    requiredInQuestion: ["{x | x \\in N; -3,2 < x < "],
    forbiddenInOptions: ['⎧', '⎨', '⎪', '⎩', '√'],
    expectedOptions: {
      A1: "8.",
      A2: "32.",
      A3: "4.",
      A4: "16.",
    },
    correctAnswer: 'A4',
    hasImage: false,
  },
}
