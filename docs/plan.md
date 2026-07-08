# Unchain — Mobile App Plan

**A recovery companion for people breaking free from compulsive habits.**
React Native (Expo) · Clean Architecture · local-first · shame-free by design.

> **What this file is.** The single source of truth for building the Unchain mobile app: brand, design system, screen specs, and technical architecture. It sits alongside the two research documents in this folder:
> - `Unchain_Product_Research_and_Design_Documentation-1.docx` — the *why* (behavioral science, UX doctrine, personas).
> - `Unchain_PH_Market_Launch_Plan.docx` — the *go-to-market* (the Tarsi-inspired Philippine launch).
>
> Where this plan and the research disagree, **this plan wins for build decisions** — because two research assumptions were deliberately changed by the team (see box below). Everything else in the research still holds and is treated as binding.

---

## 0. Two decisions that override the research (read first)

The research documentation was written for a **mascot-free, native-iOS-SwiftUI** product with a **teal/indigo** palette. We are shipping something different on purpose. Both changes are intentional, and both are handled carefully so we keep the research's protections.

| Research said | We are doing | How we keep the research's intent |
|---|---|---|
| **"No mascot"** — a cartoon face can be used to guilt-trip users (the Duolingo-owl mechanic the research bans). | Ship the **sheep mascot** as the app's emotional heart and living progress artifact. | The mascot **never shames, never guilt-trips, never appears disappointed, and is never used to drive re-engagement.** It reflects *the user's* state back with compassion; it is not a taskmaster. Rules are codified in §3.4. This is the hard line that lets us have a mascot without becoming what we oppose. |
| **iOS-only, SwiftUI/SF Pro.** | **React Native via Expo** (iOS first, Android later with far less rework). | Expo gives us one codebase, fast iteration for a small team, and an easy Android path — which the launch plan explicitly wants to capture on the waitlist. Native-only capabilities (Screen Time, HealthKit, Live Activities, Watch) are handled through config plugins / native modules and **phased realistically** in §9. We do not pretend Expo makes them free. |

The palette is therefore **derived from the mascot art in `/assets`, not from the research's Dawn Teal.** See §4.1 — every colour was sampled from the actual sheep and every contrast ratio below was computed, not guessed.

Everything else — the Shame-Free Charter, the 3-Second Lifeline, Recovery Strength instead of resettable streaks, ethical monetization, WCAG AA — is **inherited unchanged.**

---

## 1. Product in one page

**Unchain** helps anyone quit or cut back on a compulsive behavior — vaping, smoking, online gambling (*sugal*), alcohol, pornography, social media, gaming, shopping, or a custom habit. Unlike single-habit trackers, Unchain treats recovery as one shared problem: the same craving loop underneath, the same tools on top.

Three ideas carry the whole product:

1. **The craving moment is the product.** Every competitor is built around a streak counter. Unchain is built around the 90–180 seconds when a user is actively fighting an urge — a full-screen **SOS flow** reachable in one tap from anywhere.
2. **Shame is what makes people quit the app.** A relapse must never reset progress to zero. Unchain uses **Recovery Strength** (0–100) that dips gently and rebuilds — lifetime effort is permanent.
3. **The sheep makes it human.** A soft, wordless companion that celebrates quietly, sits with you when it's hard, and helps break the chain link by link. It is the emotional layer the whole category is missing.

**The one-line positioning** (from the launch plan): *For Filipinos who want to quit or cut back but relapse when cravings hit, Unchain intervenes at the craving moment and tracks progress without shame — unlike trackers that punish a slip with a reset to zero. Built in the Philippines by DotOrbit.*

**Launch inspiration.** We follow the **Tarsi by Bryl Lim** playbook (see launch plan §2.2): a Philippines-first, build-in-public, zero-paid-ads launch that turns each milestone into content. The app is built to *feed that engine* — milestone moments are screenshot-worthy by design, aggregate outcomes (urges ridden out, pesos saved) are surfaceable as anonymized launch stats, and the mascot gives the story a face that travels on TikTok.

---

## 2. The user we are building for

Five personas from the research, compressed to what changes the build. Full detail in the research doc §3.

| Persona | Habit | The one thing the app must nail for them |
|---|---|---|
| **Dana**, 27 — vape | Vaping | Polish + a live money-saved counter in pesos; afternoon (3–5pm) craving window. Abandons ugly apps in minutes. |
| **Robert**, 41 — alcohol | Alcohol | **The shame-free relapse flow is his retention feature.** Deleted competitor apps twice after resets. Needs a discreet icon and large text; 9–11pm danger window. |
| **Sam**, 19 — porn | Pornography | **Absolute privacy** — Face ID lock, local-first, no real identity anywhere. Price-sensitive student; 12–2am SOS. The free tier must genuinely work. |
| **Olivia**, 34 — social media | Social media | **"Reduce" goal, not "quit."** 30-second one-handed interactions (baby in the other arm). Skeptical of gimmicks. |
| **Hakim**, 48 — gambling | Online gambling | **Money-not-lost as the hero metric**; block-first; big tap targets, plain language. The launch plan's most newsworthy segment. |

**Cross-persona requirements that shape architecture:** shame-free relapse handling · 1-tap SOS from anywhere · privacy (Face ID + local-first) · money-saved engine · quit-vs-reduce goal types · blocking tools · low-cognitive-load 4-tab IA.

---

