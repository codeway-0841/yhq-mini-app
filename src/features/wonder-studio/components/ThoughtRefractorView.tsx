import { useState, useMemo } from 'react'
import {
  TrendingUp,
  ArrowRight,
  AlertCircle,
  RotateCcw,
  Play,
  Sparkles,
  Layers,
} from 'lucide-react'
import type { WonderCourse, RefractorTopic } from '../types'

interface ThoughtRefractorViewProps {
  course: WonderCourse
}

type ExampleKey =
  | 'thought_refractor'
  | 'education'
  | 'remote_work'
  | 'climate'
  | 'philosophy'
  | 'economics'

const EXAMPLE_TOPICS: {
  id: ExampleKey
  label: string
  sourceText: string
  category: string
}[] = [
  {
    id: 'thought_refractor',
    label: 'THOUGHT REFRACTOR',
    category: 'Generative vs. Re-representative AI',
    sourceText:
      "Thought Refractor is a reading tool built around a simple idea: a dense passage usually contains more structure than prose can comfortably show on its own. Instead of producing one summary or one diagram, it turns the same text into several visual readings, such as flowcharts, comparison tables, concept maps, timelines, and step-by-step breakdowns, each revealing a different dimension of meaning. The project grew in part out of earlier work designing NotebookLM's AI mind map at Google, where giving information spatial structure often helped people ask better questions and notice unknown unknowns.\n\nThe design evolved through several frames before arriving at the current one. An early version focused on extracting thesis statements, assumptions, and blind spots into an interactive diagram. A later version embedded visualizations inline beside the source passage. The current version treats the same paragraph as raw material for several parallel structured readings, which gives the reader more freedom to move among perspectives rather than being locked into one canonical interpretation.",
  },
  {
    id: 'education',
    label: 'EDUCATION',
    category: 'Active Retrieval vs. Passive Review',
    sourceText:
      'Spaced repetition and active retrieval fundamentally alter how synaptic plasticity consolidates semantic memory. Rather than passive re-reading, forcing the brain to retrieve an answer strengthens neural pathways through reconsolidation. However, institutional schooling often optimizes for short-term cramming before standardized exams rather than durable mental models.',
  },
  {
    id: 'remote_work',
    label: 'REMOTE WORK',
    category: 'Asynchronous Focus vs. Social Cohesion',
    sourceText:
      'Asynchronous communication decouples productivity from physical co-presence, enabling deep focused work and global talent coordination. Yet without deliberate social rituals, organizational trust erodes, informal serendipity vanishes, and management defaults to surveillance metrics instead of outcome evaluation.',
  },
  {
    id: 'climate',
    label: 'CLIMATE',
    category: 'Decarbonization vs. Grid Reliability',
    sourceText:
      'The energy transition demands replacing fossil fuels with renewables while dramatically expanding the electrical grid. Although levelized costs of solar and wind have plummeted, intermittency requires long-duration storage and redundant baseload generation, creating complex capital allocation trade-offs.',
  },
  {
    id: 'philosophy',
    label: 'PHILOSOPHY',
    category: 'Internal Equanimity vs. External Agency',
    sourceText:
      'Stoicism posits that suffering arises not from external events, but from the judgments we form about them. By delineating the internal locus of control from external fortune, an individual cultivates tranquility. Modern critics argue this risks passive acceptance of systemic injustice, while proponents view it as emotional fortitude.',
  },
  {
    id: 'economics',
    label: 'ECONOMICS',
    category: 'Creative Destruction vs. Transitional Friction',
    sourceText:
      'Creative destruction drives long-term economic prosperity by reallocating scarce resources from obsolete technologies to innovative enterprises. While society benefits from productivity gains and lower consumer prices in the aggregate, the immediate dislocation of workers creates acute localized friction requiring social safety nets.',
  },
]

