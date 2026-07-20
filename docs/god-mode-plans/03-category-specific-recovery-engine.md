# Plan 3 of 3 — Category-Specific Recovery Engine

> Standalone execution plan for one exhaustive recovery-track catalog, one feature registry, and a truthful flagship feature for every supported category.

| Field | Value |
|---|---|
| Status | Proposed; implementation not started |
| Priority | P1 foundation, then gated feature delivery |
| Product posture | Self-help/wellness, privacy-first, no clinical or enforcement overclaim |
| Related plans | [Plan 1](01-multi-track-onboarding-profile-patterns.md) · [Plan 2](02-iphone-log-urge-all-games-apple-ready.md) |

## Outcome

Every category has:

- correct intake questions;
- category triggers and journal fields;
- a truthful hero metric;
- one meaningful flagship feature;
- category-specific SOS and safety behavior;
- registry-driven routing and reminders;
- an explicit release/capability state;
- Apple-review-safe wording and metadata.

## Supported categories

1. Gambling
2. Pornography
3. Social media
4. Online shopping
5. Smoking
6. Alcohol
7. Drugs / substances
8. Gaming
9. Other

## Confirmed architecture problem

Category truth is fragmented:

- src/domain/gambling.ts owns taxonomy and most triggers.
- src/domain/pornRecovery.ts owns a separate pornography trigger list.
- src/domain/addictionJournal.ts owns the strongest existing registry.
- src/domain/alternatives.ts defines tools while app/alternatives.tsx hardcodes visibility and routing.
- src/domain/education.ts has a partial category map.
- JournalScreen, SOS, store seeding, Home/Progress metrics, and reminder effects contain more category branches.
- Education filters only the active category.
- Specialized reminders operate only for the active category.
- addictionMeta(type) ?? ADDICTIONS[0] can silently turn an unknown category into Gambling.

The intended repository architecture already says one shared recovery engine with thin per-habit configuration. This plan makes that real.

## Exhaustive pure category catalog

Create src/domain/recoveryTracks.ts:

~~~ts
export const ADDICTION_TYPES = [
  "gambling",
  "pornography",
  "social_media",
  "online_shopping",
  "smoking",
  "alcohol",
  "drugs",
  "gaming",
  "other",
] as const;

export type AddictionType = typeof ADDICTION_TYPES[number];

interface RecoveryTrackDefinition {
  type: AddictionType;
  label: string;
  verb: string;
  freeLabel: string;
  triggers: readonly string[];
  intake: readonly IntakeFieldDefinition[];
  baseline: "money" | "time" | "money_and_time" | "custom";
  journal: AddictionJournalConfig;
  heroMetric: HeroMetricId;
  flagshipFeature: RecoveryFeatureId;
  capabilities: readonly TrackCapability[];
  safety?: SafetyDefinition;
  sosAnchor: SosAnchorDefinition;
}

export const RECOVERY_TRACKS = {
  // exactly nine complete entries
} satisfies Record<AddictionType, RecoveryTrackDefinition>;
~~~

Derive labels, triggers, intake steps, journal configs, hero metrics, SOS copy, and filters from this catalog. Missing categories fail compilation/tests. Remove the silent Gambling fallback.

The Plan 1 setup wizard and Plan 2 Log Urge trigger picker consume this same source.

## Application feature registry

Create src/application/recoveryFeatureRegistry.ts:

~~~ts
interface RecoveryFeatureDefinition {
  id: RecoveryFeatureId;
  title: string;
  subtitle: string;
  icon: IconName;
  route: AppRoute;
  scope: "track" | "global";
  release: "off" | "internal" | "beta" | "stable";
  cadence?: ReminderCadence;
  requires?: RuntimeCapability[];
  excludedForTracks?: AddictionType[];
}
~~~

The domain catalog contains feature IDs, not React components, routes, notifications, or native APIs.

Generic consumers:

- RecoveryFeatureCard;
- RecoveryTrackSetupFlow field renderer;
- Home and Progress hero slots;
- Alternatives list;
- SOS pinned action;
- Education category browser;
- one multi-track reminder planner;
- graceful unavailable state.

## One flagship feature per category