## 3. Brand & Mascot

### 3.1 The sheep

The assets in `/assets` show a **lamb breaking free of chains** — the literal meaning of *Unchain*. A sheep that was bound and is now getting loose. It is soft, small, and brave: exactly the tone the research asks for ("the steady friend who's been there — calm, honest, quietly strong, warm without saccharine").

**Name: "Maria."** Warm, familiar, unmistakably Filipino — a companion with a real name, not a cartoon. The lamb you're rooting for.

> **Asset housekeeping (do this before design lock):** `/assets` currently has **two different sheep designs** — `mascot 1 - *` (rounder, deep-purple hooves) and `mascot 2 - happy` (fluffier body). **Pick one and draw all states from it** for visual consistency. This plan assumes the **`mascot 1`** design as canonical because it has the fullest emotional range and the clearest chain motif. `mascot 2` becomes an alternate celebratory pose or is retired.

### 3.2 Mascot state map (which asset means what)

The mascot has a small, deliberate emotional vocabulary. It mirrors the *user's* state — never judges it.

| State | Asset | When it appears | Never used for |
|---|---|---|---|
| **Happy / idle** | `mascot 1 - happy.png` | Home dashboard default; check-in complete; steady days. | — |
| **Celebrating** | `mascot 2 - happy.png` (jumping pose) | Milestone screens, chain-link forged. Full-screen, ≤2.5s, once. | Everyday nagging. |
| **Comfort / low** | `mascot 1 - crying.png` | Relapse flow **Screen 1 only**, and only briefly, as *"I'm here with you"* — sitting beside the user, wiping its own tears, **not crying at the user.** | Guilt. Not shown on the dashboard. Never paired with "you failed" copy. |
| **Braced / with-you** | `mascot 1 -angry.png` | Inside SOS as the "we fight this urge together" energy — the sheep squares up **at the craving, never at the user.** | Anger directed at the person. |
| **App icon** | `icon logo png.png` / `icon.jpg` | Store icon, splash. The sheep head snapping a chain. | — |

### 3.3 Reconciling the chain and the sheep

The research's living progress artifact was **the chain** (links forged/weakened/broken). We keep it — but now **the sheep breaks the chain.** Milestones = the sheep pulling a chain link apart. Recovery Strength high = chains loosening; a lapse = a link tightens slightly (never re-locks fully; the research's "progress is unbreakable" law holds). The two motifs become one story: *the lamb getting free.*

### 3.4 Mascot ethics — the hard rules (non-negotiable)

These exist because the research warned that a mascot is exactly how habit apps manipulate people. We opt in to the mascot **only** under these constraints:

1. **The sheep never expresses disappointment.** It has no "sad because *you* let me down" face. Its sad state is *empathy*, shown beside the user, gone by the next screen.
2. **The sheep never drives re-engagement.** No "Maria misses you 😢" notifications. Guilt-based re-engagement is banned (research §14, launch plan §5.2).
3. **The sheep never sells.** It never appears on a paywall to pressure an upgrade.
4. **The sheep is skippable.** A "minimal mascot" setting reduces it to a small static logo for Robert/Hakim-type users who want gravity over cuteness, and for discreet public use.
5. **The sheep celebrates effort and honesty, not just outcomes** — including celebrating an honestly-logged lapse (counter-programming shame).

---

## 4. Design System — "Wool & Chain"

A calm, warm, premium system. Muted and low-arousal per the research (stressed users need the UI to *lower* arousal), but built from the sheep's own colours instead of clinical teal.

### 4.1 Colour palette (sampled from `/assets`, contrast verified)

Every hex below was sampled from the mascot art; every ratio was computed against sRGB WCAG 2.2 math. **AA text = 4.5:1, AA large/UI = 3:1, AAA = 7:1.**

#### Brand & text — Light theme