const BUILTIN_REFRACTOR_TOPICS: Record<ExampleKey, RefractorTopic> = {
  thought_refractor: {
    id: 'thought_refractor',
    title: 'Generative vs. Re-representative AI',
    concept: 'Turning dense prose into multi-perspective visual reading models',
    lenses: {
      competing: {
        topic: 'Generative vs. Re-representative AI',
        viewA: {
          title: 'Traditional Generative AI',
          stance: 'Focuses on creating new text from scratch to save reading time',
          arguments: [
            'Focuses on creating new text from scratch',
            'Aims for a single "correct" or "best" output',
            'Often hides the source logic behind a summary',
            'Reduces complexity to save time',
          ],
          advocate: 'Efficiency optimizers',
        },
        viewB: {
          title: 'Re-representative AI (Refractor)',
          stance: 'Transforms existing text into multi-perspective spatial structures',
          arguments: [
            'Transforms existing text into new structures',
            'Offers multiple partial views simultaneously',
            'Exposes the underlying architecture of thought',
            'Embraces complexity to deepen understanding',
          ],
          advocate: 'Cognitive designers & researchers',
        },
        synthesis:
          'Generative AI produces raw material, while re-representative AI clarifies and deepens comprehension by projecting the same argument through complementary visual representations.',
      },
      component: {
        columns: ['Version', 'Core Mechanism', 'User Benefit', 'Limitation'],
        rows: [
          {
            component: 'V1: Diagram',
            role: 'Logic Extraction',
            mechanism: 'Exposes blind spots and hidden assumptions',
            failureImpact: 'Too rigid and prescriptive for exploratory thinking',
          },
          {
            component: 'V2: Inline',
            role: 'Contextual Visuals',
            mechanism: 'Immediate reference alongside source text',
            failureImpact: 'Disrupts reading flow and spatial continuity',
          },
          {
            component: 'V3: Parallel',
            role: 'Multi-lens Views',
            mechanism: 'Parallel structured projections across five dimensions',
            failureImpact: 'Requires active synthesis from the reader',
          },
        ],
      },
      progression: {
        stages: [
          {
            step: 1,
            name: 'Dense Passage Ingestion',
            trigger: 'Inputting unstructured prose',
            state: 'Prose conceals implicit tradeoffs and axioms',
            milestone: 'Core thesis and axioms extracted',
          },
          {
            step: 2,
            name: 'Multi-Lens Projection',
            trigger: 'Deconstruction engine analysis',
            state: 'Text is refracted into 5 parallel models',
            milestone: 'Visual reading matrix rendered',
          },
          {
            step: 3,
            name: 'Dialectical Synthesis',
            trigger: 'Reader inspects competing stances and feedbacks',
            state: 'Mental model integration and retention',
            milestone: 'Permanent cognitive chunk consolidated',
          },
        ],
      },
      relationship: {
        nodes: [
          { id: 'source_prose', label: 'Source Prose', group: 'Input', importance: 3 },
          { id: 'latent_logic', label: 'Latent Logic', group: 'Extraction', importance: 3 },
          { id: 'five_lenses', label: '5 Visual Lenses', group: 'Projection', importance: 3 },
          { id: 'mental_model', label: 'Mental Model', group: 'Cognition', importance: 3 },
        ],
        edges: [
          { from: 'source_prose', to: 'latent_logic', label: 'deconstructs', type: 'causes' },
          { from: 'latent_logic', to: 'five_lenses', label: 'projects', type: 'contains' },
          { from: 'five_lenses', to: 'mental_model', label: 'wires', type: 'regulates' },
        ],
      },
      system: {
        inputs: ['Unstructured argumentative prose', 'Prior domain knowledge', 'Inquiry prompts'],
        feedbackLoops: [
          {
            type: 'positive',
            name: 'Aha! Insight Loop',
            description:
              'Visual structure exposes a hidden tension -> prompts re-reading the text with higher acuity -> refines the mental model.',
          },
        ],
        equilibriumState:
          'Cognitive clarity: the reader simultaneously grasps the direct claim and the trade-off space.',
        outputs: ['Multi-perspective comprehension', 'Actionable mental models', 'Identified blind spots'],
      },
    },
  },
  education: {
    id: 'education',
    title: 'Active Retrieval vs. Passive Review',
    concept: 'Synaptic plasticity and durable semantic consolidation in learning',
    lenses: {
      competing: {
        topic: 'Active Retrieval vs. Passive Review',
        viewA: {
          title: 'Passive Review & Highlighting',
          stance: 'Re-reading and passive review minimize friction and cover large volumes of text',
          arguments: [
            'Low cognitive barrier to entry',
            'Rapid superficial syllabus coverage',
            'Comforting feeling of familiarity',
          ],
          advocate: 'Traditional cramming systems',
        },
        viewB: {
          title: 'Effortful Active Retrieval',
          stance: 'Forcing the brain to retrieve an answer strengthens neural pathways through reconsolidation',
          arguments: [
            'Triggers synaptic reconsolidation via hippocampus',
            'Calibrates accurate metacognitive confidence',
            'Halts the Ebbinghaus forgetting curve decay',
          ],
          advocate: 'Cognitive neuroscientists (Bjork, Karpicke)',
        },
        synthesis:
          'Passive reading provides initial orienting context, but durable long-term retention requires effortful active retrieval at expanding spaced intervals.',
      },
      component: {
        columns: ['Mechanism', 'Cognitive Role', 'Neural Process', 'Failure Mode'],
        rows: [
          {
            component: 'Active Retrieval',
            role: 'Memory reconstruction',
            mechanism: 'Synaptic reconsolidation via hippocampal signaling',
            failureImpact: 'Rapid memory decay back to baseline',
          },
          {
            component: 'Spaced Repetition (FSRS)',
            role: 'Decay counteraction',
            mechanism: 'Expanding interval scheduling based on retrievability',
            failureImpact: 'Short-term cramming forgotten within 48 hours',
          },
          {
            component: 'Interleaving',
            role: 'Discrimination learning',
            mechanism: 'Dynamic neural network switching between problem types',
            failureImpact: 'Superficial single-pattern fixation and brittleness',
          },
        ],
      },
      progression: {
        stages: [
          {
            step: 1,
            name: 'Encoding Phase',
            trigger: 'First encounter with concept',
            state: 'Fragile working memory trace in prefrontal cortex',
            milestone: 'Initial semantic comprehension',
          },
          {
            step: 2,
            name: 'Incubation & Forgetting',
            trigger: 'Elapsed time interval',
            state: 'Partial synaptic decay and trace attenuation',
            milestone: 'Threshold of effortful recall reached',
          },
          {
            step: 3,
            name: 'Reconsolidation',
            trigger: 'Targeted prompt / flashcard recall',
            state: 'Protein synthesis and dendritic spine strengthening',
            milestone: 'Durable long-term memory chunk formed',
          },
        ],
      },
      relationship: {
        nodes: [
          { id: 'encoding', label: 'Initial Encoding', group: 'Phase', importance: 2 },
          { id: 'retrieval', label: 'Active Retrieval', group: 'Mechanism', importance: 3 },
          { id: 'reconsolidation', label: 'Synaptic Reconsolidation', group: 'Biology', importance: 3 },
          { id: 'fluency', label: 'Durable Fluency', group: 'Outcome', importance: 3 },
        ],
        edges: [
          { from: 'encoding', to: 'retrieval', label: 'tested by', type: 'causes' },
          { from: 'retrieval', to: 'reconsolidation', label: 'triggers', type: 'regulates' },
          { from: 'reconsolidation', to: 'fluency', label: 'produces', type: 'contains' },
        ],
      },
      system: {
        inputs: ['New conceptual axioms', 'Target retrieval prompts', 'Spaced intervals'],
        feedbackLoops: [
          {
            type: 'positive',
            name: 'Retrieval Strength Loop',
            description:
              'Successful retrieval strengthens memory trace, reducing future decay rate and increasing retrievability.',
          },
        ],
        equilibriumState:
          'Asymptotic retention: foundational concepts are automated into reflexive intuition.',
        outputs: ['Durable semantic memory', 'Fast intuitive problem solving', 'Long-term transfer'],
      },
    },
  },
  remote_work: {
    id: 'remote_work',
    title: 'Asynchronous Focus vs. Social Cohesion',
    concept: 'Decoupling physical co-presence from organizational productivity',
    lenses: {
      competing: {
        topic: 'Asynchronous Focus vs. Social Cohesion',
        viewA: {
          title: 'Asynchronous Autonomy',
          stance: 'Uninterrupted deep work blocks maximize intellectual output and global coordination',
          arguments: [
            'Zero meeting fatigue and context switching',
            'Encourages rigorous written documentation',
            'Allows talent to work at peak circadian times',
          ],
          advocate: 'Deep work advocates (Cal Newport)',
        },
        viewB: {
          title: 'Synchronous Social Cohesion',
          stance: 'Real-time co-presence builds psychological safety, spontaneous serendipity, and trust',
          arguments: [
            'Rapid tacit knowledge transmission',
            'Spontaneous hallway discoveries',
            'Emotional resonance and social solidarity',
          ],
          advocate: 'Organizational sociologists',
        },
        synthesis:
          'High-performing remote teams default to asynchronous documentation for execution, while scheduling intentional, high-bandwidth synchronous rituals for trust and alignment.',
      },
      component: {
        columns: ['Dimension', 'Primary Role', 'Mechanism', 'Failure Impact'],
        rows: [
          {
            component: 'Written Artifacts',
            role: 'Single source of truth',
            mechanism: 'RFCs, design docs, and pull requests',
            failureImpact: 'Organizational amnesia and repeated errors',
          },
          {
            component: 'Deep Work Windows',
            role: 'Cognitive throughput',
            mechanism: 'Notification silencing and batch processing',
            failureImpact: 'Shallow work and continuous fragmentation',
          },
          {
            component: 'Social Rituals',
            role: 'Psychological safety',
            mechanism: 'Intentional virtual coffee and team retreats',
            failureImpact: 'Isolation, disengagement, and erosion of trust',
          },
        ],
      },
      progression: {
        stages: [
          {
            step: 1,
            name: 'Autonomous Ideation',
            trigger: 'Individual contributor tackles complex problem',
            state: 'Uninterrupted deep flow state',
            milestone: 'Comprehensive RFC draft completed',
          },
          {
            step: 2,
            name: 'Asynchronous Peer Review',
            trigger: 'Publishing draft to team',
            state: 'Cross-timezone thoughtful feedback',
            milestone: 'Consensus reached without meetings',
          },
          {
            step: 3,
            name: 'Synchronous Celebration',
            trigger: 'Feature release / milestone reached',
            state: 'Shared joy and camaraderie',
            milestone: 'Team cohesion reinforced',
          },
        ],
      },
      relationship: {
        nodes: [
          { id: 'docs', label: 'Written Culture', group: 'Foundation', importance: 3 },
          { id: 'async', label: 'Async Cadence', group: 'Process', importance: 3 },
          { id: 'trust', label: 'Organizational Trust', group: 'Culture', importance: 3 },
          { id: 'velocity', label: 'Sustainable Velocity', group: 'Outcome', importance: 3 },
        ],
        edges: [
          { from: 'docs', to: 'async', label: 'enables', type: 'causes' },
          { from: 'async', to: 'trust', label: 'requires', type: 'regulates' },
          { from: 'trust', to: 'velocity', label: 'accelerates', type: 'contains' },
        ],
      },
      system: {
        inputs: ['Project goals', 'Asynchronous written RFCs', 'Communication channels'],
        feedbackLoops: [
          {
            type: 'positive',
            name: 'Documentation Compounding Loop',
            description:
              'Better documentation reduces interruption requests -> more time for deep work -> higher quality docs.',
          },
        ],
        equilibriumState:
          'High-trust autonomous execution paired with deliberate, high-warmth social touchpoints.',
        outputs: ['High intellectual output', 'Low burnout', 'Global talent retention'],
      },
    },
  },
  climate: {
    id: 'climate',
    title: 'Decarbonization vs. Grid Reliability',
    concept: 'Balancing intermittent renewables with 24/7 electrical grid stability',
    lenses: {
      competing: {
        topic: 'Decarbonization vs. Grid Reliability',
        viewA: {
          title: 'Rapid Renewable Penetration',
          stance: 'Plummeting solar and wind costs make 100% renewable generation the fastest climate solution',
          arguments: [
            'Zero marginal fuel cost',
            'Rapid deployment timelines',
            'Exponential technological learning curves',
          ],
          advocate: 'Clean energy advocates & technology analysts',
        },
        viewB: {
          title: 'Firm Baseload & Grid Stability',
          stance: 'Intermittent power requires massive redundant baseload (nuclear, hydro, gas) and grid inertia',
          arguments: [
            'Dunkelflaute (dark windless periods) risk blackouts',
            'Grid inertia required for frequency stability',
            'Battery storage currently limited to 4-8 hours',
          ],
          advocate: 'Grid operators & power engineers',
        },
        synthesis:
          'A reliable decarbonized grid pairs cheap intermittent solar and wind with long-duration storage and firm clean baseload (nuclear, geothermal).',
      },
      component: {
        columns: ['Asset Class', 'Role in Grid', 'Operational Mechanism', 'Vulnerability'],
        rows: [
          {
            component: 'Solar & Wind',
            role: 'Bulk clean generation',
            mechanism: 'Photovoltaic and aerodynamic conversion',
            failureImpact: 'Severe seasonal and diurnal intermittency',
          },
          {
            component: 'Firm Clean Baseload',
            role: 'Frequency and inertia anchor',
            mechanism: 'Synchronous generators (nuclear/hydro)',
            failureImpact: 'High capital expenditure and long construction timelines',
          },
          {
            component: 'Long-Duration Storage',
            role: 'Multi-day seasonal buffer',
            mechanism: 'Pumped hydro, flow batteries, and hydrogen',
            failureImpact: 'Round-trip efficiency losses and capital cost',
          },
        ],
      },
      progression: {
        stages: [
          {
            step: 1,
            name: 'Low Penetration (<30%)',
            trigger: 'Adding wind and solar to existing grid',
            state: 'Existing peaker plants handle variability',
            milestone: 'Cost-effective carbon reduction',
          },
          {
            step: 2,
            name: 'Medium Penetration (30-70%)',
            trigger: 'Curtailment and duck curve emergence',
            state: 'Grid flexibility and short-duration storage needed',
            milestone: '4-hour battery fleets deployed',
          },
          {
            step: 3,
            name: 'Deep Decarbonization (>70%)',
            trigger: 'Retiring fossil baseload',
            state: 'Seasonal Dunkelflaute challenges',
            milestone: 'Clean firm power and long-duration storage operating',
          },
        ],
      },
      relationship: {
        nodes: [
          { id: 'renewables', label: 'Intermittent Renewables', group: 'Generation', importance: 3 },
          { id: 'storage', label: 'Storage & Flexibility', group: 'Buffer', importance: 3 },
          { id: 'baseload', label: 'Firm Clean Baseload', group: 'Stability', importance: 3 },
          { id: 'resilience', label: 'Zero-Carbon Reliability', group: 'Outcome', importance: 3 },
        ],
        edges: [
          { from: 'renewables', to: 'storage', label: 'charges', type: 'causes' },
          { from: 'storage', to: 'resilience', label: 'smooths', type: 'regulates' },
          { from: 'baseload', to: 'resilience', label: 'anchors', type: 'contains' },
        ],
      },
      system: {
        inputs: ['Sunlight and wind energy', 'Capital investment', 'Transmission capacity'],
        feedbackLoops: [
          {
            type: 'positive',
            name: 'Clean Tech Learning Curve',
            description:
              'Higher deployment scales manufacturing -> drives down unit costs -> accelerates adoption further.',
          },
        ],
        equilibriumState:
          'Dynamically balanced power grid with zero operational carbon emissions and 99.999% uptime.',
        outputs: ['Affordable zero-carbon electricity', 'Industrial stability', 'Atmospheric preservation'],
      },
    },
  },
  philosophy: {
    id: 'philosophy',
    title: 'Internal Equanimity vs. External Agency',
    concept: 'Stoic dichotomy of control and active virtuous agency in society',
    lenses: {
      competing: {
        topic: 'Internal Equanimity vs. External Agency',
        viewA: {
          title: 'Stoic Internal Equanimity',
          stance: 'Tranquility arises from strictly focusing on the internal locus of control, indifferent to external fate',
          arguments: [
            'Suffering stems from value judgments, not external events',
            'Unconditional emotional resilience under adversity',
            'Immunity to external tyranny and misfortune',
          ],
          advocate: 'Epictetus, Marcus Aurelius, Seneca',
        },
        viewB: {
          title: 'Engaged External Agency',
          stance: 'Moral duty demands actively reshaping the world and resisting injustice regardless of inner calm',
          arguments: [
            'Indifference to externals risks passive complacency',
            'Righteous indignation fuels systemic social progress',
            'Human flourishing requires reforming material institutions',
          ],
          advocate: 'Social reformers and existentialists',
        },
        synthesis:
          'True philosophical maturity uses Stoic tranquility as an emotional fortress that prevents despair, while applying energetic external agency to improve the world.',
      },
      component: {
        columns: ['Stoic Primitive', 'Function', 'Psychological Mechanism', 'Corrupted Distortion'],
        rows: [
          {
            component: 'Dichotomy of Control',
            role: 'Boundary definition',
            mechanism: 'Delineating internal volition from external fortune',
            failureImpact: 'Quietist resignation if externally disengaged',
          },
          {
            component: 'Amor Fati',
            role: 'Psychological acceptance',
            mechanism: 'Embracing necessary adversity as fuel for growth',
            failureImpact: 'Fatalistic submission to preventable suffering',
          },
          {
            component: 'Oikeiōsis',
            role: 'Cosmopolitan connection',
            mechanism: 'Expanding circles of empathy and duty to humanity',
            failureImpact: 'Solipsistic isolation if neglected',
          },
        ],
      },
      progression: {
        stages: [
          {
            step: 1,
            name: 'Initial Adversity',
            trigger: 'External crisis or unexpected obstacle',
            state: 'Initial emotional alarm (propatheiai)',
            milestone: 'Withholding impulsive assent',
          },
          {
            step: 2,
            name: 'Cognitive Reframing',
            trigger: 'Applying dichotomy of control',
            state: 'Separating objective facts from moral interpretation',
            milestone: 'Equanimity restored',
          },
          {
            step: 3,
            name: 'Virtuous Action',
            trigger: 'Duty to common good',
            state: 'Purposeful action free of anxiety',
            milestone: 'Effective external impact with internal peace',
          },
        ],
      },
      relationship: {
        nodes: [
          { id: 'event', label: 'External Event', group: 'Stimulus', importance: 1 },
          { id: 'judgment', label: 'Moral Judgment', group: 'Cognition', importance: 3 },
          { id: 'tranquility', label: 'Inner Tranquility', group: 'State', importance: 3 },
          { id: 'virtue', label: 'Virtuous Action', group: 'Outcome', importance: 3 },
        ],
        edges: [
          { from: 'event', to: 'judgment', label: 'interpreted by', type: 'causes' },
          { from: 'judgment', to: 'tranquility', label: 'determines', type: 'regulates' },
          { from: 'tranquility', to: 'virtue', label: 'empowers', type: 'contains' },
        ],
      },
      system: {
        inputs: ['Life events', 'Passions and impulses', 'Rational reflection'],
        feedbackLoops: [
          {
            type: 'positive',
            name: 'Virtuous Fortitude Loop',
            description:
              'Overcoming adversity with composure builds confidence in the dichotomy of control, making future shocks easier to navigate.',
          },
        ],
        equilibriumState:
          'Ataraxia (untroubled mind) combined with active pro-social duty.',
        outputs: ['Unshakable emotional resilience', 'Clear ethical judgment', 'Meaningful social contribution'],
      },
    },
  },
  economics: {
    id: 'economics',
    title: 'Creative Destruction vs. Transitional Friction',
    concept: 'Schumpeterian dynamic innovation waves and social safety nets',
    lenses: {
      competing: {
        topic: 'Creative Destruction vs. Transitional Friction',
        viewA: {
          title: 'Schumpeterian Creative Destruction',
          stance: 'Incessant technological disruption reallocates capital to higher-productivity ventures, enriching society',
          arguments: [
            'Drives long-term exponential living standard gains',
            'Eradicates obsolete, rent-seeking monopolies',
            'Creates entirely new industries and abundant goods',
          ],
          advocate: 'Joseph Schumpeter & dynamic market theorists',
        },
        viewB: {
          title: 'Transitional Friction & Safety Nets',
          stance: 'Displaced workers suffer acute localized shocks that cannot be ignored in economic calculations',
          arguments: [
            'Human capital is not frictionlessly fungible',
            'Regional economic collapse leads to social decay',
            'Unmitigated disruption generates political backlash',
          ],
          advocate: 'Labor economists & institutionalists',
        },
        synthesis:
          'Sustainable capitalism maximizes creative innovation in product markets while providing robust, portable social safety nets (Nordic flexicurity) for labor transitions.',
      },
      component: {
        columns: ['Economic Dynamic', 'Role', 'Mechanism', 'Failure Risk'],
        rows: [
          {
            component: 'Innovation Wave',
            role: 'Productivity acceleration',
            mechanism: 'Novel technologies outcompete legacy methods',
            failureImpact: 'Stagnant living standards if stifled',
          },
          {
            component: 'Capital Reallocation',
            role: 'Efficiency optimization',
            mechanism: 'Bankruptcies release labor and capital for new firms',
            failureImpact: 'Zombie firms draining public subsidies',
          },
          {
            component: 'Flexicurity & Retraining',
            role: 'Social shock absorber',
            mechanism: 'Wage insurance, portable benefits, and active labor training',
            failureImpact: 'Social fracturing, populism, and permanent scarring',
          },
        ],
      },
      progression: {
        stages: [
          {
            step: 1,
            name: 'Breakthrough Innovation',
            trigger: 'Technological leap (e.g., AI, electricity, steam)',
            state: 'Incumbents dismiss, startups scale rapidly',
            milestone: 'Productivity frontier expands',
          },
          {
            step: 2,
            name: 'Disruption & Displacement',
            trigger: 'Mass adoption of superior technology',
            state: 'Legacy business models collapse, worker displacement',
            milestone: 'Transitional friction peak',
          },
          {
            step: 3,
            name: 'Dynamic Re-equilibrium',
            trigger: 'Resource reallocation and upskilling',
            state: 'New industries absorb workforce with higher real wages',
            milestone: 'Higher aggregate living standards achieved',
          },
        ],
      },
      relationship: {
        nodes: [
          { id: 'innovation', label: 'Disruptive Innovation', group: 'Catalyst', importance: 3 },
          { id: 'displacement', label: 'Labor Displacement', group: 'Friction', importance: 2 },
          { id: 'safety_net', label: 'Flexicurity Support', group: 'Buffer', importance: 3 },
          { id: 'prosperity', label: 'Aggregate Prosperity', group: 'Outcome', importance: 3 },
        ],
        edges: [
          { from: 'innovation', to: 'displacement', label: 'causes', type: 'causes' },
          { from: 'displacement', to: 'safety_net', label: 'cushioned by', type: 'regulates' },
          { from: 'safety_net', to: 'prosperity', label: 'sustains', type: 'contains' },
        ],
      },
      system: {
        inputs: ['R&D investment', 'Entrepreneurial talent', 'Flexible labor markets'],
        feedbackLoops: [
          {
            type: 'positive',
            name: 'Productivity Dividend Loop',
            description:
              'Higher productivity lowers consumer costs -> expands disposable income -> fuels investment into next generation of research.',
          },
        ],
        equilibriumState:
          'Dynamic ongoing innovation alongside resilient social buffers that protect individuals rather than obsolete jobs.',
        outputs: ['Higher living standards', 'Accelerated technological capability', 'Stable social contract'],
      },
    },
  },
}