| Category | Intake and hero metric | Flagship feature | Truth/safety boundary |
|---|---|---|---|
| Gambling | Bet types, money baseline, triggers; bet-free days and verified money not lost | **Bet Breaker** — intended stake, consequence preview, 90-second pause, alternative, optional Focus List entry | Intended stake is never automatically counted as savings; no odds, wagering, casino simulation, or gambling aid |
| Pornography | Risk windows, triggers, privacy preference; private streak and urges handled | **Private Shield Plan** — discreet risky-window plan, replacement action, private Focus List | No explicit imagery; no claim of system-wide blocking without Family Controls |
| Social media | Platforms, time baseline, reduction goal; time reclaimed | **Scroll Reclaim** — intentional session, stop time, displacement reflection | Manual/local measurement until a truthful native usage capability exists |
| Online shopping | Shopping contexts, spend baseline; paused/avoided purchase decisions | **Need or Want?** — promote existing 24-hour purchase interruption | An avoided intention is not automatically money saved |
| Smoking | Product/frequency and spend; smoke-free time and reflection trend | **Catch Your Breath** — retain existing weekly reflection | Wellness reflection, not lung diagnosis or measured medical improvement |
| Alcohol | Frequency/context and spend; alcohol-free time and well-being trend | **Cheers to Change** — retain body, sleep, energy reflection | Never encourage drinking; permanent withdrawal warning and professional help |
| Drugs / substances | User-safe detail, context, triggers; recovery time and well-being trend | **Back on Track** — retain craving/discomfort/frequency reflection | No dosage, detox, diagnosis, or withdrawal triage; emergency/pro support |
| Gaming recovery | Games/context, time and optional spend; time reclaimed and planned exits | **Session Exit Plan** — purpose, stop time, reminder, interference check | Recreational Games area is hidden or explicit opt-in for this track |
| Other | User-defined habit and baseline; user-selected metric | **My Replacement Plan** — “When trigger, I will alternative for duration,” pinned to SOS | Generic, editable, no unsupported automation claim |

The four existing tools—Need or Want, Catch Your Breath, Cheers to Change, and Back on Track—enter the registry first with behavior parity. New features remain internal until their own gates pass.

## Apple approval-safe product positioning

### Self-help, not medical treatment

Apple applies greater scrutiny to medical apps that diagnose or treat. Use consistent language:

| Use | Avoid |
|---|---|
| self-help, wellness, reflection, personal recovery support | treatment, cure, clinical program, prevents relapse |
| self-reported trend | measured health improvement |
| time since the date you entered | medically verified sobriety |
| estimated from your entries | exact savings or health outcome |
| seek qualified professional help | substitute for professional care |

A disclaimer is required but is not enough if UI, metadata, achievements, or notifications still make a medical claim.

### P0 submission blocker: Fuel Your Recovery

app/fuel-your-recovery.tsx currently calculates calorie recommendations, defaults to a male formula when gender is skipped, offers weight-loss/gain plans, and supports fasting schedules through 20:4 and OMAD.

For the easiest approval path:

- **Recommended v1:** remove/hide this feature from the submitted binary, or reduce it to manual meal/water logging.
- Do not provide automatic calorie, weight, fasting, or body-change recommendations until qualified clinical review and documented methodology exist.
- Do not market fasting or calorie targets as recovery treatment.
- If retained later, add contraindication/safety handling, evidence, neutral defaults, accessibility, and exact Review Notes.

This is a larger Guideline 1.4 physical-harm risk than the three requested bug groups and must be handled before submission.

### Crisis resources

app/disclaimer.tsx currently hardcodes US 911, 988, and SAMHSA while the project targets users in the Philippines too.

- Use verified locale/storefront-aware emergency resources.
- Show a number only when it matches the user’s region.
- Always provide the neutral fallback “contact your local emergency services.”
- Verify every external number/link immediately before release.
- Never imply Unchainly itself offers crisis intervention.

### Gambling recovery, not gambling

- No real-money gaming, simulated casino, wager currency, odds tool, card counting, contest, prize, or betting link.
- Bet Breaker interrupts a user-entered intention; it never models how to place or optimize a bet.
- The five offline games are generic cognitive/puzzle experiences and use no betting language.
- Review Notes explicitly explain that “Gambling” is a recovery category.

### Sensitive sexual/substance content

- Pornography recovery uses text-only, neutral, non-explicit copy and discreet notifications.
- App Store screenshots/icons/previews remain appropriate for a broad public audience even if the age rating is higher.
- Alcohol, drugs, and smoking flows never encourage consumption.
- Emergency and professional-support routes are always reachable.
- Do not publish as a Kids Category app.
- Answer the current App Store Connect age-rating questionnaire honestly for sexual-content references, alcohol/tobacco/drug references, medical/treatment information, and chance-based elements.

### 2026 regulated medical-device declaration

As of March 26, 2026, Apple requires regulated-medical-device status for a new app distributed in the EEA, UK, or US when either:

- its primary or secondary category is Health & Fitness or Medical; or
- its age-rating answers mark frequent Medical or Treatment Information.

For this self-help product, select “No” only if the shipped behavior and claims truthfully remain non-medical. If positioning changes to diagnosis, prevention, monitoring, or treatment, stop and complete the proper regulatory path instead of relying on a disclaimer.