| Token | Name | HEX | Role | Contrast (verified) |
|---|---|---|---|---|
| `color.primary` | **Grape** | `#5A2E7A` | Primary buttons, active states, Strength ring, links | **9.97:1** on white, 9.27:1 on paper — AAA. White text on Grape 9.97:1 — AAA |
| `color.primary.deep` | **Deep Plum** | `#43265C` | Headers, dark surfaces, Journey graphs | 12.57:1 on white — AAA |
| `color.accent` | **Coral (Rosa)** | `#E8697A` | Decorative accent, mascot cheeks/ears echo, milestone glints — **large/decorative only** | 3.12:1 — decorative/large-UI only, never body text |
| `color.accent.text` | **Coral Deep** | `#B23A4B` | When coral must carry text | 5.83:1 on white — AA |
| `color.celebrate` | **Honey** | `#D0A070` | Celebration warmth, milestone particles (mapped from the sheep's face/wool tan — this is our "dawn/hope" colour) | Decorative/large only |
| `color.celebrate.text` | **Honey Deep** | `#97591F` | Honey as text (caution/celebration labels) | 5.58:1 on white — AA |
| `color.ink` | **Ink** | `#2A1F33` | Primary text (warm aubergine — echoes the sheep's eyes, softer than black) | 14.55:1 on paper — AAA |
| `color.slate` | **Slate** | `#6B5E75` | Secondary text, captions, metadata | 5.61:1 on paper — AA |
| `color.bg` | **Wool** | `#FBF6EF` | App background (warm off-white; pure white reads clinical) | base surface |
| `color.surface` | **Card** | `#FFFFFF` | Cards on Wool | card fill |

#### Semantic — Light theme

| Token | Name | HEX | Role | Contrast |
|---|---|---|---|---|
| `color.success` | **Sage** | `#4E7A5A` | Confirmations, clean-day marks (distinct hue from Grape) | 4.93:1 on white — AA |
| `color.warning` | **Honey Deep** | `#97591F` | Gentle caution (danger-hour heads-up) — warm, never alarm-orange | 5.58:1 — AA |
| `color.danger` | **Brick** | `#B0453F` | **Destructive actions ONLY.** Never on lapse/relapse screens — red on a relapse screen is punishment by pixel | 5.57:1 on white — AA |

#### Dark theme (first-class — Sam's 1am SOS must not floodlight the room)

| Token | Name | HEX | Role | Contrast |
|---|---|---|---|---|
| `color.bg` (dark) | **Night** | `#1A1420` | Base (near-black, warm purple undertone; true #000 avoided — OLED smear) | base |
| `color.surface` (dark) | **Night Card** | `#241C2E` | Cards; elevation via lightening, not shadow | +1 step for raised |
| `color.primary` (dark) | **Grape 300** | `#B98FD6` | Dark-mode primary (lightened per Material dark guidance to avoid vibration) | 6.84:1 on Night — AA+ |
| `color.accent` (dark) | **Coral 300** | `#F09AA6` | Dark-mode accent | 8.48:1 on Night — AAA |
| `color.ink` (dark) | **Fog** | `#ECE6F2` | Primary text on dark | 14.74:1 on Night — AAA |

**Colour rules (from research §9, kept):**
- The entire palette is **deliberately desaturated** — high saturation = arousal, and our users are already aroused.
- **Meaning is never carried by colour alone** (~8% of men are red-green colourblind). Calendar states use **shape + colour** (dot = clean, ring = craving, diamond = lapse). Charts are patterned.
- **Brick red is rationed like a controlled substance** — destructive actions only.
- **SOS mode always renders in the dark (Night) variant regardless of system theme**, day or night — an instant calm shift and no floodlighting at 1am.

### 4.2 Typography

Expo can't ship SF Pro cross-platform, so we use a system-native + one loaded family strategy that preserves the research's Dynamic Type and calm intent.

- **UI / body:** platform system font via React Native default (`San Francisco` on iOS, `Roboto` on Android) — inherits each OS's accessibility scaling for free.
- **Display numerals & logotype:** a warm rounded family loaded via `expo-font` — **Nunito** or **Quicksand** (rounded, friendly, echoes the sheep's soft forms; rounded shapes read as safer to an anxious audience — Bar & Neta 2006). Used **only** for hero numbers (clean days, Strength score) and the wordmark.
- **Never** serif for UI/data.

**Type scale** (anchored to iOS HIG defaults; scales with OS text size):

| Token | Size/Leading | Weight | Use |
|---|---|---|---|
| `display` | 40 / 46 | Bold (Rounded) | Hero numbers: clean days, Strength |
| `title1` | 28 / 34 | Bold | Screen titles |
| `title2` | 22 / 28 | Semibold | Card titles, milestones |
| `headline` | 17 / 22 | Semibold | List headers, emphasis |
| `body` | 17 / 24 | Regular | **All reading content** — 17pt floor; leading raised to ~1.4× for stressed-reader comfort |
| `callout` | 16 / 21 | Regular | Secondary content |
| `footnote` | 13 / 18 | Regular | Metadata, citations |
| `caption` | 12 / 16 | Regular | Chart labels only — never body |

**Rules:** Dynamic Type mandatory for every string (test at largest accessibility sizes; stacks reflow vertically, therapeutic copy never truncates). Line length 45–75 chars. Never justify, never all-caps sentences. **Monospaced digits** for live counters so money-saved ticks don't jitter layout. Min text contrast 4.5:1 (verified in §4.1).

### 4.3 Spacing, radius, elevation, motion

| Token group | Spec |
|---|---|
| **Spacing** (8-pt scale) | `4 · 8 · 12 · 16 · 24 · 32 · 48 · 64`. Screen gutter 16 (20 on large phones). Card padding 16. Inter-card 12. Section gap 32. **Whitespace ≥ 40% of any screen** — the cheapest calm signal. |
| **Radius** | `chip 8 · input 12 · button 16 · card 20 · sheet 28 · round 999` (Strength ring, SOS button). Continuous/rounded corners. |
| **Elevation** (two levels only) | `e1` resting card: y2 blur8 @6% black. `e2` raised (SOS button, modals): y6 blur20 @12%. **Dark mode: elevate by lightening the surface, not by shadow.** |
| **Motion** | Calm spring (response ~0.45, damping ~0.85 — settles, never hard-bounces). Micro 150ms · standard 250ms · transitions 350ms; ease-out on entry. **Breathing tempo: inhale 4s / hold 2s / exhale 6s, haptic-synced.** Milestone forge ≤2.5s, skippable, once. **Every animation has a Reduce-Motion crossfade fallback** (breathing orb → opacity pulse; no parallax, no full-screen zoom — vestibular-safe). |

### 4.4 Component inventory (MVP)

Build these as the shared UI kit (`presentation/components`). Each ships with default / pressed / disabled / loading states and light + dark + large-text variants.

`StrengthRing` · `ChainMilestoneCard` · `CheckInSheet` · `SOSButton` (raised, center-docked) · `BreathingOrb` · `MoodChips` · `StatTile` (monospaced digits) · `HealTimelineRow` · `JournalCell` · `CoachBubble` · `EmptyState` (mascot + one line + one action — never blank) · `PaywallCard` (honest variant only) · `MascotView` (state-driven, respects "minimal mascot" setting) · `HabitChip`.

**Button hierarchy:** Primary (filled Grape, 52pt tall, one per screen max) · Secondary (12% Grape tint) · Tertiary (text only) · Destructive (Brick text, **never** a filled-red panel). 52pt exceeds the 44pt minimum, sized for stressed/older thumbs.

---

## 5. Information Architecture

**4 tabs + 1 raised SOS action.** The SOS button is *not* a tab — it's a raised, center-docked action (the "notch" pattern), because it's a **verb, not a place**, and must be the most salient tap target in the product.

```
UNCHAIN
│
├── TAB 1 · TODAY (home)
│   ├── Maria (mascot, state-driven) + greeting
│   ├── Recovery Strength ring + clean time (per habit, swipeable)
│   ├── Morning intention / evening reflection card
│   ├── Today's practice (one ≤2-min micro-lesson)
│   ├── Live stats: money saved · time reclaimed · health timeline
│   └── Gentle feed: next milestone, coach note
│
├── TAB 2 · JOURNEY (progress)
│   ├── Recovery Strength history graph
│   ├── Milestones (chain-link wall — sheep breaks each link)
│   ├── Calendar heat-map (clean / craving / lapse — shape + colour)
│   ├── Insights: trigger patterns, danger hours, what-works ranking
│   └── Body & mind healing timeline (per habit, cited)
│
│        ┌───────────────────────────────────────────┐
│        │  ⊕  SOS  (center, raised, reachable from   │
│        │     every tab + lock-screen widget + Watch)│
│        │  Breathe → Ground → Tape-forward → My Why  │
│        │  → Distract → Reach out → outcome capture  │
│        └───────────────────────────────────────────┘
│
├── TAB 3 · JOURNAL
│   ├── New entry (voice / text / mood chips)
│   ├── Craving log (auto-created from SOS sessions)
│   ├── Timeline + lapse analyses
│   └── Guided prompts (CBT / gratitude / letter-to-self)
│
└── TAB 4 · YOU
    ├── My chains (add / edit habit, goals, quit vs reduce)
    ├── Blockers & shields (Screen Time, cooldowns)
    ├── My why (photos, voice notes — SOS source material)
    ├── Coach (AI) conversation
    ├── Settings: privacy (Face ID lock, local-only, discreet icon,
    │   minimal-mascot), notifications, accessibility, data export/delete
    └── Unchain Plus
```

**IA principles (kept):** 4 tabs max (low-cognitive-load ceiling), noun-labeled, always visible, no hamburger. SOS never more than one interaction away, also *outside* the app. Journal is top-level (a daily verb; burying it kills the habit). Multi-habit via swipe on Today, not separate silos — one identity, many chains. Privacy controls at the first level of Settings. Depth ≤ 3 levels everywhere.

---

## 6. Screen-by-screen specs (MVP)

### 6.1 Onboarding (time-to-first-value < 3 minutes)

The research recipe, exactly:
1. **Value before demands** — the promise in ≤2 screens (mascot + one line: *"Installing this took guts. You've already started."*). Zero forms on screen one.
2. **The quiz is therapy, not data capture** — short adaptive intake (habit → frequency → cost → triggers → your *why*), ~8–10 steps, visible progress bar. Caps investment without overwhelming.
3. **The mirror moment** — reflect inputs as insight: *"Vaping is costing you ≈ ₱4,500/mo and you mostly reach for it when stressed at work."* This is the "aha" that converts.
4. **Commitment ritual** — hold a button 3 seconds to *"help Maria break the first link."* Effortful-on-purpose; creates a memory anchor (Cialdini commitment/consistency).
5. **Permissions in context** — ask for notifications *after* explaining craving interventions (roughly doubles opt-in vs a cold prompt). Use provisional/quiet auth first.
6. **Never gate the first win behind the paywall.** Paywall appears after value, skippable, honest.
7. User leaves onboarding with a **live dashboard, an armed SOS button, and a scheduled first check-in.**

### 6.2 Today (dashboard)

```
┌─────────────────────────────────────┐
│ Magandang umaga, Dana      ☾  🔔     │  title2 semibold
│              (Maria waves, happy)    │  MascotView, idle-happy
│        ╭────────────╮                │  StrengthRing 168pt
│        │     78     │  ← Grape ring   │  display numeral (Rounded)
│        │  STRENGTH  │  on Wool bg     │  caption label, Slate
│        ╰────────────╯                │
│   ⛓ 23 days free · vaping            │  headline, Ink
│ ┌─────────────────────────────────┐  │  intention card, e1, r20
│ │ ☀ Set today's intention    →    │  │
│ └─────────────────────────────────┘  │
│ ┌───────────┐ ┌───────────┐          │  StatTiles (mono digits)
│ │ ₱4,142    │ │ 11 urges  │          │
│ │ saved     │ │ ridden out│          │
│ └───────────┘ └───────────┘          │
│ ┌─────────────────────────────────┐  │  HealTimelineRow
│ │ ♥ Lung function improving —     │  │
│ │   day 23 of 90 · ▓▓▓▓░░░░       │  │
│ └─────────────────────────────────┘  │
│  Today  Journey  ◉SOS  Journal  You  │  tab bar + raised SOS
└─────────────────────────────────────┘
```

Hero metric top-of-screen; primary actions in the bottom 40% (thumb zone — ~49% of use is one-thumb). Money in **pesos** (launch plan). Mascot swaps state with Strength trend but stays subtle.

### 6.3 SOS / craving flow (the flagship — the "3-Second Lifeline")

Reachable in ≤1 tap from anywhere: persistent raised button, lock-screen widget, iOS Action Button, Watch complication (phased). **Full-screen takeover, zero choices to start, auto-begins paced breathing.** Always renders in the dark (Night) variant.

```
┌─────────────────────────────────────┐
│                              ✕ tiny  │  Night bg even in light mode
│           ╭─────────╮                │  BreathingOrb: Grape glow,
│          (  breathe  )               │  4-2-6 pacing, haptic-synced
│           ╰─────────╯                │  (Maria braces beside it)
│      "This wave will pass.           │  body 17/24, Fog
│       Most cravings fade             │
│       within minutes."               │
│       ▁▂▄▆█▆▄▂▁  you are here ↑      │  urge-wave visual
│  [ Ground me ] [ My why ] [ Talk ]   │  escalation ladder, r16
│       I made it ▸    I slipped ▸     │  both exits designed, no red
└─────────────────────────────────────┘
```

**Escalation ladder:** breathe → grounding (5-4-3-2-1 senses) → "play the tape forward" → **your saved *why* photo/note** → distraction game → reach a trusted contact. Slow exhale (6s) activates the parasympathetic response and drops arousal.

**Exit survey, 1 tap:** *Urge passed / Still fighting / I slipped* — each answer gets a designed response. "Urge passed" → competence feedback (*"That's 12 urges ridden out"*) — self-efficacy is the strongest predictor of quitting success. "I slipped" → the relapse flow, gently.

### 6.4 Relapse flow (decides retention — Robert's screen)

**Zero red. Zero broken-chain-shattering imagery. Maria sits beside the user (comfort state), briefly.**

```
[I slipped]  (always available, never buried)
   │
   ▼ Screen 1 — COMPASSION (no data asked yet)
   │   "Okay. Take a breath. A slip is a moment, not a verdict.
   │    40–60% of recoveries include one. You're still in this."
   │   (Maria, comfort state, beside the user)     [Continue]
   ▼ Screen 2 — CONTEXT AS DATA (optional, skippable)
   │   When? Where? Feeling? (HALT chips)  Trigger?
   ▼ Screen 3 — REFRAME + PLAN
   │   "Recovery Strength: 71 → 62. Everything you built is
   │    still in you — 47 total clean days, 12 urges beaten."
   │   one insight + one adjustment suggestion
   ▼ Screen 4 — RECOMMIT (user chooses next step)
       [Back to today]  [Talk to coach]  [Adjust my plan]
```

Worded as **data collection, never confession.** Compassion first prevents the shame spiral (Abstinence Violation Effect); showing surviving assets counters all-or-nothing thinking; user-chosen next step restores autonomy. **Logging a lapse honestly earns quiet recognition** (counter-programs shame).

### 6.5 Journey, Journal, You

- **Journey:** Strength history graph, chain-milestone wall, calendar heat-map (shape + colour), insights (danger hours, what-works ranking), cited healing timeline per habit.
- **Journal:** voice-first entry, mood chips, prompts tied to today's events (*"You beat an urge at 3pm — what helped?"*). Friction near zero or it won't get used.
- **You:** habit management, blockers, "my why" library, coach, and a **privacy-first Settings** (Face ID lock, local-only mode, discreet icon, minimal-mascot toggle, per-type notifications, accessibility, one-tap data export/delete).

---

## 7. Technical Architecture

### 7.1 Stack

| Concern | Choice | Why |
|---|---|---|
| Framework | **React Native + Expo (dev client / prebuild)** | One codebase, iOS-first with a cheap Android path; fast iteration for a small team. Use **prebuild + config plugins** (not pure managed) so we can add native modules for Screen Time, Live Activities, Widgets. |
| Language | **TypeScript (strict)** | Type safety across the Clean-Architecture boundaries. |
| Navigation | **Expo Router** (file-based) or React Navigation | Tabs + modal SOS + stack per tab. |
| Local database | **WatermelonDB** *(recommended)* or SQLite (`expo-sqlite` / Drizzle) | **Local-first is a privacy requirement** (Sam). Reactive, offline, scales to journals + logs. |
| Sync (later) | **Optional, opt-in, end-to-end** (Premium) | Never required. Coach + journals private by architecture. |
| State (UI) | **Zustand** or React Query for server-ish state | Lightweight; domain logic stays out of components. |
| Styling | **Design tokens** (§4) via a theme provider; `nativewind` or `restyle` | Tokens are the contract — no hardcoded hex in components. |
| Animation | **Reanimated 3** + **Moti** | Breathing orb, spring transitions, milestone forge; honors Reduce Motion. |
| Notifications | **`expo-notifications`** + local scheduling | Craving/danger-hour timing, quiet hours. |
| Auth/lock | **`expo-local-authentication`** (Face ID / biometrics) | App lock for privacy personas. |
| Charts | **`victory-native`** / `react-native-svg` | Strength history, healing timeline. |
| Testing | **Jest** (domain/use-cases) + **React Native Testing Library** + **Maestro** (E2E flows) | Domain logic is pure → fast unit tests; E2E on SOS + relapse flows. |
| Error/analytics | **Sentry** + **privacy-safe, self-hosted or anonymized** product analytics | **Never** log recovery data or which habit a user has. |

### 7.2 Clean Architecture — layers

The rule: **dependencies point inward.** The domain knows nothing about React, Expo, or the database. This keeps the behavioral logic (Recovery Strength, relapse rules, milestone rules) pure, testable, and safe from framework churn — and lets us swap Expo internals or the DB without touching the rules.

```
┌──────────────────────────────────────────────────────────┐
│  PRESENTATION   screens, components, navigation, hooks     │  React/Expo
│  depends on ↓ application only (via view-models/hooks)     │
├──────────────────────────────────────────────────────────┤
│  APPLICATION    use-cases (interactors), ports (interfaces) │  pure TS
│  e.g. LogRelapse, StartSosSession, ComputeRecoveryStrength  │
│  depends on ↓ domain; declares repository INTERFACES        │
├──────────────────────────────────────────────────────────┤
│  DOMAIN         entities, value objects, domain services    │  pure TS
│  Habit, Chain, RecoveryStrength, CravingEvent, Milestone    │  ZERO deps
│  business rules: strength never resets, lapse ≠ relapse     │
├──────────────────────────────────────────────────────────┤
│  INFRASTRUCTURE  repository IMPLEMENTATIONS, device adapters │
│  WatermelonDB repos, notifications, Screen Time bridge,      │
│  biometric lock, AI-coach client — implement the ports above │
└──────────────────────────────────────────────────────────┘
        Composition root wires infra → application (DI)
```

- **Domain** is framework-free. `RecoveryStrength` is a value object that *cannot* be constructed in an invalid state and *cannot* reset to zero — the "progress is unbreakable" law is enforced by the type, not by UI discipline.
- **Application** exposes use-cases as the only way the UI changes state (`useCase.execute(input)`), and declares **ports** (e.g. `HabitRepository`, `NotificationScheduler`, `Blocker`) as interfaces.
- **Infrastructure** implements those ports. The Screen Time bridge, the DB, and the coach API are all swappable adapters.
- **Presentation** calls use-cases through thin hooks/view-models. Components hold *no* business logic and *no* raw hex — only tokens.

### 7.3 Folder structure

```
src/
├─ domain/
│  ├─ entities/            Habit.ts  Chain.ts  CravingEvent.ts  Milestone.ts
│  ├─ value-objects/       RecoveryStrength.ts  MoneySaved.ts  Streak.ts  Halt.ts
│  ├─ services/            RelapseAnalyzer.ts  StrengthCalculator.ts  MilestoneRules.ts
│  └─ errors/
├─ application/
│  ├─ use-cases/
│  │   ├─ sos/             StartSosSession.ts  RecordSosOutcome.ts
│  │   ├─ recovery/        LogCheckIn.ts  LogRelapse.ts  ComputeRecoveryStrength.ts
│  │   ├─ habits/          AddHabit.ts  SetGoal.ts  SwitchActiveChain.ts
│  │   ├─ journal/         CreateJournalEntry.ts
│  │   └─ coach/           SendCoachMessage.ts
│  └─ ports/               HabitRepository.ts  NotificationScheduler.ts
│                          Blocker.ts  BiometricLock.ts  CoachGateway.ts
├─ infrastructure/
│  ├─ db/                  watermelon schema, models, mappers
│  ├─ repositories/        WatermelonHabitRepository.ts ...
│  ├─ notifications/       ExpoNotificationScheduler.ts
│  ├─ device/             ScreenTimeBlocker.ts (native)  ExpoBiometricLock.ts
│  └─ coach/              CoachHttpClient.ts
├─ presentation/
│  ├─ screens/            Today/  Sos/  Relapse/  Journey/  Journal/  You/  Onboarding/
│  ├─ components/         (§4.4 inventory)
│  ├─ navigation/
│  ├─ hooks/              useRecoveryStrength.ts  useSosSession.ts (call use-cases)
│  └─ theme/              tokens.ts  ThemeProvider.tsx  (the ONLY source of colour)
├─ shared/                result types, date utils, i18n (Taglish strings)
└─ main/                  composition root / DI container, App entry
```

### 7.4 Core domain rules (encode these as tests first)

- **Recovery Strength** starts at ~15 on install (endowed progress: planning is real progress), is a 0–100 composite of clean time + check-in consistency + urges survived + tool use, **dips ~10–15 on a lapse, and can never go below the lifetime floor set by total effort.** It is a *state indicator, not a currency* — nothing is purchasable with it.
- **Lapse ≠ Relapse.** A single event is a lapse; the model records it as data and keeps lifetime totals permanent. No "reset to zero" path exists in the domain at all.
- **Milestones only ascend.** Named stages (Awakening → Foundations → Momentum → Resilience → Freedom → Mentor). Lapses never demote.
- **Quit vs Reduce vs Take-a-break** are first-class goal types per chain (Olivia needs Reduce).
- **Money-saved & time-reclaimed** computed per habit from onboarding inputs, in the user's currency (₱ default for PH).

---

## 8. Feature modules (the 8 verticals + custom)

One shared recovery engine, thin per-habit configuration. Each habit plugs into the same domain (check-in, craving log, relapse log, Strength, money/time saved, milestones, journal, coach, insights) and differs only in: default cost model, health/healing timeline (cited), trigger vocabulary, and whether blocking applies.

| Module | Hero metric | Blocking? | Notes |
|---|---|---|---|
| Smoking & Vaping | Money saved (₱/mo) + health timeline | No | Nicotine-clearance milestones. |
| Gambling | **Money not lost** | **Yes** (Screen Time) | Launch plan's most newsworthy vertical; block-first onboarding. |
| Social media | Time reclaimed | Yes | **Reduce** goal default; 30-sec interactions. |
| Gaming | Time reclaimed | Yes | Session-interference logging. |
| Alcohol | Sober time + money | No | Reduction framing; **AI must route withdrawal danger to a clinician** (alcohol withdrawal can be fatal — never triaged in-app). |
| Shopping | Savings (daily→lifetime) | No | Impulse-trigger analytics. |
| Pornography | Private streak + urges ridden out | Yes | **Max privacy**: Face ID, local-only, discreet everything. |
| Custom habit | User-defined | Optional | Full engine, user-named. |

---

## 9. Native capability matrix (the Expo reality check)

Being honest about what Expo gives us free vs what needs native work. This drives the roadmap.

| Capability | Expo support | Plan |
|---|---|---|
| Local notifications, scheduling, quiet hours | ✅ `expo-notifications` | MVP |
| Biometric app lock (Face ID) | ✅ `expo-local-authentication` | MVP |
| Local-first DB, offline | ✅ WatermelonDB/SQLite | MVP |
| Haptics (breathing pacing) | ✅ `expo-haptics` | MVP |
| Voice journal (speech-to-text) | ⚠️ native module / OS APIs | MVP-lite → V1.x |
| **Screen Time / app & site blocking** | ❌ **iOS FamilyControls has no Expo module** — requires a **custom native module + config plugin** and a special Apple entitlement | **V1.x** (gambling/porn/social). Big rock — scope early. |
| Home-screen **Widgets** (lock-screen SOS) | ⚠️ native (WidgetKit) via config plugin / `@bacons/apple-targets` | V1.x |
| **Live Activities / Dynamic Island** | ⚠️ native (ActivityKit) via config plugin | V2 |
| **Apple Watch** app + complication | ❌ native, separate target | V2 |
| **HealthKit** (sleep/HRV × cravings) | ⚠️ community modules exist | V3 |
| Discreet app icon (alternate icons) | ⚠️ config plugin | V1.x |
| AI Recovery Coach | ✅ HTTP client (server-side model) | V2 |

**Consequence:** the MVP is fully shippable in Expo. **Screen Time blocking is the one feature that will demand real native iOS work** — treat it as its own milestone with an Apple entitlement request, not a checkbox.

---

## 10. Notifications (channel discipline = ethics)

Global daily cap **3** (milestones exempt). Provisional/quiet auth first, full prompt only after one valuable notification lands. All copy assumes lock-screen shoulder-surfing: *"Time for your check-in ✦"* — **never** *"Day 3 without pornography."* Respect iOS Focus modes and quiet hours (default 22:00–07:00).

| Type | Frequency | Timing | Principle |
|---|---|---|---|
| Morning intention | 1/day | anchored to wake routine | forward-framed, never a stat dump |
| Evening reflection | 1/day | before historic danger window | warm close |
| Danger-hour heads-up | ≤1/day, only if data supports | ~20 min before the user's vulnerable window | predictive, personal, pressure-free |
| Milestone | event-driven | at achievement | pure celebration, zero ask |
| Re-engagement | 1 after 48h, 1 after 7d, then stop | usual active hour | compassion, **never guilt** ("Maria misses you" is banned) |
| Craving follow-up | event-driven | ~30 min after SOS | competence closure ("that urge you rode out — still proud. #13") |

---

## 11. Accessibility (WCAG 2.2 AA min, AAA where feasible)

Recovery correlates with ADHD/anxiety/depression and withdrawal impairs attention — accessibility here is core UX, not compliance.

- **Colour never alone** — calendar uses shape+colour; charts patterned (verified for deutan/protan/tritan).
- **Contrast** pre-verified in §4.1; focus/selected states ≥3:1.
- **Dynamic Type** — full range; layouts reflow vertically at large sizes; therapeutic copy never truncates.
- **Screen reader** (VoiceOver/TalkBack) — every element labeled; Strength ring exposes value + trend; **SOS breathing fully audio-guided** (spoken pacing); decorative mascot hidden from the reader.
- **Haptics** — breathing pace via haptics (usable eyes-closed / phone-in-pocket = the discreet public mode); respects system toggle.
- **Reduce Motion** — every animation has a crossfade fallback; breathing orb → opacity pulse; no parallax/zoom.
- **One-handed** — all primary actions in the bottom 40%; destructive actions not adjacent to frequent targets; 44pt+ targets.
- **Cognitive** — grade-8 reading level (check in CI), consistent help placement, never re-ask known data, never lose a journal draft.

---

## 12. Privacy & data (the hill to die on)

- **Local-first by default.** The app is fully functional with no account and no cloud.
- **Sync is opt-in, Premium, and end-to-end** — never required, never used for ads.
- **Face ID / biometric app lock**, discreet app name + alternate icon, "local-only mode."
- **Coach conversations private by architecture** — on-device where feasible, never surfaced to any future community feature, exportable and deletable.
- **Analytics carry no recovery content and never which habit a user has.** Delete-account/data is easy (two taps); "pause my plan" offers a 24h reflection delay with a support offer.
- **No selling or sharing of behavioral data. Ever.**

---

## 13. Ethical monetization (Unchain Plus)

Three hard bans (research §15, launch plan §5.2), enforced in code and copy:
1. **Never paywall SOS / crisis flow.** Monetizing panic is unconscionable and App-Store-review suicide.
2. **Never sell during an emotional low** — no upsell on relapse screens, no countdown timers, no fake urgency.
3. **Never obstruct cancellation** — in-app, two taps, no retention maze.

**Free** = a genuinely complete recovery kernel: 1 chain, full SOS forever, check-ins, Strength tracking, milestones, basic journal, money-saved, health timeline, crisis resources, core accessibility.
**Plus** = unlimited chains, AI coach, advanced insights, full blocker suite, missions library, Widgets/Watch, encrypted sync, custom milestones.
**PH pricing** (launch plan): regional tiers ≈ **₱790–1,490/yr** + a **lifetime tier** (locals distrust forever-subscriptions), 7-day trial with a pre-charge reminder. Consider a quiet **hardship policy** (free Plus on request, no proof) — pennies in cost, huge in brand truth.

---

## 14. Roadmap (adapted for Expo/RN)

| Release | Scope | Success metric |
|---|---|---|
| **MVP (V1)** ~4–5 mo | Onboarding (quiz→mirror→commitment) · 1+ chains · Today dashboard (Strength ring, stats, healing timeline, mascot) · **full SOS flow + relapse flow** · daily check-ins · milestones · basic journal · notifications v1 · privacy suite (Face ID lock, local-first) · Wool & Chain design system · accessibility baseline. **iOS first; Android build kept green.** | D30 retention > 25%; ≥60% of actives use SOS ≥1×/wk in weeks 1–4; **post-lapse 7-day return rate > 50%** (the metric that proves the thesis). |
| **V1.x** | **Screen Time blocking (native module + entitlement)** · lock-screen SOS Widget · discreet alternate icon · voice journal · danger-hour JITAI notifications. | Blocking-enabled users show higher D90; SOS-from-lock-screen usage. |
| **V2** ~+4 mo | **AI Recovery Coach** (Motivational-Interviewing grammar + safety rails) · trigger-pattern & danger-hour insights · Live Activities · Apple Watch · missions library (CBT/ACT) · **Premium launch** · **Android release** (capture the waitlist demand). | Free→paid 5–8%; coach weekly engagement > 40% of Plus. |
| **V3** ~+6 mo | Moderated anonymous circles + mentor roles · HealthKit correlations · localization · clinician-referral partnerships · outcome-study partnership. | Organic ≥50% of installs; NPS > 60. |

---

## 15. Go-to-market hook baked into the app (Tarsi playbook)

The launch is Philippines-first, build-in-public, **zero paid ads** — the Tarsi/Bryl Lim model (launch plan §2.2). The app is built to feed it:
- **Milestone moments are screenshot-worthy** (share cards, anonymized) so each user win becomes potential content.
- **Aggregate, anonymized outcomes** (urges ridden out, pesos saved) are queryable to publish as launch stats ("10,000 urges ridden out this week").
- **The sheep gives the story a face** that travels on TikTok — the thing Tarsi (a finance app) didn't have.
- **A single onboarding question — "where did you hear about us?"** — plus per-partner offer-code batches = the attribution the launch plan needs (target 60%+ known-source installs).
- Copy tone across the app is **plain, hopeful Taglish** — *"capable friend, not a clinic."*

---

## 16. The five laws (pin these above every design decision)

1. **The 3-Second Lifeline.** From any state of the phone, help is reachable in ≤3 seconds. Everything else is secondary.
2. **Calm is a feature.** Every screen must lower arousal, not raise it. If a choice adds urgency, noise, or dread, it's wrong — even if it lifts a metric.
3. **Progress is unbreakable.** No user action can erase the record of their effort. Displays may dip; history is granite.
4. **The user is the author.** Unchain suggests; the user decides. Autonomy is never traded for engagement.
5. **Honest by default.** Honest numbers, honest science, honest pricing. Nothing in the app may exploit the state it exists to heal — and the sheep never guilt-trips.

---

## 17. Open decisions (need a call before/at design lock)

1. **Canonical mascot design** — lock `mascot 1` vs `mascot 2` and commission the full state set from the chosen one.
3. **Rounded display font** — Nunito vs Quicksand (both fine; pick one for the wordmark + hero numerals).
4. **Local DB** — WatermelonDB (recommended, reactive) vs SQLite+Drizzle (simpler, more control).
5. **Screen Time native module** — build in-house vs adopt a maintained community module; file the Apple FamilyControls entitlement request early — it gates a whole vertical set.
6. **App display name / bundle identity** under DotOrbit; discreet alternate name for privacy personas.

---

*Prepared for DotOrbit · Unchain mobile app · React Native (Expo) · Clean Architecture. Palette sampled from `/assets`; behavioral doctrine inherited from the product research; launch inspiration from Tarsi by Bryl Lim.*
