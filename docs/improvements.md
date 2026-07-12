# Unchain - Improvements (v0 build → research-faithful)

This is a fix list for the current Expo scaffold, checked against
`Unchain_Product_Research_and_Design_Documentation-1.docx`. Each item names the
**actual file** that's wrong, **what the research actually says**, and the **fix**.
Ordered by impact.

Honest summary of what's broken right now:

1. **You can only pick ONE thing to quit.** This contradicts the product's #1 differentiator. Highest priority.
2. **Layouts use hardcoded widths** (`'47%'`, fixed `168`) - they don't adapt to small phones, large phones, tablets, or web.
3. **Some copy reads generic** - not the "capable Filipino friend" voice the brand demands.

---

## 1. "Choose what you're quitting" - multi-select (highest priority)

### What's wrong
`src/presentation/screens/OnboardingScreen.tsx` holds a **single** habit:

```ts
const [kind, setKind] = useState<HabitKind | null>(null);   // ← only one
...
onPress={() => setKind(h)}                                   // ← replaces, not adds
```

and `store.ts → completeOnboarding` creates exactly one chain.

### What the research says (this is not optional - it's the thesis)
- **§1.5, Differentiator #1:** *"Multi-addiction by design. One account, multiple chains. Addictions co-occur… Users managing two habits shouldn't need two apps with two paywalls."*
- **Journey stage 3 (Choose addiction(s)):** *"Grid of chains… **multi-select allowed**; 'not sure / just exploring' path preserves Contemplation-stage users."*
- **§7.3 IA:** *"Multi-chain switching via swipe on Today, not separate silos - one identity, many chains."*

The plural is in the section title itself: **"Choose addiction(s)."** Single-select breaks the core promise.

### The fix

**a) Multi-select grid.** Change onboarding to collect a set:

```ts
const [kinds, setKinds] = useState<HabitKind[]>([]);
const toggle = (h: HabitKind) =>
  setKinds((cur) => (cur.includes(h) ? cur.filter((x) => x !== h) : [...cur, h]));
// selected cards show a checkmark badge; "Continue" enabled when kinds.length >= 1
```

Add the research-mandated escape hatch: a low-commitment **"Not sure yet - just exploring"** chip that creates no chain but still lands the user on a (gently empty) dashboard. This keeps Contemplation-stage users (Sam) from bouncing.

**b) Per-chain adaptive intake.** Research §5.5: *"A short adaptive intake (**addiction → frequency → cost → triggers → 'why'**)… cap at ~8–10 steps with a visible progress bar."* Right now we skip frequency/cost/triggers entirely, so the **money-saved counter is always ₱0** (`Savings.moneySavedPHP` returns 0 without `unitCostPHP`/`unitsPerDay`). For each selected chain, ask:
   - frequency (units/day) + unit cost in ₱ → powers money-saved
   - top triggers (chips) → seeds the trigger map
   - the "why" (text now; photo/voice later) → surfaced in SOS "My why"

Loop the intake per selected chain, but keep the **total** under ~10 steps (if they pick 3 habits, ask the deep questions once and the cheap ones per-habit).

**c) The mirror moment, per research §5.5.** After intake, show the "aha": *"Vaping is costing you ≈ ₱4,500/mo, and gambling has cost you ₱X - you mostly reach for both when stressed."* Cross-habit insight is something single-vertical competitors literally cannot show (§1.5).

**d) Habit switcher on Today.** §7.3: swipe between chains on the dashboard. Add a horizontal pager or a segmented `Pill` row above the Strength ring that calls the existing `setActiveHabit(id)`. The store already supports N habits - the UI just needs to expose them.

**e) Store change.** Replace `completeOnboarding(oneHabit)` with `completeOnboarding(habits: HabitDraft[])` that seeds a `RecoveryStrength` per chain. `addHabit` already exists for adding more later from the **You** tab.

---

## 2. Mobile responsiveness (it currently doesn't adapt)

The research is explicit that this is a hard requirement, not polish:
- **§8.2 Layout:** *"Single-column vertical card stack; 16pt screen margins… primary action in thumb zone (bottom 40%)."* One-handed use - Olivia has a baby in the other arm.
- **§10.2:** *"Dynamic Type mandatory for every string… layouts tested at **AX5**… stacks re-flow vertically… **no truncation of therapeutic copy - ever**."* And *"content columns cap at ~600pt on iPad."*

### What's wrong (specific offenders)
| File | Problem | Fix |
|---|---|---|
| `OnboardingScreen.tsx` | Habit grid uses `width: '47%'` (hardcoded 2-col) | Compute columns from screen width: 2 on phones, 3 on large phones/tablets |
| `StrengthRing.tsx` | Fixed `size = 168/176` | Scale from `min(width * 0.44, 200)` so it fits small phones and doesn't balloon on tablets |
| all `Screen` content | No max-width | Cap content column at **600pt** and center it (tablet + web) per §10.2 |
| `type` tokens | Fixed `fontSize`/`lineHeight` | Keep, but **never** set `allowFontScaling={false}`; test the whole app at OS "largest" text - cards must grow, not clip |
| Stat tiles / rows | Fixed horizontal `flexDirection` | At AX5 text sizes, wrap to vertical (`flexWrap` / a `useResponsive()` breakpoint) |

