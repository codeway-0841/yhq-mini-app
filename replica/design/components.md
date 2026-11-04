# Brilliant.org Rebuilt Component Specifications

Design specifications for KIVVI UI components rebuilt according to Brilliant.org product DNA and design system rules.

---

### Button (Tactile 3D Action Button)
* **variants:** primary (tactile brand), secondary (white card with border), success (check answer), ghost, outline
* **sizes:** sm 34px, md 44px, lg 52px, icon 44x44px, pill 44px
* **states:** default (3px bottom bevel), hover (light lift -translate-y-0.5), active (translate-y-0.5, bevel compresses), focus-visible (2px ring, accent), disabled (opacity 40%, no pointer events), loading (inline spinner, label preserved)
* **tokens:** 
  * primary: bg accent, text on-accent, shadow tactile-primary, radius pill/md, font sm/600
  * success: bg success, text on-accent, shadow tactile-success, radius pill/md, font sm/600
  * secondary: bg card, text text, border border, shadow tactile, radius pill/md
* **a11y:** Native `<button>`, `aria-busy` during loading, high-contrast focus ring with offset.
* **used on:** Home hero continue card, lesson test check answer, quiz modals, top bar actions.

---

### Card (Brilliant Surface Container)
* **variants:** standard (flat raised), interactive (tappable card), selected (learning choice card)
* **sizes:** auto width, padding 16px (mobile) to 24px (desktop)
* **states:** default (bg card, 1px border), hover (interactive: border border-strong, slight lift), active (scale 0.99), selected (border-2 border-accent, bg wash)
* **tokens:** bg card, border border, radius lg (20px) / container (22px), shadow card
* **a11y:** `role="region"` or `article`, interactive cards receive `role="button"` or `tabindex="0"`, keyboard Enter/Space trigger.
* **used on:** JumpBackInCard, TopicCard, ProgressCard, TodayGoalCard.

---

### Mathematical Canvas Grid (Background Layer)
* **variants:** light (warm off-white #f5f3f1 with 1.2px radial dots), dark (#111215 with 1.2px subtle radial dots)
* **spacing:** 24px grid repeat
* **tokens:** bg bg, dot-color grid-dot
* **a11y:** Purely decorative (`aria-hidden="true"` or background property), does not distract from text legibility.
* **used on:** Dashboard background, Topics explore page, Lesson canvas.

---

### SegmentedProgressBar (Step Progress Indicator)
* **variants:** continuous (smooth fluid bar), segmented (discrete lesson steps 1..N)
* **sizes:** height 8px (standard), height 12px (prominent)
* **states:** empty (bg border/line), active segment (pulsing or accent fill), completed segment (bg success / brand-green)
* **tokens:** height 8px, radius pill, bg line, fill success/accent
* **a11y:** `role="progressbar"`, `aria-valuenow`, `aria-valuemin="0"`, `aria-valuemax="100"`.
* **used on:** Active lesson header, course progress, daily habit streak.

---

### TopBar Navigation (Header with Gamification Counters)
* **variants:** mobile (sticky with safe-area), desktop (wide banner)
* **elements:** Brand Logo, Streak Counter Pill (🔥 with numeric count), Gems / League Counter, Search / Profile avatar
* **states:** default (glass backdrop blur with canvas background), scrolled (subtle 1px bottom divider)
* **tokens:** height 48px–56px, bg canvas / glass, text text, pill bg card, border border
* **a11y:** `<header>` landmark, accessible labels for streak ("X kunlik seriya"), keyboard navigable.
* **used on:** Global shell, Dashboard, Courses.

---

### ChoiceCard (Interactive Quiz / Test Option Tile)
* **variants:** single-select, multi-select, binary (true/false)
* **states:** default (bg card, border 1.5px border), hover (border border-strong), selected (border-accent, bg wash, tactile bottom lip), correct (border-success, bg success/10), incorrect (border-danger, bg danger/10)
* **tokens:** radius md/lg, padding 16px, text text, font base/500
* **a11y:** `role="radio"` or `role="checkbox"`, `aria-checked`, keyboard arrow navigation.
* **used on:** Test sessions, interactive quiz questions, diagnostic assessment.