export default function ThoughtRefractorView({ course }: ThoughtRefractorViewProps) {
  const courseTopics = useMemo(() => course.refractorTopics || [], [course.refractorTopics])
  const hasCourseTopics = courseTopics.length > 0
  const initialTopic: RefractorTopic = hasCourseTopics
    ? courseTopics[0]
    : BUILTIN_REFRACTOR_TOPICS.thought_refractor

  const [selectedTopicId, setSelectedTopicId] = useState<string>(initialTopic.id)
  const [sourceText, setSourceText] = useState<string>(
    hasCourseTopics
      ? courseTopics[0].concept || EXAMPLE_TOPICS[0].sourceText
      : EXAMPLE_TOPICS[0].sourceText,
  )
  const [hasGenerated, setHasGenerated] = useState<boolean>(true)
  const [isGenerating, setIsGenerating] = useState<boolean>(false)
  const [customTopic, setCustomTopic] = useState<RefractorTopic | null>(null)

  // Current active topic resolved from custom generated topic, course topics, or built-in examples
  const currentTopic: RefractorTopic = useMemo(() => {
    if (customTopic) return customTopic
    const fromCourse = courseTopics.find((t) => t.id === selectedTopicId)
    if (fromCourse) return fromCourse
    const fromBuiltin = BUILTIN_REFRACTOR_TOPICS[selectedTopicId as ExampleKey]
    if (fromBuiltin) return fromBuiltin
    return initialTopic
  }, [customTopic, selectedTopicId, courseTopics, initialTopic])

  const handleSelectCourseTopic = (topic: RefractorTopic) => {
    setCustomTopic(null)
    setSelectedTopicId(topic.id)
    setSourceText(
      topic.concept ||
        `An in-depth conceptual exploration of ${topic.title}. This passage synthesizes fundamental axioms, structural mechanisms, and dynamic trade-offs.`,
    )
    setHasGenerated(true)
  }

  const handleSelectExample = (ex: (typeof EXAMPLE_TOPICS)[0]) => {
    setCustomTopic(null)
    setSelectedTopicId(ex.id)
    setSourceText(ex.sourceText)
    setHasGenerated(true)
  }

  const handleGenerate = () => {
    setIsGenerating(true)
    setTimeout(() => {
      // If user typed custom text differing from current topic concept/sourceText, synthesize a custom RefractorTopic
      const trimmed = sourceText.trim()
      const firstLine = trimmed.split('\n')[0].replace(/^[#*-\s]+/, '').slice(0, 60)
      const topicName = firstLine || 'Custom Text Reading'

      const synthesized: RefractorTopic = {
        id: `custom-${Date.now()}`,
        title: topicName,
        concept: trimmed.slice(0, 160),
        lenses: {
          competing: {
            topic: topicName,
            viewA: {
              title: 'Primary Direct Thesis',
              stance: `Explicit claims and direct propositions asserting ${topicName.toLowerCase()}`,
              arguments: [
                'Articulates the central intended thesis clearly',
                'Optimizes for actionable clarity and direct execution',
                'Focuses on immediate first-order effects',
              ],
              advocate: 'Original author / Proponent',
            },
            viewB: {
              title: 'Underlying Systemic Tradeoffs',
              stance: 'Hidden dependencies, opportunity costs, and counter-vailing forces',
              arguments: [
                'Exposes implicit friction points and hidden assumptions',
                'Accounts for second-order systemic side effects',
                'Highlights boundary conditions where the thesis fails',
              ],
              advocate: 'Critical analyst / System thinker',
            },
            synthesis: `The true cognitive model requires balancing the direct leverage of "${topicName}" with its systemic boundary constraints.`,
          },
          component: {
            columns: ['Dimension', 'Primary Role', 'Mechanism', 'Failure Impact'],
            rows: [
              {
                component: 'Foundational Axiom',
                role: 'Core assumption',
                mechanism: 'Direct premises asserted in the passage',
                failureImpact: 'Superficial understanding if unexamined',
              },
              {
                component: 'Operational Mechanism',
                role: 'Execution engine',
                mechanism: 'Procedures and practical applications described',
                failureImpact: 'Implementation stalls without clear feedback',
              },
              {
                component: 'Boundary Threshold',
                role: 'Constraint check',
                mechanism: 'Limits where the argument ceases to hold',
                failureImpact: 'Overconfidence in unsuitable contexts',
              },
            ],
          },
          progression: {
            stages: [
              {
                step: 1,
                name: 'Passage Ingestion',
                trigger: 'Reading source text',
                state: 'Initial linear prose reception',
                milestone: 'Core thesis identified',
              },
              {
                step: 2,
                name: 'Structural Extraction',
                trigger: 'Refractor multi-lens engine',
                state: 'Deconstructing implicit relationships',
                milestone: 'Parallel models rendered',
              },
              {
                step: 3,
                name: 'Synthesis & Fluency',
                trigger: 'Reader cross-checks lenses',
                state: 'Durable mental chunk integrated',
                milestone: 'Mental model applied to novel problems',
              },
            ],
          },
          relationship: {
            nodes: [
              { id: 'premise', label: 'Core Premise', group: 'Axiom', importance: 3 },
              { id: 'mechanism', label: 'Mechanism', group: 'Process', importance: 3 },
              { id: 'tradeoff', label: 'Tradeoff Space', group: 'Constraint', importance: 3 },
              { id: 'insight', label: 'Actionable Insight', group: 'Outcome', importance: 3 },
            ],
            edges: [
              { from: 'premise', to: 'mechanism', label: 'drives', type: 'causes' },
              { from: 'mechanism', to: 'tradeoff', label: 'produces', type: 'regulates' },
              { from: 'tradeoff', to: 'insight', label: 'crystallizes', type: 'contains' },
            ],
          },
          system: {
            inputs: ['Source argument text', 'Domain context', 'Reader inquiry'],
            feedbackLoops: [
              {
                type: 'positive',
                name: 'Comprehension Compounding',
                description:
                  'Clarifying the underlying trade-offs reveals deeper insights upon re-reading the text.',
              },
            ],
            equilibriumState:
              'Dynamic equilibrium between explicit claim and implicit systemic reality.',
            outputs: ['Deepened understanding', 'Actionable mental model', 'Critical blind spots illuminated'],
          },
        },
      }

      setCustomTopic(synthesized)
      setIsGenerating(false)
      setHasGenerated(true)
    }, 350)
  }

  const handleReset = () => {
    setCustomTopic(null)
    setSelectedTopicId(initialTopic.id)
    setSourceText(
      hasCourseTopics
        ? courseTopics[0].concept || EXAMPLE_TOPICS[0].sourceText
        : EXAMPLE_TOPICS[0].sourceText,
    )
    setHasGenerated(true)
  }

  return (
    <div className="w-full max-w-7xl mx-auto py-2 font-sans select-none animate-in fade-in duration-200">
      {/* 2-Column Responsive Layout matching thought_refractor_desktop.png & thought_refractor_diagrams.png */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Form & Controls */}
        <div className="lg:col-span-5 space-y-6">
          {/* Header Brand */}
          <div className="flex items-center gap-2">
            <img src="/star.svg" alt="Wondering" className="size-5 shrink-0 select-none" />
            <span className="font-serif font-bold text-stone-900 dark:text-stone-100 text-base">
              Thought Refractor
            </span>
          </div>

          {/* Title & Subtitle */}
          <div>
            <h1 className="text-2xl sm:text-3xl font-serif font-bold text-stone-900 dark:text-stone-100 tracking-tight leading-snug">
              See the same text through several visual lenses.
            </h1>
            <p className="mt-2 text-xs sm:text-sm text-stone-600 dark:text-stone-400 leading-relaxed">
              Paste any argument or explanation and get an interactive, multi-perspective reading.
            </p>
          </div>

          {/* Course Topics Section (if course has refractorTopics) */}
          {hasCourseTopics && (
            <div>
              <div className="text-[10px] font-mono font-bold tracking-widest text-sky-600 dark:text-sky-400 uppercase mb-2 flex items-center gap-1.5">
                <Layers className="size-3" />
                <span>THIS COURSE: {course.title.toUpperCase()}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {courseTopics.map((topic) => {
                  const isActive = !customTopic && selectedTopicId === topic.id
                  return (
                    <button
                      key={topic.id}
                      type="button"
                      onClick={() => handleSelectCourseTopic(topic)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold tracking-wider transition-all cursor-pointer ${
                        isActive
                          ? 'bg-[#3EA594] text-white shadow-[0_2px_0_0_#2A7C6E] hover:brightness-105'
                          : 'bg-[#FFFDF8] dark:bg-[#1C1411] border border-[#E5E0D4] dark:border-stone-800 text-stone-700 dark:text-stone-300 shadow-2xs hover:bg-stone-100 dark:hover:bg-stone-800'
                      }`}
                    >
                      {topic.title.length > 28 ? `${topic.title.slice(0, 26)}…` : topic.title}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Built-in Examples Pills */}
          <div>
            <div className="text-[10px] font-mono font-bold tracking-widest text-stone-400 uppercase mb-2">
              EXAMPLES
            </div>
            <div className="flex flex-wrap gap-2">
              {EXAMPLE_TOPICS.map((ex) => {
                const isActive = !customTopic && selectedTopicId === ex.id
                return (
                  <button
                    key={ex.id}
                    type="button"
                    onClick={() => handleSelectExample(ex)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold tracking-wider transition-all cursor-pointer ${
                      isActive
                        ? 'bg-[#3EA594] text-white shadow-[0_2px_0_0_#2A7C6E] hover:brightness-105'
                        : 'bg-[#FFFDF8] dark:bg-[#1C1411] border border-[#E5E0D4] dark:border-stone-800 text-stone-700 dark:text-stone-300 shadow-2xs hover:bg-stone-100 dark:hover:bg-stone-800'
                    }`}
                  >
                    {ex.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Source Text Input */}
          <div className="space-y-1.5">
            <label className="block text-xs sm:text-sm font-medium text-stone-700 dark:text-stone-300">
              Source text
            </label>
            <div className="relative">
              <textarea
                value={sourceText}
                onChange={(e) => setSourceText(e.target.value)}
                rows={11}
                className="w-full rounded-2xl border border-[#E5E0D4] dark:border-stone-800 bg-[#FFFDF8] dark:bg-[#1C1411] p-4 text-xs sm:text-sm text-stone-800 dark:text-stone-200 leading-relaxed outline-none focus:border-sky-400 transition-colors resize-y shadow-2xs"
                placeholder="Paste any argument or conceptual passage here..."
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-stone-400 dark:text-stone-500 pt-0.5">
              <span>Designed for one dense passage, not a whole book.</span>
              <span className="font-mono">{sourceText.length} characters</span>
            </div>
          </div>

          {/* Action Buttons (1:1 with thought_refractor_desktop.png) */}
          <div className="flex items-center gap-3 pt-1">
            <button
              type="button"
              onClick={handleGenerate}
              disabled={isGenerating || !sourceText.trim()}
              className="flex-1 py-3.5 px-6 rounded-xl bg-[#59B2E6] hover:bg-[#4EA5D9] text-[#261312] font-mono font-bold text-xs uppercase tracking-wider shadow-[0_4px_0_0_#2B8FD0] active:translate-y-1 active:shadow-none transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <Play className="size-3.5 fill-[#261312]" />
              <span>{isGenerating ? 'ANALYZING...' : 'GENERATE READING'}</span>
            </button>

            <button
              type="button"
              onClick={handleReset}
              className="py-3.5 px-6 rounded-xl bg-[#FFFDF8] dark:bg-[#1C1411] border border-[#E5E0D4] dark:border-stone-800 text-stone-700 dark:text-stone-300 font-mono font-bold text-xs uppercase tracking-wider shadow-[0_3px_0_0_#DCD6CA] dark:shadow-[0_3px_0_0_#292524] hover:bg-white dark:hover:bg-stone-800 active:translate-y-1 active:shadow-none transition-all cursor-pointer flex items-center gap-1.5"
            >
              <RotateCcw className="size-3.5" />
              <span>RESET</span>
            </button>
          </div>
        </div>

        {/* Right Column: Visual Lenses Breakdown */}
        <div className="lg:col-span-7 space-y-10 lg:pl-4 overflow-y-auto max-h-[calc(100vh-10rem)] pr-2">
          {hasGenerated && currentTopic && (
            <div className="space-y-10 animate-in fade-in duration-200">
              {/* LENS 1: Two Competing Readings (1:1 with thought_refractor_diagrams.png) */}
              <section className="space-y-3">
                <div>
                  <h2 className="text-lg sm:text-xl font-serif font-bold text-stone-900 dark:text-stone-100">
                    Lens 1: two competing readings
                  </h2>
                  <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-400 mt-1">
                    The same passage can usually be read as a direct claim and as a deeper system of tradeoffs.
                  </p>
                  <div className="text-xs font-mono text-stone-500 dark:text-stone-400 mt-2">
                    {currentTopic.lenses.competing.topic || currentTopic.title}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Card 1: View A */}
                  <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-[#FFFDF8] dark:bg-[#1C1411] p-5 shadow-2xs space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-serif font-bold text-sm sm:text-base text-stone-900 dark:text-stone-100">
                        {currentTopic.lenses.competing.viewA.title}
                      </h3>
                      {currentTopic.lenses.competing.viewA.advocate && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-stone-100 dark:bg-stone-800 text-stone-500 shrink-0">
                          {currentTopic.lenses.competing.viewA.advocate}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-stone-600 dark:text-stone-400 italic">
                      &quot;{currentTopic.lenses.competing.viewA.stance}&quot;
                    </p>
                    <ul className="space-y-2 text-xs sm:text-sm text-stone-600 dark:text-stone-400">
                      {currentTopic.lenses.competing.viewA.arguments.map((arg, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-stone-400">•</span>
                          <span>{arg}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Card 2: View B */}
                  <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-[#FFFDF8] dark:bg-[#1C1411] p-5 shadow-2xs space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-serif font-bold text-sm sm:text-base text-stone-900 dark:text-stone-100">
                        {currentTopic.lenses.competing.viewB.title}
                      </h3>
                      {currentTopic.lenses.competing.viewB.advocate && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-stone-100 dark:bg-stone-800 text-stone-500 shrink-0">
                          {currentTopic.lenses.competing.viewB.advocate}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-stone-600 dark:text-stone-400 italic">
                      &quot;{currentTopic.lenses.competing.viewB.stance}&quot;
                    </p>
                    <ul className="space-y-2 text-xs sm:text-sm text-stone-600 dark:text-stone-400">
                      {currentTopic.lenses.competing.viewB.arguments.map((arg, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-stone-400">•</span>
                          <span>{arg}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Synthesis Callout */}
                {currentTopic.lenses.competing.synthesis && (
                  <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-stone-800 dark:text-stone-200 text-xs sm:text-sm flex items-start gap-3">
                    <Sparkles className="size-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-amber-900 dark:text-amber-200 block mb-0.5 font-mono text-xs uppercase tracking-wider">
                        Dialectical Synthesis
                      </span>
                      <p className="leading-relaxed text-stone-700 dark:text-stone-300">
                        {currentTopic.lenses.competing.synthesis}
                      </p>
                    </div>
                  </div>
                )}
              </section>

              {/* LENS 2: Component Table (1:1 with thought_refractor_diagrams.png) */}
              <section className="space-y-3 pt-4 border-t border-stone-200/60 dark:border-stone-800/60">
                <div>
                  <h2 className="text-lg sm:text-xl font-serif font-bold text-stone-900 dark:text-stone-100">
                    Lens 2: component table
                  </h2>
                  <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-400 mt-1">
                    A compact table forces the passage into explicit slots so hidden structure stops blending together.
                  </p>
                  <div className="text-xs font-mono text-stone-500 dark:text-stone-400 mt-2">
                    {currentTopic.title} Matrix
                  </div>
                </div>

                <div className="overflow-x-auto rounded-2xl border border-stone-200 dark:border-stone-800 bg-[#FFFDF8] dark:bg-[#1C1411] shadow-2xs">
                  <table className="w-full text-left border-collapse text-xs sm:text-sm">
                    <thead>
                      <tr className="bg-stone-100/70 dark:bg-stone-800/50 border-b border-stone-200 dark:border-stone-800 text-stone-700 dark:text-stone-300 font-semibold">
                        {(currentTopic.lenses.component.columns && currentTopic.lenses.component.columns.length > 0
                          ? currentTopic.lenses.component.columns
                          : ['Component', 'Primary Role', 'Mechanism', 'Failure Impact']
                        ).map((col, idx) => (
                          <th key={idx} className="p-3">
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-200/80 dark:divide-stone-800 font-sans">
                      {currentTopic.lenses.component.rows.map((row, idx) => (
                        <tr key={idx} className="hover:bg-stone-50 dark:hover:bg-stone-800/30">
                          <td className="p-3 font-semibold text-stone-900 dark:text-stone-100">
                            {row.component}
                          </td>
                          <td className="p-3 text-stone-600 dark:text-stone-300">
                            {row.role}
                          </td>
                          <td className="p-3 text-stone-600 dark:text-stone-300">
                            {row.mechanism}
                          </td>
                          <td className="p-3 text-stone-500 dark:text-stone-400">
                            {row.failureImpact}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* LENS 3: Progression Flow */}
              <section className="space-y-3 pt-4 border-t border-stone-200/60 dark:border-stone-800/60">
                <div>
                  <h2 className="text-lg sm:text-xl font-serif font-bold text-stone-900 dark:text-stone-100">
                    Lens 3: progression flow
                  </h2>
                  <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-400 mt-1">
                    Temporal milestones and operational triggers showing how the system evolves over time.
                  </p>
                </div>

                <div className="relative border-l-2 border-stone-300 dark:border-stone-700 ml-4 space-y-6 py-2">
                  {currentTopic.lenses.progression.stages.map((stage) => (
                    <div key={stage.step} className="relative pl-6">
                      <div className="absolute -left-[13px] top-0 size-6 rounded-full bg-[#59B2E6] text-[#261312] font-mono font-bold text-xs flex items-center justify-center shadow-2xs">
                        {stage.step}
                      </div>

                      <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-[#FFFDF8] dark:bg-[#1C1411] p-4 shadow-2xs space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="font-semibold text-xs sm:text-sm text-stone-900 dark:text-stone-100">
                            {stage.name}
                          </h4>
                          <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400">
                            Trigger: {stage.trigger}
                          </span>
                        </div>
                        <p className="text-xs text-stone-600 dark:text-stone-400">
                          {stage.state}
                        </p>
                        <div className="pt-1.5 flex items-center gap-1 text-[11px] font-medium text-sky-700 dark:text-sky-400">
                          <TrendingUp size={12} />
                          <span>Milestone: {stage.milestone}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* LENS 4: Relationship Network */}
              <section className="space-y-3 pt-4 border-t border-stone-200/60 dark:border-stone-800/60">
                <div>
                  <h2 className="text-lg sm:text-xl font-serif font-bold text-stone-900 dark:text-stone-100">
                    Lens 4: relationship network
                  </h2>
                  <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-400 mt-1">
                    Causal dependencies and conceptual bridges tying the core constructs together.
                  </p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {currentTopic.lenses.relationship.nodes.map((node) => (
                    <div
                      key={node.id}
                      className="p-3 rounded-xl border border-stone-200 dark:border-stone-800 bg-[#FFFDF8] dark:bg-[#1C1411] text-center shadow-2xs"
                    >
                      <span className="text-[10px] font-mono text-stone-400 uppercase">
                        {node.group}
                      </span>
                      <div className="text-xs sm:text-sm font-bold text-stone-900 dark:text-stone-100 mt-0.5">
                        {node.label}
                      </div>
                      <div className="flex justify-center gap-0.5 mt-1 text-amber-500 text-xs">
                        {Array.from({ length: node.importance }).map((_, i) => (
                          <span key={i}>★</span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="space-y-2 pt-2">
                  {currentTopic.lenses.relationship.edges.map((edge, i) => {
                    const fromNode = currentTopic.lenses.relationship.nodes.find((n) => n.id === edge.from)
                    const toNode = currentTopic.lenses.relationship.nodes.find((n) => n.id === edge.to)
                    return (
                      <div
                        key={i}
                        className="p-2.5 rounded-xl bg-stone-100/70 dark:bg-stone-800/50 border border-stone-200 dark:border-stone-700 flex items-center justify-between gap-2 text-xs"
                      >
                        <span className="font-semibold text-stone-900 dark:text-stone-100">
                          {fromNode?.label || edge.from}
                        </span>
                        <div className="flex items-center gap-1 text-[11px] text-sky-700 dark:text-sky-300 font-mono">
                          <span>{edge.label}</span>
                          <ArrowRight size={12} />
                        </div>
                        <span className="font-semibold text-stone-900 dark:text-stone-100">
                          {toNode?.label || edge.to}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </section>

              {/* LENS 5: System Dynamics */}
              <section className="space-y-3 pt-4 border-t border-stone-200/60 dark:border-stone-800/60">
                <div>
                  <h2 className="text-lg sm:text-xl font-serif font-bold text-stone-900 dark:text-stone-100">
                    Lens 5: system dynamics
                  </h2>
                  <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-400 mt-1">
                    Feedback loops, inputs, outputs, and steady-state equilibrium.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="p-3.5 rounded-xl border border-stone-200 dark:border-stone-800 bg-[#FFFDF8] dark:bg-[#1C1411]">
                    <span className="text-[10px] font-mono font-bold uppercase text-stone-400 block mb-1.5">
                      INPUTS
                    </span>
                    <ul className="space-y-1 text-xs text-stone-600 dark:text-stone-300">
                      {currentTopic.lenses.system.inputs.map((inp, i) => (
                        <li key={i} className="flex items-start gap-1">
                          <span className="text-sky-500">▹</span>
                          <span>{inp}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="p-3.5 rounded-xl border border-stone-200 dark:border-stone-800 bg-[#FFFDF8] dark:bg-[#1C1411]">
                    <span className="text-[10px] font-mono font-bold uppercase text-sky-600 dark:text-sky-400 block mb-1.5">
                      FEEDBACK LOOPS
                    </span>
                    <div className="space-y-2">
                      {currentTopic.lenses.system.feedbackLoops.map((fb, i) => (
                        <div key={i} className="text-xs">
                          <div className="font-semibold text-stone-900 dark:text-stone-100">
                            {fb.name}
                          </div>
                          <p className="text-[11px] text-stone-500">{fb.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl border border-stone-200 dark:border-stone-800 bg-[#FFFDF8] dark:bg-[#1C1411]">
                    <span className="text-[10px] font-mono font-bold uppercase text-stone-400 block mb-1.5">
                      OUTPUTS
                    </span>
                    <ul className="space-y-1 text-xs text-stone-600 dark:text-stone-300">
                      {currentTopic.lenses.system.outputs.map((out, i) => (
                        <li key={i} className="flex items-start gap-1">
                          <span className="text-emerald-500">▹</span>
                          <span>{out}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-stone-200 dark:border-stone-800 bg-[#FFFDF8] dark:bg-[#1C1411] flex items-start gap-3">
                  <AlertCircle size={18} className="text-sky-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-xs font-bold text-stone-900 dark:text-stone-100">
                      Dynamic Equilibrium
                    </span>
                    <p className="text-xs text-stone-600 dark:text-stone-400 mt-0.5 leading-relaxed">
                      {currentTopic.lenses.system.equilibriumState}
                    </p>
                  </div>
                </div>
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