### Native blocking

The lowest-risk v1 remains a local Focus List/plan:

- Do not market “blocks apps/sites” in UI or metadata.
- Real Screen Time/Family Controls behavior is a later native capability.
- Before distribution, the Apple Developer Account Holder must request Family Controls entitlement approval for the app and extensions.
- Only enable after entitlement, native implementation, privacy review, failure states, and Review Notes are complete.
- No hidden or dormant blocking claim may ship.

## Privacy architecture and submission

### Current favorable posture

- No accounts.
- No cloud sync.
- No analytics or ads.
- Recovery data claims to stay on device.
- Permissions are tied to specific local functions.

### Current gaps to close

1. **Public privacy policy**
   - Apple requires a privacy-policy URL in App Store Connect and an easily accessible in-app link.
   - Publish a real HTTPS page; the current local disclaimer route is not the required public URL.
   - State what is accessed, what leaves the device, retention/deletion, backup behavior, permissions, export, and contact.

2. **Support contact**
   - Publish a working Support URL with real contact information.
   - Add permanent Settings/Profile → Help & Legal access after onboarding.

3. **App Privacy answers**
   - “No data collected” is valid only if the release binary and every SDK transmit no data off device.
   - Audit Expo modules and the final archive.
   - Update answers whenever behavior changes.

4. **Privacy manifest**
   - Validate PrivacyInfo.xcprivacy from the final iOS archive.
   - Declare required-reason APIs accurately.
   - Validate third-party SDK privacy manifests and signatures.

5. **Sensitive local storage**
   - Recovery journals, triggers, substances, pornography, urges, and finances are sensitive.
   - Verify iOS file/data protection.
   - Exclude personal recovery/health data from automatic iCloud backup where Apple’s health-data rule applies.
   - User-initiated export remains explicit, previewed, and cancelable.

6. **Deletion without an account**
   - Provide “Delete all local data” with confirmation.
   - Delete persisted state, drafts, caches, generated/share files, and cancel scheduled notifications before reporting success.
   - If accounts are added later, add in-app account deletion before submission.

7. **Notifications**
   - Optional, contextual opt-in.
   - Generic lock-screen copy that does not reveal category, shopping item, price, lung, substance, or pornography context.
   - Per-feature controls, quiet hours, dedupe, and global daily cap.

8. **Diagnostics**
   - In-memory/dev or bounded local diagnostics only.
   - Never include names, free text, triggers, domains, substance details, exact amounts, journal answers, category IDs, or stable device identifiers in network payloads.
   - Future network analytics requires explicit consent, policy/App Privacy changes, retention/deletion rules, and a reviewed data dictionary.

## Registry-driven cross-category behavior

### Surfaces

- Home/Progress resolve the active track’s cards and metric.
- Education can browse all selected tracks, not only active.
- SOS shows active-track pinned action plus universal emergency help.
- Alternatives show registry-approved tools.
- Existing feature history remains readable when a feature is off.
- Unknown feature ID yields an unavailable state, not a crash or wrong category.

### Reminders

One pure planner:

- evaluates every selected track, including inactive selected tracks;
- deduplicates identical schedules;
- respects quiet hours and permission state;
- enforces a documented global daily cap;
- stores schedule/completion per track;
- cancels only the archived track’s feature reminders;
- uses privacy-safe notification text;
- never recommends a recreational game by default to a gaming-recovery user.

## Work packages

- [ ] **P3-01 — Catalog characterization**
  - Golden tests for current labels, triggers, journal fields, routes, SOS, metrics, and existing features.

- [ ] **P3-02 — Exhaustive recovery catalog**
  - Exactly nine definitions, no fallback, shared trigger/intake/journal source.

- [ ] **P3-03 — Existing feature registry**
  - Register four current tools as stable with explicit scope, cadence, route, and capability.

- [ ] **P3-04 — Convert surfaces**
  - Home, Progress, Alternatives, SOS, Education, Journal seed copy, and reminders.

- [ ] **P3-05 — New native-free features**
  - Bet Breaker, Scroll Reclaim, Session Exit Plan, My Replacement Plan behind internal gates.

- [ ] **P3-06 — Safety and recovery-trigger protection**
  - Fuel Your Recovery removal/reduction, regional crisis resources, alcohol/drug handoff, discreet pornography design, gaming Games-area exclusion.

- [ ] **P3-07 — Privacy/submission foundation**
  - Public privacy/support URLs, local deletion, backup exclusion audit, App Privacy answers, privacy manifest report.

- [ ] **P3-08 — Metadata and regulatory truth**
  - Age rating, Health & Fitness positioning, regulated-medical-device declaration, screenshots, Review Notes.

