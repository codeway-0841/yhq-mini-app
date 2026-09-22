import type { WonderCourse } from '../types'
import { WONDER_CATALOG_COURSES } from './wonderCatalog'

export const DEFAULT_WONDER_COURSES: WonderCourse[] = [
  {
    id: 'learning-how-to-learn',
    title: 'Learning How to Learn',
    description: 'Barbara Oakley, Terrence Sejnowski, and Alistair McConville explain how focused and diffuse thinking, procrastination control, and memory strategies help master difficult subjects.',
    subjectId: 'universal',
    badge: '🧠💡',
    level: 'intermediate',
    estimatedMinutes: 75,
    totalXp: 450,
    author: 'Barbara Oakley, Terrence Sejnowski, and Alistair McConville',
    category: 'Productivity',
    localCoverImage: '/courses/covers/cognitive-psychology-for-daily.png',
    sections: [
      {
        id: 'sec-brain',
        title: '1. Brain Fundamentals',
        description: '0/4 lessons · How our neural modes shape deep learning',
        isCompleted: false,
        lessons: [
          {
            id: 'lhtl-1',
            title: 'Passion Limits Growth',
            durationMinutes: 3,
            xp: 40,
            coins: 3,
            tags: ['Mindset', 'Neuroscience'],
            status: 'available',
            tldr: 'Following only existing passions traps you in what you already know. Growth requires embracing the initial friction of unfamiliar subjects.',
            pages: [
              {
                id: 'p1',
                title: 'The Myth of Fixed Passion',
                content: "Most learners believe [[passion precedes mastery|The intuition that you must feel excited before starting to learn]]. Neuroscience proves the reverse: mastery and competence create durable passion through [[dopamine reward circuits|Neural feedback loops triggered when small achievements reinforce deliberate practice]].",
                keywords: [
                  { word: 'Passion precedes mastery', definition: 'A psychological misconception where learners wait for spontaneous motivation rather than taking structured action.' },
                  { word: 'Dopamine reward circuits', definition: 'Neurotransmitter pathways in the brain that reinforce learning when small milestones are completed.' },
                ],
                visual: {
                  type: 'cycle',
                  title: 'The Real Mastery Cycle',
                  items: [
                    { label: 'Boshlang\'ich Qarshilik', value: 35, color: '#F59E0B', desc: 'Noma\'lumlikdagi dastlabki noqulaylikni yengish va boshlash.' },
                    { label: 'Kichik Yutuq (Chunk)', value: 70, color: '#3B82F6', desc: 'Neyron zanjirlari ulanishi va dopamin ajralishi.' },
                    { label: 'Ichki Ishtiyoq', value: 100, color: '#10B981', desc: 'Mustahkam mahorat va o\'z-o\'zidan davom etuvchi motivatsiya.' },
                  ],
                },
              },
            ],
            quiz: {
              type: 'mcq',
              question: "Why does relying solely on current passions limit cognitive growth?",
              options: [
                { id: 'a', text: 'It ignores the brain\'s capacity to develop new neural networks through unfamiliar challenges' },
                { id: 'b', text: 'It is impossible to learn things you like' },
                { id: 'c', text: 'Passion makes studying too fast' },
              ],
              correctOptionId: 'a',
              explanation: 'Embracing discomfort in unfamiliar fields triggers neuroplasticity, expanding your mental toolset far beyond initial comfort zones.',
            },
          },
          {
            id: 'lhtl-2',
            title: 'Focused & Diffuse Modes',
            durationMinutes: 3,
            xp: 45,
            coins: 3,
            tags: ['Brain Modes', 'Focus'],
            status: 'locked',
            tldr: 'The brain switches between tightly focused analytical thinking and relaxed diffuse associative problem solving.',
            pages: [
              {
                id: 'p1',
                title: 'The Pinball Metaphor',
                content: "Think of [[focused mode|Concentrated analytical thinking using tightly spaced bumper paths]] like a pinball machine with closely spaced bumpers. In contrast, [[diffuse mode|A relaxed resting-state network that allows thoughts to connect widely]] lets the ball wander across the entire board.",
                keywords: [
                  { word: 'Focused mode', definition: 'High-attention state using established familiar neural pathways.' },
                  { word: 'Diffuse mode', definition: 'Relaxed resting network allowing serendipitous connections across distant brain regions.' },
                ],
                visual: {
                  type: 'comparison',
                  title: 'Fokus va Diffuz Rejimlari Solishtiruvi',
                  items: [
                    { label: 'Fokus Rejim', value: 50, desc: 'Tor va zich neyron bog\'lanishlari, mantiqiy aniq hisob-kitoblar.' },
                    { label: 'Diffuz Rejim', value: 50, desc: 'Keng ko\'lamli dam olish holati, yangi noodatiy bog\'liqliklarni topish.' },
                  ],
                },
              },
            ],
            quiz: {
              type: 'boolean',
              question: "Can the human brain be in both focused and diffuse thinking modes simultaneously?",
              booleanCorrect: false,
              explanation: 'No, they are mutually inhibitory networks. You must alternate between deliberate concentration and relaxing breaks.',
            },
          },
          {
            id: 'lhtl-3',
            title: 'Learning Rewires Brain',
            durationMinutes: 4,
            xp: 45,
            coins: 3,
            tags: ['Synapses', 'Plasticity'],
            status: 'locked',
            tldr: 'Sleep and spaced recall physically build and strengthen dendritic spines between neurons.',
            pages: [
              {
                id: 'p1',
                title: 'Synaptic Growth During Rest',
                content: "New neural connections do not cement while you cram; they solidify during [[slow-wave sleep|Deep sleep stage where the brain replays and organizes newly learned memories]] and active recall intervals.",
                keywords: [
                  { word: 'Slow-wave sleep', definition: 'The restorative deep sleep phase essential for memory consolidation.' },
                ],
              },
            ],
            quiz: {
              type: 'cloze',
              question: "Memory consolidation and dendritic spine growth occur primarily during ________.",
              clozeTemplate: "Synapses physically solidify during {{blank}} and rest.",
              clozeAnswer: "sleep",
              clozeOptions: ["sleep", "cramming", "panic", "multitasking"],
              explanation: "Rest and sleep are the biological construction workers of memory.",
            },
          },
          {
            id: 'lhtl-4',
            title: 'Mode Switching',
            durationMinutes: 3,
            xp: 50,
            coins: 3,
            tags: ['Productivity', 'Edison Technique'],
            status: 'locked',
            isMilestone: true,
            tldr: 'Using strategic breaks (like Thomas Edison with ball bearings) lets the diffuse mode solve stubborn roadblocks.',
            pages: [
              {
                id: 'p1',
                title: 'Unlocking Tough Problems',
                content: "When stuck on a problem, stepping away to take a walk or do a mechanical task activates the diffuse network, leading to the famous [[Einstellung effect|The trap where your initial familiar thought prevents you from seeing a better creative solution]] breakthrough.",
                keywords: [
                  { word: 'Einstellung effect', definition: 'A cognitive block where familiar habits blind you from discovering simpler, novel solutions.' },
                ],
              },
            ],
            quiz: {
              type: 'mcq',
              question: "What is the best reaction when you hit a complete cognitive wall on a difficult problem?",
              options: [
                { id: '1', text: 'Step away for a walk or nap to activate the diffuse mode' },
                { id: '2', text: 'Stare at the screen for 4 hours without moving' },
                { id: '3', text: 'Give up learning forever' },
              ],
              correctOptionId: '1',
              explanation: 'Disengaging allows the diffuse network to reorganize patterns and find novel pathways.',
            },
          },
        ],
      },
      {
        id: 'sec-procrastination',
        title: '2. Defeating Procrastination',
        description: '0/4 lessons · Habits, cues, and working memory limits',
        isCompleted: false,
        lessons: [
          {
            id: 'lhtl-5',
            title: 'Why We Procrastinate',
            durationMinutes: 3,
            xp: 40,
            coins: 3,
            tags: ['Insular Cortex', 'Habits'],
            status: 'locked',
            tldr: 'Anticipating pain activates the brain\'s insular cortex. Focusing on process over product shuts down the pain response within 20 minutes.',
            pages: [
              {
                id: 'p1',
                title: 'The Neural Source of Pain',
                content: "Brain scans show that thinking about a difficult task activates the [[insular cortex|Region of the brain associated with physical pain and disgust]]. The trick is realizing the discomfort vanishes after 10-15 minutes of actual engagement.",
                keywords: [
                  { word: 'Insular cortex', definition: 'Brain region that lights up when you anticipate pain or distress.' },
                ],
              },
            ],
            quiz: {
              type: 'boolean',
              question: "Does focusing on the 'Process' (25 minutes of work) reduce procrastination compared to focusing on the 'Product' (finishing the entire book)?",
              booleanCorrect: true,
              explanation: 'Yes! Focusing on process eliminates the insular cortex pain flare and makes starting painless.',
            },
          },
          {
            id: 'lhtl-6',
            title: 'Pomodoro Technique',
            durationMinutes: 3,
            xp: 40,
            coins: 3,
            tags: ['Timer', 'Process'],
            status: 'locked',
            tldr: '25 minutes of uninterrupted focus followed by a 5-minute reward rewires your dopamine expectations.',
            pages: [
              {
                id: 'p1',
                title: 'The 25-Minute Sprint',
                content: "Set a timer for 25 minutes, eliminate all notifications, work gently on the process, and then give yourself a genuine 5-minute break.",
                keywords: [],
              },
            ],
            quiz: {
              type: 'mcq',
              question: "What is the crucial element after completing a 25-minute Pomodoro?",
              options: [
                { id: 'a', text: 'Giving yourself an immediate rewarding break to cement positive reinforcement' },
                { id: 'b', text: 'Immediately starting another 3 hours without breathing' },
              ],
              correctOptionId: 'a',
              explanation: 'The reward step teaches the brain that deliberate focus leads to dopamine satisfaction.',
            },
          },
        ],
      },
      {
        id: 'sec-chunking',
        title: '3. Memory & Chunking',
        description: 'How to compress complex concepts into effortless neural chunks',
        isCompleted: false,
        lessons: [
          {
            id: 'lhtl-9',
            title: 'Building a Neural Chunk',
            durationMinutes: 3,
            xp: 45,
            coins: 3,
            tags: ['Chunking', 'Memory'],
            status: 'locked',
            tldr: 'Chunks are pieces of information bound together through meaning and focused deliberate practice.',
            pages: [
              {
                id: 'p1',
                title: 'The 3 Steps to a Chunk',
                content: 'Building a [[neural chunk|A tightly knit mental loop that acts as a single mental file]] requires three vital stages: 1) Focused attention with zero distraction, 2) Grasping the core basic idea, and 3) Practicing in varying contexts.',
                keywords: [
                  { word: 'neural chunk', definition: 'A network of neurons bound together through repetition that fire as a cohesive single thought.' },
                ],
              },
            ],
            quiz: {
              type: 'order',
              question: 'Aqliy blok (Neural Chunk) shakllantirishning to\'g\'ri bosqichlarini tartiblang:',
              orderSteps: [
                { id: 'step-1', text: 'Diqqatni 100% jamlash (Chalg\'ituvchilarni yo\'qotish)' },
                { id: 'step-2', text: 'Asosiy g\'oya va modelning tub mohiyatini tushunish' },
                { id: 'step-3', text: 'Kengroq kontekstda mustaqil mashq qilish va sinash' },
              ],
              correctOrderIds: ['step-1', 'step-2', 'step-3'],
              explanation: 'Aqliy blok yaratish uchun avval fokus, so\'ng tub mohiyatni anglash va nihoyat kontekstda faol mashq qilish zarur.',
            },
          },
          {
            id: 'lhtl-10',
            title: 'The Illusion of Competence',
            durationMinutes: 3,
            xp: 45,
            coins: 3,
            tags: ['Active Recall', 'Meta-learning'],
            status: 'locked',
            tldr: 'Merely glancing at material makes the brain fool itself into thinking it knows it. Active retrieval is essential.',
            pages: [
              {
                id: 'p1',
                title: 'Rereading vs Testing',
                content: 'Repeatedly [[rereading notes|Passive reviewing that creates a superficial illusion of knowledge]] feels comforting but builds minimal long-term memory. Testing yourself through [[active recall|Mentally retrieving concepts without looking at the answer]] doubles retention speed.',
                keywords: [
                  { word: 'rereading notes', definition: 'A passive learning trap where familiarity with text is mistaken for actual mastery.' },
                  { word: 'active recall', definition: 'The cognitive act of pulling information out of memory, strengthening neural retrieval paths.' },
                ],
              },
            ],
            quiz: {
              type: 'flashcard',
              question: 'Kognitiv illyuziya (Illusion of Competence)',
              flashcardPrompt: 'Nega matnni qayta-qayta o\'qish (passive rereading) odamga mavzuni bilgandek tuyulishiga qaramay samarasiz?',
              flashcardAnswer: 'Chunki ko\'z oldida turgan tayyor matn miyaga tanishdek ko\'rinadi, biroq xotiradan mustaqil chaqirib olish (retrieval circuit) mashq qilinmagan bo\'ladi. Faqat Faol Eslash (Active Recall) mustahkam neyron zanjir quradi.',
              explanation: 'O\'zingizni tekshirish va kartalar orqali faol eslash passiv o\'qishga qaraganda ikki barobar ko\'proq uzoq muddatli xotira yaratadi.',
            },
          },
        ],
      },
      {
        id: 'sec-mastery',
        title: '4. Renaissance Learning & Mastery',
        description: 'Interleaving, spaced repetition, and escaping cognitive traps',
        isCompleted: false,
        lessons: [
          {
            id: 'lhtl-11',
            title: 'The Einstellung Trap',
            durationMinutes: 4,
            xp: 50,
            coins: 4,
            tags: ['Einstellung', 'Innovation'],
            status: 'locked',
            tldr: 'An existing mindset or premature intuition blocks a better, more elegant solution from being seen.',
            pages: [
              {
                id: 'p1',
                title: 'Cognitive Fixation',
                content: 'In the [[Einstellung effect|The phenomenon where an existing habitual thought pattern prevents finding a better solution]], a quick initial guess prevents your brain from considering alternatives. The solution is deliberate disengagement and diffuse rest.',
                keywords: [
                  { word: 'Einstellung effect', definition: 'A German psychological term meaning attitude or mindset that traps thinking in an initial rut.' },
                ],
              },
            ],
            quiz: {
              type: 'mcq',
              question: 'How do you overcome the Einstellung effect when stuck on a challenging problem?',
              options: [
                { id: 'a', text: 'Step away to let the diffuse resting-state network reset mental fixations' },
                { id: 'b', text: 'Forcefully repeat the exact same blocked line of thought' },
              ],
              correctOptionId: 'a',
              explanation: 'Disengaging allows the diffuse mode to explore wider associative paths unconstrained by the blocked prefrontal tracks.',
            },
          },
        ],
      },
    ],
    refractorTopics: [
      {
        id: 'ref-lhtl-modes',
        title: 'Cognitive Modes: Focused vs Diffuse Thinking',
        concept: 'The dual-process architecture of human problem solving',
        lenses: {
          competing: {
            viewA: {
              title: 'Focused Mode Primacy',
              stance: 'Pure uninterrupted concentration is the only path to mastery',
              arguments: [
                'Builds deep analytical precision',
                'Necessary for executing known algorithms and math proofs',
                'Minimizes careless slip-ups',
              ],
              advocate: 'Deliberate practice purists (Anders Ericsson)',
            },
            viewB: {
              title: 'Diffuse Incubation Primacy',
              stance: 'Breakthrough innovations and paradigm shifts occur exclusively in relaxed diffuse states',
              arguments: [
                'Archimedes in the bath, Newton under the apple tree',
                'Cross-disciplinary associative connections',
                'Prevents cognitive fixation (Einstellung trap)',
              ],
              advocate: 'Creativity researchers & Polymaths (Henri Poincaré)',
            },
            synthesis: 'Focused mode inputs the pieces; diffuse mode connects them into unexpected patterns. Elite performance requires cycling smoothly between both.',
          },
          component: {
            columns: ['Cognitive Component', 'Primary Function', 'Neural Network', 'Limitation'],
            rows: [
              { component: 'Prefrontal Cortex', role: 'Executive attention & working memory', mechanism: 'Top-down inhibitory control', failureImpact: 'Quickly exhausts glucose/stamina' },
              { component: 'Default Mode Network (DMN)', role: 'Daydreaming & broad associations', mechanism: 'Resting-state synchrony', failureImpact: 'Prone to mind-wandering if undisciplined' },
              { component: 'Hippocampus', role: 'Temporary chunk storage', mechanism: 'Long-term potentiation (LTP)', failureImpact: 'Limited to ~4 chunks at once' },
            ],
          },
          progression: {
            stages: [
              { step: 1, name: 'Deep Focused Ingestion', trigger: 'Engaging problem', state: 'Prefrontal cortex working at capacity', milestone: 'Information chunks loaded' },
              { step: 2, name: 'Hitting the Impasse', trigger: 'Einstellung block', state: 'Bumpers too narrow, no path forward', milestone: 'Deliberate disengagement' },
              { step: 3, name: 'Incubation in Diffuse', trigger: 'Taking a shower/walk', state: 'DMN links disparate mental models', milestone: 'Eureka insight' },
              { step: 4, name: 'Verification in Focus', trigger: 'Returning to desk', state: 'Validating the idea with analytical rigor', milestone: 'Completed solution' },
            ],
          },
          relationship: {
            nodes: [
              { id: 'f1', label: 'Focused Mode', group: 'Executive', importance: 5 },
              { id: 'f2', label: 'Diffuse Mode', group: 'Creative', importance: 5 },
              { id: 'f3', label: 'Chunking', group: 'Memory', importance: 4 },
              { id: 'f4', label: 'Working Memory (4 slots)', group: 'Constraint', importance: 5 },
            ],
            edges: [
              { from: 'f1', to: 'f3', label: 'Compresses concepts into', type: 'causes' },
              { from: 'f3', to: 'f4', label: 'Frees up slots in', type: 'regulates' },
              { from: 'f2', to: 'f1', label: 'Feeds novel ideas back to', type: 'causes' },
            ],
          },
          system: {
            inputs: ['Study material', 'Focus duration', 'Recovery periods'],
            feedbackLoops: [
              { type: 'positive', name: 'Chunk Compression', description: 'As chunks compact into long-term memory, working memory slots free up for higher-level problem solving.' },
            ],
            equilibriumState: 'A balanced rhythm of 25-50 min focused bouts separated by genuine mental decompression.',
            outputs: ['Deep conceptual mastery', 'High creative output', 'Resilience against burnout'],
          },
        },
      },
    ],
    podcastEpisodes: [
      {
        id: 'pod-lhtl-1',
        title: 'Passion Limits Growth & The Pinball Brain',
        duration: '4:15',
        durationSec: 255,
        hosts: {
          hostA: { name: 'Dr. Oakley', role: 'Neuroscience Educator', avatar: '👩‍🏫' },
          hostB: { name: 'Alex', role: 'Student', avatar: '🧑‍🎓' },
        },
        turns: [
          { id: 't1', speaker: 'hostB', text: "Dr. Oakley, why do so many people say 'follow your passion' when your research claims it actually holds people back?", timestamp: 0 },
          { id: 't2', speaker: 'hostA', text: "Because passions are usually based on what came easily to you as a child! If you only follow that, you close the door on mathematics, coding, or foreign languages before your brain has even had time to build the neural scaffolds.", timestamp: 14 },
          { id: 't3', speaker: 'hostB', text: "So you're saying passion is something you build, not something you find in the woods?", timestamp: 35 },
          { id: 't4', speaker: 'hostA', text: "Exactly! Mastery is what creates passion. Once you get past the initial 2 weeks of struggle, the dopamine reward kicks in, and you begin loving what was once intimidating.", timestamp: 48 },
        ],
      },
      {
        id: 'pod-lhtl-2',
        title: 'Chunking & Mental Neural Ribbons',
        duration: '6:30',
        durationSec: 390,
        hosts: {
          hostA: { name: 'Dr. Sejnowski', role: 'Computational Neurobiologist', avatar: '👨‍🔬' },
          hostB: { name: 'Alex', role: 'Curious Learner', avatar: '🧑‍🎓' },
        },
        turns: [
          { id: 't5', speaker: 'hostB', text: "Professor, how does a novice chess player differ neurobiologically from a grandmaster?", timestamp: 0 },
          { id: 't6', speaker: 'hostA', text: "A novice sees 32 individual pieces. Their 4 slots of working memory are instantly overwhelmed. A grandmaster sees chunks: 4 or 5 macro-patterns that contain entire game strategies.", timestamp: 12 },
          { id: 't7', speaker: 'hostB', text: "And that chunking frees up working memory for higher-level creative tactics?", timestamp: 28 },
          { id: 't8', speaker: 'hostA', text: "Precisely! Neural ribbons fire automatically, saving massive cognitive energy.", timestamp: 38 },
        ],
      },
      {
        id: 'pod-lhtl-3',
        title: 'The Zombie Habit: Overcoming Procrastination',
        duration: '7:15',
        durationSec: 435,
        hosts: {
          hostA: { name: 'Dr. Oakley', role: 'Neuroscience Educator', avatar: '👩‍🏫' },
          hostB: { name: 'Alex', role: 'Student', avatar: '🧑‍🎓' },
        },
        turns: [
          { id: 't9', speaker: 'hostB', text: "Why do we feel actual physical pain in the insular cortex when looking at something we need to study?", timestamp: 0 },
          { id: 't10', speaker: 'hostA', text: "The brain registers unfamiliar cognitive exertion as pain. To soothe it, your brain tempts you to switch to social media for instant dopamine!", timestamp: 15 },
          { id: 't11', speaker: 'hostB', text: "So the secret is just getting past that 20-minute barrier with Pomodoro?", timestamp: 30 },
          { id: 't12', speaker: 'hostA', text: "Yes, once the timer starts, the insular cortex calms down, and focus takes over.", timestamp: 40 },
        ],
      },
    ],
    canvasCards: [
      { id: 'l1', title: 'The 4 Working Memory Slots', content: 'Our working memory can only hold about 4 chunks at once. That is why chunking is critical: it bundles complex ideas into a single mental slot.', category: 'core', x: 80, y: 70, color: '#FEF3C7' },
      { id: 'l2', title: 'Thomas Edison\'s Ball Bearings', content: 'Edison would nap in a chair holding ball bearings. As he drifted into diffuse sleep, his hand relaxed, the balls dropped and clattered, waking him up to write down the eureka insight.', category: 'insight', x: 440, y: 80, color: '#DBEAFE' },
      { id: 'l3', title: 'Einstellung Effect', content: 'When an existing old idea blocks you from finding the true solution. Antidote: step away into diffuse mode.', category: 'question', x: 120, y: 290, color: '#FEE2E2' },
    ],
  },
  {
    id: 'yhq-extremal',
    title: "Ekstremal Haydash va Favqulodda Qarorlar",
    description: "Kutilmagan xavfli yo'l vaziyatlarida sovuqqonlik va to'g'ri fizik-mexanik reaksiyalar sirlari.",
    subjectId: 'yhq',
    badge: '🚗⚡',
    level: 'intermediate',
    estimatedMinutes: 18,
    totalXp: 280,
    sections: [
      {
        id: 'sec-1',
        title: "1-Bo'lim: Dinamik Muvozanat va Tormoz",
        description: "Inersiya, sirpanish va g'ildirak ilashish kuchining fizik tabiati",
        isCompleted: false,
        lessons: [
          {
            id: 'yhq-l1',
            title: "Akvaplaning: Suv ustida uchish xavfi",
            durationMinutes: 3,
            xp: 40,
            coins: 3,
            tags: ['Gidrodinamika', 'Shina', 'Tezlik'],
            status: 'available',
            tldr: "Shina protektori suvni chiqarishga ulgurmaganda avtomobil yer bilan aloqani yo'qotadi va boshqaruvsiz kema kabi suzadi.",
            pages: [
              {
                id: 'p1',
                title: "Suv xanjarining paydo bo'lishi",
                content: "Yomg'ir paytida yuqori tezlikda (odatda 70-80 km/soatdan yuqori) shina ostida [[gidrodinamik xanjar|G'ildirak oldida to'plangan suv bosimi shinani yo'l sathidan ko'tarib yuboruvchi kuch]] hosil bo'ladi. Natijada shina va asfalt o'rtasidagi ilashish koeffitsienti amalda 0 ga tushadi.",
                keywords: [
                  { word: 'Gidrodinamik xanjar', definition: "G'ildirak oldida to'plangan suv shinani yo'l qoplamasidan ajratib yuboradigan bosim zonasidir." },
                  { word: 'Akvaplaning', definition: "Avtomobil shinalari va yo'l yuzasi o'rtasida to'liq suv qatlami hosil bo'lib, boshqaruvning yo'qolishi." },
                ],
                visual: {
                  type: 'diagram',
                  title: "Tezlik va Ilashish Maydoni",
                  caption: "Tezlik oshgani sari shina bilan yo'lning haqiqiy ilashish maydoni keskin qisqaradi.",
                  items: [
                    { label: '40 km/soat (Quruq)', value: 100, color: '#10B981', desc: 'Toʻliq ilashish' },
                    { label: '70 km/soat (Hoʻl)', value: 55, color: '#F59E0B', desc: 'Yarim ilashish' },
                    { label: '90+ km/soat (Koʻlmak)', value: 12, color: '#EF4444', desc: 'Akvaplaning (xavfli)' },
                  ],
                },
              },
              {
                id: 'p2',
                title: "Akvaplaningda nima qilish MUMKIN EMAS?",
                content: "Eng katta xato — vahima bilan [[keskin tormoz|Bloklangan g'ildirak suv ustida muzdagi shayba kabi to'g'ri sirpanadi]] bosish yoki rulni keskin burish. Rulni burib qo'ysangiz, mashina suvdan chiqqan lahzada (ilashish qaytganda) birdan o'sha tomonga otilib ketadi.",
                keywords: [
                  { word: 'Keskin tormoz', definition: "G'ildiraklar to'liq qotib qolganda yo'nalish nazorati butkul yo'qoladi." },
                ],
                visual: {
                  type: 'cycle',
                  title: "To'g'ri Harakat Ketma-ketligi",
                  items: [
                    { label: '1. Gazni sekin boʻshating', value: 33, color: '#3B82F6' },
                    { label: '2. Rulni toʻgʻri ushlang', value: 33, color: '#8B5CF6' },
                    { label: '3. Dvigatel orqali tormozlang', value: 34, color: '#10B981' },
                  ],
                },
              },
            ],
            quiz: {
              type: 'mcq',
              question: "Akvaplaning sodir bo'lganini sezgan haydovchi birinchi bo'lib qanday chora ko'rishi lozim?",
              options: [
                { id: 'opt-a', text: "Tormoz pedalini bor kuchi bilan polgacha bosish" },
                { id: 'opt-b', text: "Gaz pedalini bo'shatib, rulni tekis tutgan holda ilashishni kutish" },
                { id: 'opt-c', text: "Rulni tezlik bilan chapga va o'ngga burish" },
                { id: 'opt-d', text: "Qo'l tormozi (ruchnik)ni zudlik bilan tortish" },
              ],
              correctOptionId: 'opt-b',
              explanation: "Gazni bo'shatish mashina tezligini tabiiy ravishda kamaytiradi va g'ildiraklar qayta yo'lga ilashguncha kurs barqarorligini saqlaydi.",
            },
          },
          {
            id: 'yhq-l2',
            title: "Sirpanish (Zanos): Oldi va Orqa tortuvchi farqi",
            durationMinutes: 4,
            xp: 50,
            coins: 3,
            tags: ['Dinamika', 'Zanos', 'Rul'],
            status: 'locked',
            tldr: "Oldi tortuvchi avtomobilda zanosda gaz bosiladi, orqa tortuvchida esa aksincha gaz bo'shatiladi.",
            pages: [
              {
                id: 'p1',
                title: "Zanosning fizik sababi",
                content: "Orqa o'qning yon tomonga sirpanib ketishi [[sentrifugal kuch|Aylana harakatda jismni markazdan tashqariga itaruvchi inersiya kuchi]] g'ildiraklarning ilashish chegarasidan oshib ketganida boshlanadi.",
                keywords: [
                  { word: 'Sentrifugal kuch', definition: "Burilish paytida mashinani tashqariga tortuvchi kuch." },
                ],
              },
            ],
            quiz: {
              type: 'cloze',
              question: "Oldi tortuvchi (FWD) mashinada zanos paytida rulni sirpanish tomoniga burib, gaz pedalini _________ kerak.",
              clozeTemplate: "Oldi tortuvchi mashinada gaz pedalini {{blank}} lozim.",
              clozeAnswer: "yengil bosish",
              clozeOptions: ["yengil bosish", "keskin qo'yib yuborish", "polgacha bosish", "o'chirish"],
              explanation: "Old g'ildiraklar mashinani o'z ortidan tortib, trayektoriyani to'g'rilaydi.",
            },
          },
          {
            id: 'yhq-l3',
            title: "ABS tizimi va To'siqdan aylanib o'tish",
            durationMinutes: 3,
            xp: 45,
            coins: 3,
            tags: ['ABS', 'Manevr'],
            status: 'locked',
            isMilestone: true,
            tldr: "ABS tormoz masofasini har doim ham qisqartirmaydi, uning bosh maqsadi — tormoz bosilgan paytda rulni boshqarish imkoniyatini saqlashdir.",
            pages: [
              {
                id: 'p1',
                title: "ABS ning asl vazifasi",
                content: "Ko'pchilik [[ABS|G'ildiraklar to'liq bloklanishini oldini oluvchi elektron-gidravlik tizim]] tormoz yo'lini kamaytiradi deb o'ylaydi. Lekin shag'al yoki qalin qorda u tormoz yo'lini hatto uzaytirishi mumkin. Uning oltin afzalligi — tormoz vaqtida to'siqdan aylanib o'tish imkonidir.",
                keywords: [
                  { word: 'ABS', definition: "Anti-lock Braking System — g'ildirak aylanib turishini ta'minlab, rul nazoratini saqlab beradi." },
                ],
              },
            ],
            quiz: {
              type: 'boolean',
              question: "ABS tizimiga ega mashinada tormozni polgacha bosgan holda bir vaqtda to'siqni aylanib o'tish uchun rulni burish mumkinmi?",
              booleanCorrect: true,
              explanation: "Ha! Aynan shuning uchun ABS yaratilgan: g'ildiraklar aylanib turgani sababli avtomobil rul buyrug'iga to'liq bo'ysunadi.",
            },
          },
        ],
      },
    ],
    refractorTopics: [
      {
        id: 'ref-yhq-abs',
        title: "Favqulodda Tormozlash: ABS ga qarshi Impulsli Tormoz",
        concept: "Zamonaviy elektronika vs Haydovchining klassik mexanik mahorati",
        lenses: {
          competing: {
            viewA: {
              title: "Avtomatlashgan ABS",
              stance: "Pedalni bor kuchi bilan bosish va barcha nazoratni kompyuterga topshirish",
              arguments: [
                "Inson reaksiyasidan 20 baravar tez (soniyasiga 15-20 marta impuls)",
                "Haydovchiga to'siqdan qochish uchun faqat rulga diqqat qaratish imkonini beradi",
                "Stress holatidagi xatolarni minimallashtiradi",
              ],
              advocate: "Zamonaviy avtomobil muhandislari va xavfsizlik standartlari (EuroNCAP)",
            },
            viewB: {
              title: "Bosqichli (Impulsli) Tormoz",
              stance: "G'ildirak ilashish chegarasini oyoq sezgisi bilan ushlash (Threshold braking)",
              arguments: [
                "G'ovak qor va shag'alda ABS dan ko'ra 25% gacha qisqaroq tormoz masofasi",
                "Oldi osma prujinasini me'yorda yuklab, burilish uchun ideal vazn taqsimoti beradi",
                "Elektronika buzilgan holatlarda hayotiy yagona mahorat",
              ],
              advocate: "Ralli va poyga instruktorlari",
            },
            synthesis: "Shahar va asfalt yo'llarda ABS ga 100% ishonish kerak; murakkab qor, muz va qumda esa cheklangan ilashish chegarasini his qilish ustun turadi.",
          },
          component: {
            columns: ['Qism', 'Vazifasi', 'Ishlash mexanizmi', 'Nosozlik oqibati'],
            rows: [
              { component: "G'ildirak datchigi (Wheel Speed Sensor)", role: 'Tezlikni o\'lchash', mechanism: 'Magnit impuls chastotasini hisoblaydi', failureImpact: 'ABS o\'chadi, klassik tormoz qoladi' },
              { component: 'Gidroblok klapanlari', role: 'Bosimni tushirish/ushlash', mechanism: 'Solenoid klapan soniyasiga 15 marta ochilib-yopiladi', failureImpact: 'G\'ildirak to\'liq bloklanadi' },
              { component: 'Tormoz suyuqligi (DOT 4/5.1)', role: 'Kuch uzatish', mechanism: 'Siqilmas suyuqlik orqali support porshenini suradi', failureImpact: 'Pedal bo\'shab qoladi (tormoz yo\'qoladi)' },
              { component: 'Elektron boshqaruv bloki (ECU)', role: 'Algoritmik qaror', mechanism: 'Datchik signallarini tahlil qilib, sirpanishni aniqlaydi', failureImpact: 'Tizim xatoga tushadi' },
            ],
          },
          progression: {
            stages: [
              { step: 1, name: "Xavfni ilg'ash", trigger: "To'siq paydo bo'lishi", state: "Ko'z qorachig'i kengayadi, adrenalin otiladi", milestone: '0.3 - 0.7 soniya reaksiya' },
              { step: 2, name: "Pedalga zarba", trigger: "Oyoq tormozga boradi", state: "Tizimda 100+ bar gidravlik bosim hosil bo'ladi", milestone: 'G\'ildiraklar aylanishi sekinlashadi' },
              { step: 3, name: "Bloklanish chegarasi", trigger: "Ilashish kuchi tugashi", state: "G'ildirak aylanishdan to'xtay boshlaydi", milestone: 'ABS datchigi 0 tezlikni qayd etadi' },
              { step: 4, name: "Impulsli modulyatsiya", trigger: "Gidroblok ishga tushishi", state: "Pedalda kuchli titrash (pulsatsiya) seziladi", milestone: 'Mashina yo\'nalishini boshqarish mumkin' },
            ],
          },
          relationship: {
            nodes: [
              { id: 'n1', label: 'Yo\'l qoplamasi', group: 'Tashqi muhit', importance: 5 },
              { id: 'n2', label: 'Shina protektori', group: 'Mexanika', importance: 5 },
              { id: 'n3', label: 'Tezlik (V^2)', group: 'Fizika', importance: 5 },
              { id: 'n4', label: 'Tormoz masofasi', group: 'Natija', importance: 4 },
              { id: 'n5', label: 'Boshqaruv barqarorligi', group: 'Xavfsizlik', importance: 5 },
            ],
            edges: [
              { from: 'n3', to: 'n4', label: 'Kvadratik oshiradi', type: 'causes' },
              { from: 'n1', to: 'n2', label: 'Ilashish koeffitsientini belgilaydi', type: 'regulates' },
              { from: 'n2', to: 'n5', label: 'Yo\'nalishni ushlaydi', type: 'causes' },
            ],
          },
          system: {
            inputs: ['Pedal bosimi', 'Boshlang\'ich tezlik', 'Yo\'l holati (quruq/ho\'l/muz)'],
            feedbackLoops: [
              { type: 'negative', name: 'Bosimni qaytarish silliqligi', description: 'G\'ildirak bloklanganda klapan ochilib bosim tushiriladi, g\'ildirak aylangach yana siqiladi.' },
              { type: 'positive', name: 'Issiqlik pasayishi', description: 'Tormoz diski qizib ketganda (fading) ilashish pasayadi va ko\'proq bosim talab etiladi.' },
            ],
            equilibriumState: "G'ildirakning yo'lga nisbatan 15-20% nisbiy sirpanish darajasi (eng yuqori tormoz samaradorligi nuqtasi).",
            outputs: ['Minimal tormoz yo\'li', 'Rul orqali boshqaruvchanlik', 'Passiv xavfsizlik'],
          },
        },
      },
    ],
    podcastEpisodes: [
      {
        id: 'pod-yhq-1',
        title: "1-Qism: Muz ustida raqs — Zanos va Sovuqqonlik",
        duration: '3:45',
        durationSec: 225,
        hosts: {
          hostA: { name: 'Sardor aka', role: 'Katta instruktor', avatar: '👨‍🏫' },
          hostB: { name: 'Nilufar', role: 'Qiziquvchan haydovchi', avatar: '👩‍🎓' },
        },
        turns: [
          { id: 't1', speaker: 'hostB', text: "Sardor aka, kecha yomg'irdan keyin burilishda mashinamning orqasi to'satdan o'ngga qarab keta boshladi! Rosa qo'rqib ketdim, tormozni bosdim, lekin battar aylandi!", timestamp: 0 },
          { id: 't2', speaker: 'hostA', text: "Aynan shu — yangi haydovchilarning 90 foizi qiladigan eng xavfli instinktiv xato, Nilufar. Zanos paytida tormoz bosilsa, orqa o'q yuklamadan butunlay ozod bo'ladi va sirpanish 3 baravar kuchayadi.", timestamp: 12 },
          { id: 't3', speaker: 'hostB', text: "Voy! Unda nima qilish kerak edi? Rulni qayoqqa burishim kerak?", timestamp: 24 },
          { id: 't4', speaker: 'hostA', text: "Oltin qoidani yodlab oling: 'Rul doimo zanos tomoniga!' Agar mashinangizning orqasi o'ngga ketsa, rulni ham chaqqonlik bilan o'ngga burasiz. Lekin burib qotib qolmang — mashina to'g'rilanishi bilan rulni ham joyiga qaytarish shart!", timestamp: 32 },
          { id: 't5', speaker: 'hostB', text: "Gaz pedalichi? Menda oldi tortuvchi Nexia 3 edi...", timestamp: 50 },
          { id: 't6', speaker: 'hostA', text: "Oldi tortuvchida gazni tashlab yubormang! Aksincha, ozgina gaz bering — old g'ildiraklar mashinani xuddi lokomotiv kabi tortib chiqaradi. Orqa tortuvchida esa aksincha, gazni muloyim bo'shatish kerak.", timestamp: 58 },
        ],
      },
    ],
    canvasCards: [
      { id: 'c1', title: "Oltin Qoida: Rul Zanos Tomonga", content: "Orqa o'ngga ketsa — rul o'ngga. Mashina to'g'rilanishi bilan rulni darhol markazga qaytarish shart, aks holda dinamik 'xlist' (qarshi zanos) boshlanadi.", category: 'core', x: 80, y: 60, color: '#FEF3C7' },
      { id: 'c2', title: "ABS + To'siq", content: "ABS bor bo'lsa: Tormozni bor kuchingiz bilan bosing va bir vaqtda to'siqni aylanib o'tish uchun rulni buring. ABS bunga imkon beradi.", category: 'insight', x: 420, y: 80, color: '#DBEAFE' },
      { id: 'c3', title: "Tormoz Masofasi Formulasi", content: "S = V^2 / (254 * fi). Tezlik 2 baravar oshsa, tormoz yo'li 4 baravar uzayadi!", category: 'formula', x: 120, y: 280, color: '#FEE2E2' },
      { id: 'c4', title: "Akvaplaning chegarasi", content: "Protektor chuqurligi 4 mm dan kam bo'lsa, xavf 60 km/soatdan boshlanadi. Shina bosimini me'yorda saqlang.", category: 'question', x: 460, y: 300, color: '#D1FAE5' },
    ],
  },
  {
    id: 'fizika-kvant',
    title: "Kvant Fizikasi va Borliqning Noaniqligi",
    description: "To'lqin-zarracha dualizmi, Shredinger mushugi va Eynshteynning kvant chigalligi haqidagi bahslari.",
    subjectId: 'fizika',
    badge: '⚛️✨',
    level: 'deep',
    estimatedMinutes: 25,
    totalXp: 350,
    sections: [
      {
        id: 'sec-q1',
        title: "1-Bo'lim: Mikrodunyo Paradokslari",
        description: "Yorug'lik zarrachami yoki to'lqin? Kuzatuvchining borliqqa ta'siri",
        isCompleted: false,
        lessons: [
          {
            id: 'fiz-l1',
            title: "Ikki tirqish tajribasi: Borliq bizni kuzatyaptimi?",
            durationMinutes: 4,
            xp: 50,
            coins: 4,
            tags: ['Dualizm', 'Foton', 'Interferensiya'],
            status: 'available',
            tldr: "Fotonlar va elektronlar kuzatuvchi bo'lmaganda to'lqin kabi harakatlanadi, detektor qo'yilganda esa oddiy zarracha kabi o'zini tutadi.",
            pages: [
              {
                id: 'qp1',
                title: "O'tmishdagi eng go'zal fizik tajriba",
                content: "Tomas Yung tajribasida yorug'lik ikki tirqishdan o'tib devorda [[interferentsiya chiziqlari|To'lqinlarning bir-birini kuchaytirishi va so'ndirishi natijasida hosil bo'ladigan yorug' va qorong'u yo'llar]] hosil qildi. Bu yorug'likning to'lqin ekanligini isbotlagan edi.",
                keywords: [
                  { word: 'Interferensiya', definition: "Ikki yoki undan ortiq to'lqinlarning fazoda qo'shilib, natijaviy to'lqin hosil qilishi." },
                ],
                visual: {
                  type: 'diagram',
                  title: "Kuzatuvchining Ta'siri",
                  items: [
                    { label: "Detektorsiz (To'lqin)", value: 100, color: '#6366F1', desc: 'Interferensiya manzarasi' },
                    { label: "Detektor bilan (Zarra)", value: 45, color: '#EC4899', desc: 'Faqat 2 ta toʻgʻri chiziq' },
                  ],
                },
              },
            ],
            quiz: {
              type: 'mcq',
              question: "Ikki tirqish tajribasida har bir foton qaysi tirqishdan o'tganini aniqlovchi detektor qo'yilganda nima yuz beradi?",
              options: [
                { id: 'a', text: "Interferensiya manzarasi saqlanib qoladi" },
                { id: 'b', text: "To'lqin funksiyasi kollaps bo'lib, ekranda faqat ikkita oddiy chiziq qoladi" },
                { id: 'c', text: "Fotonlar orqaga qaytadi" },
                { id: 'd', text: "Tirqishlar erib ketadi" },
              ],
              correctOptionId: 'b',
              explanation: "Kuzatish o'lchov jarayoni bo'lib, superpozitsiyani buzadi va tizimni aniq bir zarracha holatiga majburlaydi.",
            },
          },
        ],
      },
    ],
    refractorTopics: [
      {
        id: 'ref-kvant-shredinger',
        title: "Kvant Mexanikasi Talqini: Kopengagen vs Ko'p Olamlar (Everett)",
        concept: "Kuzatuv jarayonida borliq qanday holatga keladi?",
        lenses: {
          competing: {
            viewA: {
              title: "Kopengagen Talqini (Bor, Geysenberg)",
              stance: "Zarracha kuzatilgunga qadar faqat ehtimolliklar to'lqinida (superpozitsiyada) yashaydi",
              arguments: [
                "To'lqin funksiyasi kollapsi — haqiqatni aniqlovchi jarayon",
                "O'lchovdan oldin zarrachaning aniq koordinatasi mavjud emas",
                "Fizika borliq qandayligini emas, biz u haqida nima deya olishimizni o'rganadi",
              ],
              advocate: "Nils Bor va Verner Geysenberg",
            },
            viewB: {
              title: "Ko'p Olamlar Talqini (Hyu Everett)",
              stance: "Hech qanday kollaps yo'q: har bir mumkin bo'lgan natija alohida parallel koinotda ro'y beradi",
              arguments: [
                "Shredinger tenglamasi butun olam uchun uzluksiz ishlaydi",
                "Mushuk bir koinotda tirik, parallel koinotda esa vafot etgan",
                "Kuzatuvchining o'zi ham bifurkatsiya (tarmoqlanish)ga uchraydi",
              ],
              advocate: "Hyu Everett, Shon Kerroll, Devid Doych",
            },
            synthesis: "Ikkala nazariya ham matematik jihatdan bir xil natijalarni bashorat qiladi; farq bizning ong va borliq falsafasini qanday qabul qilishimizda.",
          },
          component: {
            columns: ['Konsept', "Kopengagen ta'rifi", "Ko'p Olamlar ta'rifi", 'Eksperimental holat'],
            rows: [
              { component: "To'lqin funksiyasi psi", role: "Ehtimollik amplitudasi", mechanism: "Haqiqiy jismoniy tarmoqlanuvchi ob'ekt", failureImpact: "Har ikki talqinda to'liq saqlanadi" },
              { component: "O'lchov asbobi", role: "Kollapsni chaqiruvchi makroob'ekt", mechanism: "Tizim bilan chigallashuvchi (entangled) ob'ekt", failureImpact: "Dekogerensiya sodir bo'ladi" },
            ],
          },
          progression: {
            stages: [
              { step: 1, name: "Izolyatsiya", trigger: "Tizim tashqi muhitdan ajratiladi", state: "Sof superpozitsiya holati", milestone: "psi = c1|0> + c2|1>" },
              { step: 2, name: "Kuzatuv / Foton urilishi", trigger: "Detektor fotoni bilan to'qnashuv", state: "Dekogerensiya boshlanishi", milestone: "10^-20 soniyada fazoviy ajralish" },
              { step: 3, name: "Natija qayd etilishi", trigger: "Makro asbob o'lchovi", state: "Aniq bir holat (yoki koinot ajralishi)", milestone: "Klassik dunyoga o'tish" },
            ],
          },
          relationship: {
            nodes: [
              { id: 'k1', label: 'Superpozitsiya', group: 'Kvant', importance: 5 },
              { id: 'k2', label: 'Dekogerensiya', group: 'Ko\'prik', importance: 4 },
              { id: 'k3', label: 'Chigallik (Entanglement)', group: 'Kvant', importance: 5 },
              { id: 'k4', label: 'Klassik Borliq', group: 'Makro', importance: 4 },
            ],
            edges: [
              { from: 'k1', to: 'k2', label: 'Atrof-muhit bilan aloqada yo\'qoladi', type: 'causes' },
              { from: 'k2', to: 'k4', label: 'Biz ko\'radigan dunyoni shakllantiradi', type: 'causes' },
            ],
          },
          system: {
            inputs: ['Kvant superpozitsiyasi', 'Atrof-muhit shovqini', 'O\'lchov parametrlari'],
            feedbackLoops: [
              { type: 'negative', name: 'Dekogerensiya filtri', description: 'Atrof-muhitdagi millionlab foton va havo molekulalari tizimni zudlik bilan klassik holatga itaradi.' },
            ],
            equilibriumState: 'Termodinamik barqaror klassik fizik borliq.',
            outputs: ['Aniq o\'lchov qiymati', 'Klassik makro-voqelik'],
          },
        },
      },
    ],
    podcastEpisodes: [
      {
        id: 'pod-fiz-1',
        title: "Kvant Chigalligi: Eynshteyn nega adashgan edi?",
        duration: '4:10',
        durationSec: 250,
        hosts: {
          hostA: { name: 'Professor Karimov', role: 'Fizik-nazariyotchi', avatar: '👨‍🔬' },
          hostB: { name: 'Jasur', role: 'Talaba', avatar: '🧑‍💻' },
        },
        turns: [
          { id: 't1', speaker: 'hostB', text: "Professor, Eynshteyn kvant chigalligini 'masofadagi dahshatli arvohona ta'sir' deb atagan ekan. U nega bu hodisaga ishonmagan?", timestamp: 0 },
          { id: 't2', speaker: 'hostA', text: "Ajoyib savol, Jasur! Chunki Eynshteynning Nisbiylik nazariyasiga ko'ra hech narsa, hatto axborot ham yorug'lik tezligidan tez harakatlana olmaydi. Agar bir zarrachani Yerda o'lchasak va Andromeda galaktikasidagi zarracha zumda o'zgarsa — demak axborot yorug'likdan cheksiz tez uzatilgandek tuyuladi!", timestamp: 15 },
          { id: 't3', speaker: 'hostB', text: "Rostdan ham! Unda yorug'lik tezligi chegarasi buzilmaydimi?", timestamp: 42 },
          { id: 't4', speaker: 'hostA', text: "Buzilmaydi! Sababi — bu bilan siz o'zingiz istagan ixtiyoriy xabarni yubora olmaysiz. Zarrachalar qaysi holatga tushishi mutlaqo tasodifiy. Jon Bell tajribalari va 2022-yilgi Nobel mukofoti isbotladiki: koinot mahalliy (lokal) emas, lekin nedeterministik!", timestamp: 52 },
        ],
      },
    ],
    canvasCards: [
      { id: 'fc1', title: "Heyzenberg Noaniqlik Printsipi", content: "dx * dp >= h_bar / 2. Zarrachaning o'rnini qanchalik aniq bilsangiz, uning tezligini shunchalik noaniq bilasiz.", category: 'formula', x: 70, y: 70, color: '#EDE9FE' },
      { id: 'fc2', title: "To'lqin-Zarracha Dualizmi", content: "Barcha modda ham to'lqin, ham zarracha tabiatiga ega. De Broyl to'lqin uzunligi: lambda = h / p.", category: 'core', x: 440, y: 80, color: '#E0F2FE' },
      { id: 'fc3', title: "Kvant Kompyuterlari Sirlari", content: "Kubitlar bir vaqtning o'zida ham 0, ham 1 bo'la olishi (superpozitsiya) sababli milliardlab kombinatsiyalarni parallel hisoblaydi.", category: 'insight', x: 120, y: 290, color: '#DCFCE7' },
    ],
  },
  {
    id: 'matematika-ai',
    title: "Matematika va Sun'iy Intellekt Asoslari",
    description: "Neyron tarmoqlar qanday 'o'ylaydi'? Matritsalar, gradient tushishi va ehtimollar falsafasi.",
    subjectId: 'matematika',
    badge: '🧠📐',
    level: 'intermediate',
    estimatedMinutes: 20,
    totalXp: 300,
    sections: [
      {
        id: 'sec-m1',
        title: "1-Bo'lim: Gradient Tushishi va Neyronlar",
        description: "Xatolikni minimumga tushirish matematikasi",
        isCompleted: false,
        lessons: [
          {
            id: 'mat-l1',
            title: "Gradient Tushishi: Tog'dan tuman ichida tushish san'ati",
            durationMinutes: 4,
            xp: 45,
            coins: 3,
            tags: ['Hosilalar', 'Gradient', 'Optimizatsiya'],
            status: 'available',
            tldr: "Neyrotarmoqni o'qitish — bu ko'p o'lchamli xatolik tog'idan pastlikka (minimumga) eng tik qiyalik bo'ylab tushishdir.",
            pages: [
              {
                id: 'mp1',
                title: "Hosila nima uchun kerak?",
                content: "Tasavvur qiling, siz ko'zingiz bog'liq holda baland tog'da turibsiz va eng quyi vodiyga tushishingiz kerak. [[Gradient|Ko'p o'zgaruvchili funksiyaning eng tez o'sish yo'nalishini ko'rsatuvchi vektor]] sizga eng tik pastlik qayerdaligini ko'rsatuvchi kompasdir.",
                keywords: [
                  { word: 'Gradient', definition: "Xususiy hosilalardan tashkil topgan vektor; unga qarama-qarshi yo'nalish (antigradient) eng tez pasayish yo'nalishidir." },
                ],
              },
            ],
            quiz: {
              type: 'mcq',
              question: "Gradient tushishida o'rganish tezligi (Learning Rate) haddan tashqari katta qilib belgilansa nima yuz beradi?",
              options: [
                { id: 'a', text: "Model darhol eng yaxshi minimumga erishadi" },
                { id: 'b', text: "Algoritm pastlikdan sakrab o'tib ketadi va xatolik cheksiz oshib ketishi mumkin (divergentsiya)" },
                { id: 'c', text: "Kompyuter xotirasi to'lib qoladi" },
                { id: 'd', text: "Gradient 0 ga teng bo'lib qoladi" },
              ],
              correctOptionId: 'b',
              explanation: "Katta qadam (learning rate) vodiy tubidagi minimumdan sakrab o'tib ketishga va tizimning tebranishiga olib keladi.",
            },
          },
        ],
      },
    ],
    refractorTopics: [
      {
        id: 'ref-ai-math',
        title: "Sun'iy Intellekt: Statistika vs Haqiqiy Ong",
        concept: "Katta til modellari shunchaki so'z ehtimolini hisoblaydimi yoki mantiqiy modelga egami?",
        lenses: {
          competing: {
            viewA: {
              title: "Stoxastik To'tiqush (Stochastic Parrot)",
              stance: "AI faqat ulkan matnlardagi ehtimollik taqsimotini nusxalaydi, hech qanday ma'no tushunish yo'q",
              arguments: [
                "Keyingi so'z ehtimolligi P(w_n | w_1...w_{n-1}) shunchaki ko'p o'lchamli matritsa ko'paytmasi",
                "Jismoniy dunyo bilan bevosita tajribasi (embodiment) yo'q",
                "Hallyutsinatsiyalar uning mohiyatni tushunmasligining ochiq isboti",
              ],
              advocate: "Emili Bender, Timnit Gebru, Noam Xomskiy",
            },
            viewB: {
              title: "Emerjens Dunyo Modeli (World Model)",
              stance: "Murakkab ehtimolliklarni aniq bashorat qilish uchun tarmoq ichida olam modeli shakllanishi shart",
              arguments: [
                "Shaxmat o'yinini bashorat qilish uchun model ichida 64 katakli taxta holati vujudga keladi (Linear probes isboti)",
                "Ko'p bosqichli mantiqiy mulohazalar (Reasoning chains) yangi kashfiyotlarga olib kelmoqda",
                "Inson miyasi ham elektrokimyoviy neyronlar ehtimollik apparatidir",
              ],
              advocate: "Ilya Sutskever, Jeffri Xinton, Yann Lekun",
            },
            synthesis: "Statistika va idrok o'rtasidagi chegara biz o'ylaganchalik keskin emas: murakkab statistik bashorat o'z ichida mantiqiy abstraksiyalarni yashiradi.",
          },
          component: {
            columns: ['Qatlam', 'Matematik asosi', 'AI dagi vazifasi', 'Ahamiyati'],
            rows: [
              { component: 'Chiziqli Algebra', role: 'Matritsalar va vektorlar', mechanism: 'Qatlamlar orasidagi og\'irliklarni (W * x + b) hisoblash', failureImpact: 'Modelning asosiy skeleti' },
              { component: 'Matematik Analiz', role: 'Gradient va hosilalar', mechanism: 'Orqaga tarqalish (Backpropagation) orqali xatolarni tuzatish', failureImpact: 'O\'rganish imkoniyati' },
              { component: 'Ehtimollar Nazariyasi', role: 'Bayes formulasi, entropiya', mechanism: 'Noaniqlikni o\'lchash va softmax taqsimoti', failureImpact: 'Qaror qabul qilish' },
            ],
          },
          progression: {
            stages: [
              { step: 1, name: "Matnni tokenlash", trigger: "Foydalanuvchi so'rovi", state: "So'zlar sonli vektorlarga (embeddings) aylanadi", milestone: "Vektor fazosi d=4096" },
              { step: 2, name: "Self-Attention (Diqqat)", trigger: "Qatlamlardan o'tish", state: "Har bir so'z boshqa barcha so'zlar bilan bog'lanishini hisoblaydi", milestone: "Q * K^T / sqrt(d_k)" },
              { step: 3, name: "Softmax ehtimollik", trigger: "Chiqish qatlami", state: "Barcha mumkin bo'lgan so'zlarning ehtimollik taqsimoti", milestone: "P(next_word)" },
            ],
          },
          relationship: {
            nodes: [
              { id: 'm1', label: 'Vektor fazosi', group: 'Matematika', importance: 5 },
              { id: 'm2', label: 'Transformer arxitekturasi', group: 'Model', importance: 5 },
              { id: 'm3', label: 'Gradient tushishi', group: 'Algoritm', importance: 4 },
              { id: 'm4', label: 'Tushunish/Mulohaza', group: 'Emerjens', importance: 5 },
            ],
            edges: [
              { from: 'm1', to: 'm2', label: 'Asos bo\'lib xizmat qiladi', type: 'contains' },
              { from: 'm3', to: 'm2', label: 'Og\'irliklarni optimallashtiradi', type: 'regulates' },
              { from: 'm2', to: 'm4', label: 'Katta miqyosda uyg\'otadi', type: 'causes' },
            ],
          },
          system: {
            inputs: ['Trening ma\'lumotlari', 'Hisoblash quvvati (GPU)', 'Loss funksiyasi'],
            feedbackLoops: [
              { type: 'negative', name: 'Backprop xatolik kamayishi', description: 'Xatolik qanchalik katta bo\'lsa, og\'irliklar shunchalik tez o\'zgartiriladi.' },
            ],
            equilibriumState: 'Global minimumga yaqin minimal loss qiymati.',
            outputs: ['Yuksak intellektual matn/kod generatsiyasi'],
          },
        },
      },
    ],
    podcastEpisodes: [
      {
        id: 'pod-mat-1',
        title: "Sun'iy Intellekt orqasidagi go'zal matematika",
        duration: '3:30',
        durationSec: 210,
        hosts: {
          hostA: { name: 'Alisher', role: 'Ma\'lumotlar olimi', avatar: '🧑‍💻' },
          hostB: { name: 'Shahnoza', role: 'Matematik', avatar: '👩‍🔬' },
        },
        turns: [
          { id: 't1', speaker: 'hostA', text: "Shahnoza, do'stlarim menga 'AI bu sehr' deyishadi. Men esa bu shunchaki milliardlab chiziqli tenglamalar va gradient tushishi deyman.", timestamp: 0 },
          { id: 't2', speaker: 'hostB', text: "To'ppa-to'g'ri, Alisher! Maktabda o'qiganimiz: y = kx + b formulasi esingizdami? Neyron tarmog'i — aynan shu formulaning millionlab o'lchamli ko'rinishidir!", timestamp: 14 },
          { id: 't3', speaker: 'hostA', text: "Va eng qizig'i — xatolikni tuzatish uchun oddiy maktab hosilasi (dy/dx) ishlatiladi. Zanjir qoidasi (Chain Rule) orqali milliardlab parametrlarni daqiqalarda moslashtiramiz.", timestamp: 28 },
        ],
      },
    ],
    canvasCards: [
      { id: 'mc1', title: "Softmax Formulasi", content: "sigma(z)_i = e^{z_i} / sum(e^{z_j}). Har qanday sonlar vektorini yig'indisi 1 ga teng ehtimollikka aylantiradi.", category: 'formula', x: 80, y: 70, color: '#FEE2E2' },
      { id: 'mc2', title: "Orqaga Tarqalish (Backprop)", content: "Chain rule yordamida har bir parametrning yakuniy xatolikka ta'siri (dL/dw) hisoblanadi.", category: 'core', x: 420, y: 80, color: '#E0E7FF' },
      { id: 'mc3', title: "Overfitting Xavfi", content: "Model trening testlarini yodlab olib, real yangi savollarda adashsa — bunga overfitting deyiladi. Buni Dropout va Regularizatsiya tuzatadi.", category: 'insight', x: 130, y: 290, color: '#FEF9C3' },
    ],
  },
  ...WONDER_CATALOG_COURSES,
]