### The fix - add one responsive primitive
Create `src/presentation/hooks/useResponsive.ts`:

```ts
import { useWindowDimensions } from 'react-native';

export function useResponsive() {
  const { width, height, fontScale } = useWindowDimensions();
  return {
    width,
    isSmall: width < 360,           // small phones
    isTablet: width >= 700,         // iPad / large
    columns: width >= 700 ? 3 : 2,  // habit grid
    contentMax: 600,                // §10.2 reading cap
    ringSize: Math.min(width * 0.44, 200),
    // at very large text, switch row layouts to stacked
    stacked: fontScale >= 1.6,
    gutter: width >= 700 ? 20 : 16, // §8.2
  };
}
```

Then: `Screen` centers a `maxWidth: contentMax` column; the habit grid maps `columns`; `StrengthRing` takes `ringSize`; stat rows read `stacked` to switch `flexDirection`. This is ~1 hook + ~5 edits and makes every screen adapt from a 320px phone to an iPad to a browser.

> Note: you were testing on **web**, where React Native Web doesn't apply device font-scaling and fixed pixels look worst. The 600pt centered column + `useResponsive` fixes the web look too.

---

## 3. De-slop - make it sound like a Filipino friend, not a template

The research brand voice (§17) is specific: *"Plain, human, second-person, present-tense. Short sentences. Says the hard thing kindly."* The launch plan (§5.2) adds: *"plain, hopeful **Taglish**… speaks like a capable friend, not a clinic."* Where the current build drifts into generic app-copy, fix it:

| Location | Now (generic) | Better (on-brand, Taglish where natural) |
|---|---|---|
| `TodayScreen` intention card | "Set today's intention" | "Anong klaseng araw ang gusto mong buuin?" |
| `JournalScreen` "New entry" | bare button | "I-dump mo lang - kahit isang linya, bilang 'yun." |
| Empty states | present but plain | Every empty state = warm line + one action (§5.10): "Wala pang laman - pero andito lang ako." |
| SOS subtitle | fine, keep | keep grounded imperative-calm ("Breathe with me. Four in.") |
| Milestones | not written yet | Pair each with one line of forward-arming (§12): "Day 30 - pero dito rin nagiging risky ang tiwala. Handa ka." |

**Also missing entirely (not slop, just absent):**
- **Peak-end celebration moment** (§12, §16): a full-screen milestone with the chain-link forging animation (≤2.5s, skippable). Right now milestones are just locked/unlocked tiles.
- **The mirror moment** in onboarding (see §1c above) - the single highest-converting screen in the whole flow, per research.
- **Danger-hour + check-in copy that assumes lock-screen shoulder-surfing** (§14): never show the habit name in a notification.

---

## 4. Prioritized checklist

- [x] **P0 - Multi-select onboarding** + "just exploring" path + per-chain intake (§1). *Done - `OnboardingScreen` collects a set; intake captures ₱/min + triggers + why; money-saved is now real.*
- [x] **P0 - `useResponsive` hook** + applied to Onboarding grid, StrengthRing, Screen max-width (§2). *Done - `src/presentation/hooks/useResponsive.ts`; content caps at 600pt and centers on tablet/web.*
- [x] **P1 - Habit switcher on Today** (segmented pills) using `setActiveHabit`. *Done.*
- [x] **P1 - Mirror moment** after intake (cross-habit ₱/month + ₱/year + trigger insight). *Done - onboarding step 4.*
- [x] **P2 - Milestone celebration** full-screen peak-end moment (`app/celebrate.tsx`) with chain-forge burst; fires on real milestone crossings + the first-link forge after onboarding. *Done.*
- [x] **P2 - Notifications** - `ExpoNotificationScheduler` schedules two daily reminders with lock-screen-safe copy that never names the habit (§14). *Done.*
- [~] **P2 - Taglish copy pass** - Onboarding, Today, Journal, celebration done. **Still to do:** You, Journey, SOS, Relapse strings.
- [ ] **P1 - Manual QA at OS largest text size**; confirm no clipped therapeutic copy on a real device (§10.2 - "ever").
- [ ] **§1b follow-up** - richer intake (photo/voice "why"), and per-chain *goal* editing in the You tab (currently one goal applies to all selected chains).

---

*Grounded in `Unchain_Product_Research_and_Design_Documentation-1.docx` §§1.5, 5.5, 5.10, 7.3, 8.2, 10.2, 12, 14, 17 and the current code in `src/`.*