- [ ] **P3-09 — Native capability gate**
  - Family Controls only after approved entitlement and honest metadata.

- [ ] **P3-10 — Feature graduation**
  - Internal → beta → stable only after correctness, accessibility, privacy, and Review Notes pass.

## Acceptance gates

- [ ] Exactly nine catalog keys; missing category fails compile/tests.
- [ ] Every category has triggers, intake, baseline, journal, hero metric, feature, SOS, and safety definition.
- [ ] No category silently falls back to Gambling.
- [ ] Plan 1 onboarding and Plan 2 Log Urge consume the same catalog.
- [ ] Every feature route resolves and has off/internal/beta/stable behavior.
- [ ] Existing feature state/history survives registry migration.
- [ ] Track-scoped feature state survives A → B → A switching.
- [ ] Reminder planner handles multiple tracks, quiet hours, dedupe, archive, and global cap.
- [ ] Gaming-recovery users are not automatically sent to recreational games.
- [ ] Fuel Your Recovery is removed/reduced or clinically reviewed before submission.
- [ ] Crisis resources are accurate for the user’s region.
- [ ] Alcohol/drugs have persistent professional-safety boundaries.
- [ ] No explicit sexual imagery or sensitive lock-screen notification exists.
- [ ] No false medical, blocking, measurement, or savings claim exists.
- [ ] Public privacy/support URLs, local deletion, backup behavior, App Privacy, and privacy manifest agree.
- [ ] Family Controls remains off until entitlement and native gates pass.
- [ ] Age rating and metadata accurately represent mature recovery themes.
- [ ] The 2026 regulated-medical-device declaration is completed truthfully.

## Test matrix

| Layer | Required coverage |
|---|---|
| Catalog | Exact keys, no fallback, triggers, intake/baseline compatibility, one feature/SOS per category |
| Registry | Unique IDs, route validity, scope, release state, capability fallback, exclusions, cadence |
| Surface | Active, inactive-selected, archived, unknown feature, disabled feature |
| Reminder | Multi-track, dedupe, quiet hours, cap, denial, archive, timezone, neutral copy |
| Feature domain | Complete, cancel, resume, repeated completion, honest metric semantics |
| Safety copy | Medical terms, substance encouragement, fasting/nutrition, blocking/savings, crisis resources |
| Privacy | Offline/network inspection, local delete, export, backup exclusion, manifest validation |
| Migration | Existing feature state, old backup, v4 round trip |
| Apple metadata | Privacy label, age rating, medical-device status, screenshots, description, accessibility claims, Review Notes |

## App Review note template

~~~text
Unchainly is a self-help and wellness app for users who voluntarily track
personal recovery goals. It is not a medical device, does not diagnose or
treat conditions, and does not provide detox, dosage, fasting, or calorie
recommendations in this submitted version.

“Gambling” refers only to recovery from gambling. The app contains no betting,
casino simulation, odds tool, wagering currency, contest, prize, or real-money
gaming.

All recovery records stay on device. There are no accounts, ads, analytics, or
cloud sync. The App Privacy responses and privacy policy reflect the submitted
binary.

The current version provides a local Focus List and planning tools. It does not
claim to block other apps or websites and does not use Family Controls.
~~~

## Rollout order

1. Characterize current behavior.
2. Merge exhaustive catalog.
3. Complete Plan 1 track schema/setup.
4. Register existing features with parity.
5. Convert surfaces one at a time.
6. Remove/reduce the highest-risk nutrition/fasting feature and correct crisis resources.
7. Add native-free features behind internal gates.
8. Complete privacy, safety, age-rating, medical-status, and reviewer-note audits.
9. Graduate features only with evidence.
10. Consider native entitlement features in a later submission.

## Official Apple references

- [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [Manage app privacy in App Store Connect](https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy)
- [App Privacy Details](https://developer.apple.com/app-store/app-privacy-details/)
- [Privacy manifest files](https://developer.apple.com/documentation/bundleresources/privacy-manifest-files)
- [Set an app age rating](https://developer.apple.com/help/app-store-connect/manage-app-information/set-an-app-age-rating)
- [2026 regulated medical-device status update](https://developer.apple.com/news/?id=nyqbfz1y)
- [Declare regulated medical-device status](https://developer.apple.com/help/app-store-connect/manage-app-information/declare-regulated-medical-device-status)
- [Requesting the Family Controls entitlement](https://developer.apple.com/documentation/familycontrols/requesting-the-family-controls-entitlement)
- [Accessibility Nutrition Labels overview](https://developer.apple.com/help/app-store-connect/manage-app-accessibility/overview-of-accessibility-nutrition-labels/)
